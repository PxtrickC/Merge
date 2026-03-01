/**
 * Build supply_history.json from all MassUpdate events.
 *
 * Reads db.json for token tier lookup, fetches all events from Etherscan,
 * and produces daily snapshots of supply, tier counts, alpha mass, and merge count.
 *
 * Output format:
 *   { startDate: "2021-12-02", data: [[alive, t1, t2, t3, t4, alphaMass, mergeCount, omnibusCount], ...] }
 *
 * Usage:
 *   node --env-file=.env scripts/build-supply-history.mjs
 */
import { readFileSync, writeFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { MERGE_CONTRACT_ADDRESS, NIFTY_OMNIBUS_ADDRESS, TRANSFER_TOPIC } from "../utils/contract.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, "..", "public", "data")

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || ""
const ETHERSCAN_BASE = "https://api.etherscan.io/v2/api"
const ETHERSCAN_PAGE_SIZE = 1000
const ETHERSCAN_DELAY_MS = ETHERSCAN_API_KEY ? 250 : 5500
const MASS_UPDATE_TOPIC = "0x7ba170514e8ea35827dbbd10c6d3376ca77ff64b62e4b0a395bac9b142dc81dc"
const DEPLOY_BLOCK = 13_755_675

const TOTAL_MINTED = 28990
const TIER_INITIAL = { 1: 28841, 2: 94, 3: 50, 4: 5 }
const CLASS_DIVISOR = 100_000_000

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function dayKey(ts) {
  return new Date(ts * 1000).toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// 1. Build tier lookup from db.json
// ---------------------------------------------------------------------------
function buildTierMap() {
  console.log("Loading db.json for tier lookup...")
  const db = JSON.parse(readFileSync(join(DATA_DIR, "db.json"), "utf-8"))
  const tokens = db.tokens
  const tierMap = new Map() // tokenId → tier (1-4)
  const tierCounts = { 1: 0, 2: 0, 3: 0, 4: 0 }

  const nullTokenIds = new Set()
  for (let id = 1; id < tokens.length; id++) {
    const entry = tokens[id]
    if (!entry || entry[0] === 0) {
      // Unknown value — default to tier 1 (most common)
      tierMap.set(id, 1)
      tierCounts[1]++
      nullTokenIds.add(id)
      continue
    }
    const tier = Math.floor(entry[0] / CLASS_DIVISOR)
    if (tier >= 1 && tier <= 4) {
      tierMap.set(id, tier)
      tierCounts[tier]++
    } else {
      tierMap.set(id, 1)
      tierCounts[1]++
    }
  }

  console.log(`  Tier distribution (all ${tokens.length - 1} tokens):`)
  console.log(`    T1: ${tierCounts[1]}, T2: ${tierCounts[2]}, T3: ${tierCounts[3]}, T4: ${tierCounts[4]}`)
  return { tierMap, tierCounts, nullTokenIds }
}

// ---------------------------------------------------------------------------
// 2. Fetch all MassUpdate events via Etherscan
// ---------------------------------------------------------------------------
async function fetchMergeEvents() {
  console.log("\nFetching MassUpdate events via Etherscan...")
  if (!ETHERSCAN_API_KEY) {
    console.log("  ⚠️  No ETHERSCAN_API_KEY, using free tier (1 req/5s)")
  }

  const events = []
  let fromBlock = DEPLOY_BLOCK
  let requests = 0

  while (true) {
    const url = new URL(ETHERSCAN_BASE)
    url.searchParams.set("chainid", "1")
    url.searchParams.set("module", "logs")
    url.searchParams.set("action", "getLogs")
    url.searchParams.set("address", MERGE_CONTRACT_ADDRESS)
    url.searchParams.set("topic0", MASS_UPDATE_TOPIC)
    url.searchParams.set("fromBlock", fromBlock.toString())
    url.searchParams.set("toBlock", "latest")
    url.searchParams.set("page", "1")
    url.searchParams.set("offset", ETHERSCAN_PAGE_SIZE.toString())
    if (ETHERSCAN_API_KEY) url.searchParams.set("apikey", ETHERSCAN_API_KEY)

    let json
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url)
        json = await res.json()
        break
      } catch (err) {
        if (attempt < 2) {
          console.warn(`\n  ⚠️  MassUpdate request failed, retrying in 3s...`)
          await sleep(3000)
        } else {
          throw err
        }
      }
    }
    requests++

    if (json.status !== "1" || !Array.isArray(json.result) || json.result.length === 0) {
      if (json.message === "No records found") break
      if (json.result?.length === 0) break
      console.warn(`\n  ⚠️  Etherscan request ${requests}: ${json.message}`)
      break
    }

    for (const log of json.result) {
      events.push({
        burnedId: parseInt(log.topics[1], 16),
        persistId: parseInt(log.topics[2], 16),
        mass: parseInt(log.data, 16),
        blockNumber: parseInt(log.blockNumber, 16),
        timestamp: parseInt(log.timeStamp, 16),
      })
    }

    process.stdout.write(`\r  Request ${requests}: ${events.length} events (from block ${fromBlock})`)

    if (json.result.length >= ETHERSCAN_PAGE_SIZE) {
      const lastBlock = parseInt(json.result[json.result.length - 1].blockNumber, 16)
      fromBlock = lastBlock
      if (fromBlock === parseInt(json.result[0].blockNumber, 16)) {
        fromBlock = lastBlock + 1
      }
    } else {
      break
    }

    await sleep(ETHERSCAN_DELAY_MS)
  }

  // Deduplicate
  const seen = new Set()
  const unique = []
  for (const e of events) {
    const key = `${e.burnedId}-${e.persistId}-${e.blockNumber}`
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(e)
    }
  }

  console.log(`\n  ${unique.length} unique events (${requests} requests)`)
  return unique
}

// ---------------------------------------------------------------------------
// 3. Fetch all Transfer events involving NG Omnibus
// ---------------------------------------------------------------------------
async function fetchOmnibusTransfers() {
  const OMNIBUS_PADDED = "0x" + NIFTY_OMNIBUS_ADDRESS.slice(2).padStart(64, "0")
  console.log("\nFetching Omnibus Transfer events via Etherscan...")

  async function fetchDirection(contractAddr, topicKey, topicVal, label, startBlock = 0) {
    const events = []
    let fromBlock = startBlock
    let requests = 0

    while (true) {
      const url = new URL(ETHERSCAN_BASE)
      url.searchParams.set("chainid", "1")
      url.searchParams.set("module", "logs")
      url.searchParams.set("action", "getLogs")
      url.searchParams.set("address", contractAddr)
      url.searchParams.set("topic0", TRANSFER_TOPIC)
      url.searchParams.set(topicKey, topicVal)
      url.searchParams.set("topic0_" + topicKey.slice(-1) + "_opr", "and")
      url.searchParams.set("fromBlock", fromBlock.toString())
      url.searchParams.set("toBlock", "latest")
      url.searchParams.set("page", "1")
      url.searchParams.set("offset", ETHERSCAN_PAGE_SIZE.toString())
      if (ETHERSCAN_API_KEY) url.searchParams.set("apikey", ETHERSCAN_API_KEY)

      let json
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch(url)
          json = await res.json()
          break
        } catch (err) {
          if (attempt < 2) {
            console.warn(`\n  ⚠️  ${label} request failed, retrying in 3s...`)
            await sleep(3000)
          } else {
            throw err
          }
        }
      }
      requests++

      if (json.status !== "1" || !Array.isArray(json.result) || json.result.length === 0) {
        if (json.message === "No records found") break
        if (json.result?.length === 0) break
        console.warn(`\n  ⚠️  Etherscan ${label} request ${requests}: ${json.message}`)
        break
      }

      for (const log of json.result) {
        events.push({
          timestamp: parseInt(log.timeStamp, 16),
          blockNumber: parseInt(log.blockNumber, 16),
        })
      }

      process.stdout.write(`\r  ${label} request ${requests}: ${events.length} events`)

      if (json.result.length >= ETHERSCAN_PAGE_SIZE) {
        const lastBlock = parseInt(json.result[json.result.length - 1].blockNumber, 16)
        fromBlock = lastBlock
        if (fromBlock === parseInt(json.result[0].blockNumber, 16)) {
          fromBlock = lastBlock + 1
        }
      } else {
        break
      }

      await sleep(ETHERSCAN_DELAY_MS)
    }

    console.log(`\n  ${label}: ${events.length} events (${requests} requests)`)
    return events
  }

  // Only use new contract transfers — migration mints already account for initial state
  // (Old contract tokens were never explicitly transferred out during contract swap,
  //  so including both would double-count tokens)
  const newIn = await fetchDirection(MERGE_CONTRACT_ADDRESS, "topic2", OMNIBUS_PADDED, "IN", DEPLOY_BLOCK)
  const newOut = await fetchDirection(MERGE_CONTRACT_ADDRESS, "topic1", OMNIBUS_PADDED, "OUT", DEPLOY_BLOCK)

  const all = [
    ...newIn.map(e => ({ ...e, delta: 1 })),
    ...newOut.map(e => ({ ...e, delta: -1 })),
  ]
  all.sort((a, b) => a.timestamp - b.timestamp || a.blockNumber - b.blockNumber)

  console.log(`  Total: ${all.length} omnibus transfer events`)
  return all
}

// ---------------------------------------------------------------------------
// 4. Build daily supply history
// ---------------------------------------------------------------------------
// Fix tierMap for null db.json entries: merge only happens within same tier,
// so burned token's tier = persist token's tier
function fixNullTiers(events, tierMap, nullTokenIds) {
  for (const e of events) {
    if (nullTokenIds.has(e.burnedId)) {
      const persistTier = tierMap.get(e.persistId)
      if (persistTier && persistTier > 1) {
        tierMap.set(e.burnedId, persistTier)
      }
    }
  }
}

function buildHistory(events, tierMap, tierCounts, omnibusTransfers) {
  console.log("\nBuilding daily supply history...")

  // Sort events by timestamp, then by blockNumber for stability
  events.sort((a, b) => a.timestamp - b.timestamp || a.blockNumber - b.blockNumber)

  // Running state
  let alive = TOTAL_MINTED
  const tiers = {
    1: TIER_INITIAL[1],
    2: TIER_INITIAL[2],
    3: TIER_INITIAL[3],
    4: TIER_INITIAL[4],
  }
  // Alpha = token with highest mass. Token #1 was initial alpha (from old contract).
  // Compute #1's initial mass by tracing its first merge event:
  // first merge mass = initial mass + burned token's mass at that time.
  // We track each token's mass to compute this.
  const tokenMass = new Map() // tokenId → current mass
  const firstT1Event = events.find(e => e.persistId === 1)
  let initialAlphaMass = 1
  if (firstT1Event) {
    // Trace all events before #1's first merge to build token masses
    for (const e of events) {
      if (e === firstT1Event) break
      // burned token is removed, persist token gets new mass
      tokenMass.delete(e.burnedId)
      tokenMass.set(e.persistId, e.mass)
    }
    const burnedMass = tokenMass.get(firstT1Event.burnedId) || 1
    initialAlphaMass = firstT1Event.mass - burnedMass
  }
  console.log(`  Token #1 initial mass (from old contract): ${initialAlphaMass}`)

  let alphaId = 1
  let alphaMass = initialAlphaMass
  const alphaChanges = [] // { date, tokenId, mass }
  let dayMerges = 0

  // Omnibus running count
  let omnibusCount = 0
  let omnibusIdx = 0 // pointer into sorted omnibusTransfers

  // Start one day before first event to show initial state
  const firstEventDay = dayKey(events[0].timestamp)
  const startD = new Date(firstEventDay + "T00:00:00Z")
  startD.setUTCDate(startD.getUTCDate() - 1)
  const startDate = startD.toISOString().slice(0, 10)
  let currentDay = startDate

  const data = []

  // Apply omnibus transfers up to (and including) the given date
  function applyOmnibusUntil(dateStr) {
    while (omnibusIdx < omnibusTransfers.length) {
      const t = omnibusTransfers[omnibusIdx]
      if (dayKey(t.timestamp) > dateStr) break
      omnibusCount += t.delta
      omnibusIdx++
    }
  }

  function pushDay() {
    applyOmnibusUntil(currentDay)
    data.push([alive, tiers[1], tiers[2], tiers[3], tiers[4], alphaMass, dayMerges, omnibusCount])
  }

  // Push initial state (before any merges)
  pushDay()
  const nextD = new Date(currentDay + "T00:00:00Z")
  nextD.setUTCDate(nextD.getUTCDate() + 1)
  currentDay = nextD.toISOString().slice(0, 10)

  // Apply old contract burns (278 tokens burned before contract swap)
  // Original 285 - 7 erroneously burned by old contract bug (compensated in new contract)
  // Derived: 277 T1 + 1 T3 = 278, based on current alive counts vs initial
  alive -= 278
  tiers[1] -= 277
  tiers[3] -= 1
  dayMerges = 278
  pushDay()
  const nextD2 = new Date(currentDay + "T00:00:00Z")
  nextD2.setUTCDate(nextD2.getUTCDate() + 1)
  currentDay = nextD2.toISOString().slice(0, 10)
  dayMerges = 0

  for (const event of events) {
    const eventDay = dayKey(event.timestamp)

    // Fill any gap days (no merges on those days)
    while (currentDay < eventDay) {
      pushDay()
      dayMerges = 0
      // Advance to next day
      const d = new Date(currentDay + "T00:00:00Z")
      d.setUTCDate(d.getUTCDate() + 1)
      currentDay = d.toISOString().slice(0, 10)
    }

    // Process merge event
    alive--
    const burnedTier = tierMap.get(event.burnedId) || 1
    tiers[burnedTier]--
    // Track alpha by mass
    if (event.mass > alphaMass) {
      const prevAlphaId = alphaId
      alphaMass = event.mass
      alphaId = event.persistId
      if (alphaId !== prevAlphaId) {
        alphaChanges.push({ date: dayKey(event.timestamp), tokenId: alphaId, mass: alphaMass })
      }
    }
    dayMerges++
  }

  // Push the last day
  pushDay()

  // Fill up to today
  const today = new Date().toISOString().slice(0, 10)
  while (currentDay < today) {
    const d = new Date(currentDay + "T00:00:00Z")
    d.setUTCDate(d.getUTCDate() + 1)
    currentDay = d.toISOString().slice(0, 10)
    dayMerges = 0
    pushDay()
  }

  console.log(`  ${data.length} days (${startDate} → ${currentDay})`)
  console.log(`  Final: alive=${alive}, T1=${tiers[1]}, T2=${tiers[2]}, T3=${tiers[3]}, T4=${tiers[4]}, alpha=${alphaMass} (#${alphaId}), omnibus=${omnibusCount}`)
  console.log(`  Alpha changed hands ${alphaChanges.length} times`)

  return { startDate, data, alphaChanges }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("📊 Build Supply History\n")

  const { tierMap, tierCounts, nullTokenIds } = buildTierMap()
  const events = await fetchMergeEvents()

  if (events.length === 0) {
    console.log("No events found. Exiting.")
    return
  }

  fixNullTiers(events, tierMap, nullTokenIds)
  const omnibusTransfers = await fetchOmnibusTransfers()
  const history = buildHistory(events, tierMap, tierCounts, omnibusTransfers)

  const json = JSON.stringify(history)
  writeFileSync(join(DATA_DIR, "supply_history.json"), json)
  console.log(`\n  ✅ supply_history.json written (${(json.length / 1024).toFixed(0)} KB)`)
  console.log("\nDone! ✅")
}

main().catch(err => { console.error("Fatal:", err); process.exit(1) })
