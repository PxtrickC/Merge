import { ethers } from "ethers"
import { writeFileSync, mkdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { MERGE_CONTRACT_ADDRESS, MERGE_ABI, decodeValue } from "../utils/contract.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, "..", "public", "data")

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const ALCHEMY_API_KEY = process.env.NUXT_PUBLIC_ALCHEMY_API_KEY
if (!ALCHEMY_API_KEY) {
  console.error("Missing NUXT_PUBLIC_ALCHEMY_API_KEY env var")
  process.exit(1)
}
const RPC_URL = `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`

// Rate-limit friendly settings for Alchemy free tier
const BATCH_SIZE = 10           // concurrent tokens per batch
const BATCH_DELAY_MS = 2000     // delay between batches (free tier ~30 CU/s)
const MAX_TOKEN_ID = 28738      // known max token ID for Merge
const DEPLOY_BLOCK = 13_755_675 // contract deploy block

// Etherscan API config (for fetching full event history)
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || ""
const ETHERSCAN_BASE = "https://api.etherscan.io/v2/api"
const ETHERSCAN_PAGE_SIZE = 1000
const ETHERSCAN_DELAY_MS = ETHERSCAN_API_KEY ? 250 : 5500 // 5/s with key, 1/5s without
const MASS_UPDATE_TOPIC = "0x7ba170514e8ea35827dbbd10c6d3376ca77ff64b62e4b0a395bac9b142dc81dc"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const provider = new ethers.JsonRpcProvider(RPC_URL)
const contract = new ethers.Contract(MERGE_CONTRACT_ADDRESS, MERGE_ABI, provider)

function writeJSON(filename, data) {
  writeFileSync(join(DATA_DIR, filename), JSON.stringify(data))
  console.log(`  ✅ ${filename}`)
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

// ---------------------------------------------------------------------------
// 1. Fetch all token data (with rate limiting)
// ---------------------------------------------------------------------------
async function fetchAllTokens() {
  // Pin to a specific block for consistent snapshot
  const snapshotBlock = await provider.getBlockNumber()
  console.log(`Snapshot block: ${snapshotBlock}`)

  const totalSupply = Number(await contract.totalSupply({ blockTag: snapshotBlock }))
  console.log(`Total supply (alive tokens): ${totalSupply}`)
  console.log(`Scanning token IDs 1..${MAX_TOKEN_ID} (batch size: ${BATCH_SIZE}, delay: ${BATCH_DELAY_MS}ms)`)

  const tokens = []
  let errors = 0

  for (let start = 1; start <= MAX_TOKEN_ID; start += BATCH_SIZE) {
    const end = Math.min(start + BATCH_SIZE - 1, MAX_TOKEN_ID)
    const batch = []

    for (let id = start; id <= end; id++) {
      batch.push(fetchSingleToken(id, 3, snapshotBlock))
    }

    const results = await Promise.all(batch)
    for (const r of results) {
      if (r === null) continue // token doesn't exist (burned)
      if (r === false) { errors++; continue } // RPC error
      tokens.push(r)
    }

    const pct = Math.min(100, Math.round((end / MAX_TOKEN_ID) * 100))
    process.stdout.write(
      `\r  Progress: ${pct}% (${tokens.length} tokens, ${errors} errors, scanning ID ${start}-${end})`
    )

    // Rate limit delay
    await sleep(BATCH_DELAY_MS)

    // Early exit if we've found all tokens
    if (tokens.length >= totalSupply) {
      console.log(`\n  Reached totalSupply (${totalSupply}), stopping scan early`)
      break
    }
  }

  console.log(`\n  Found ${tokens.length} alive tokens (${errors} RPC errors)`)

  if (errors > 0 && tokens.length < totalSupply * 0.95) {
    console.warn(`  ⚠️  Warning: Found significantly fewer tokens than totalSupply.`)
    console.warn(`     Expected ~${totalSupply}, got ${tokens.length}. Consider re-running sync.`)
  }

  return { tokens, totalSupply }
}

async function fetchSingleToken(id, retries = 3, blockTag = "latest") {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Only 2 RPC calls per token (decode locally), pinned to snapshot block
      const callOpts = { blockTag }
      const [value, mergeCount] = await Promise.all([
        contract.getValueOf(id, callOpts),
        contract.getMergeCount(id, callOpts),
      ])

      const { class: classVal, mass } = decodeValue(value)
      return {
        id,
        mass,
        class: classVal,
        tier: classVal, // class = tier directly
        merges: Number(mergeCount),
      }
    } catch (err) {
      const msg = err.message || ""
      // "nonexistent token" means the token was burned (merged)
      if (msg.includes("nonexistent")) return null

      if (attempt < retries) {
        await sleep(500 * attempt) // exponential backoff
        continue
      }
      return false // RPC error after retries
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Fetch ALL merge events (MassUpdate) via Etherscan API
//    Uses block-range pagination to bypass Etherscan's page limit
// ---------------------------------------------------------------------------
async function fetchMergeEvents() {
  console.log("Fetching ALL MassUpdate events via Etherscan API (block-range pagination)...")
  if (!ETHERSCAN_API_KEY) {
    console.log("  ⚠️  No ETHERSCAN_API_KEY set, using free tier (1 req/5s). Add key to .env for faster sync.")
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

    const res = await fetch(url)
    const json = await res.json()
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

    // If we got a full page, continue from the last event's block
    if (json.result.length >= ETHERSCAN_PAGE_SIZE) {
      const lastBlock = parseInt(json.result[json.result.length - 1].blockNumber, 16)
      fromBlock = lastBlock // start from same block (may have more events in it)
      // If fromBlock didn't advance, increment by 1 to avoid infinite loop
      if (fromBlock === parseInt(json.result[0].blockNumber, 16)) {
        fromBlock = lastBlock + 1
      }
    } else {
      break // got less than a full page, we're done
    }

    await sleep(ETHERSCAN_DELAY_MS)
  }

  // Deduplicate (block boundary overlap may cause duplicates)
  const seen = new Set()
  const unique = []
  for (const e of events) {
    const key = `${e.burnedId}-${e.persistId}-${e.blockNumber}`
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(e)
    }
  }

  console.log(`\n  Found ${unique.length} unique events (${events.length} raw, ${requests} requests)`)
  return unique
}

// ---------------------------------------------------------------------------
// 3. Process and write JSON files
// ---------------------------------------------------------------------------
// Write token-derived JSON files (requires full token data)
function writeTokenFiles(tokens, totalSupply) {
  const mergedCount = MAX_TOKEN_ID - totalSupply
  const totalMass = tokens.reduce((sum, t) => sum + t.mass, 0)
  const alphaMass = Math.max(...tokens.map((t) => t.mass))

  writeJSON("stats.json", {
    token_count: totalSupply,
    merged_count: mergedCount,
    total_mass: totalMass,
    alpha_mass: alphaMass,
  })

  const massSorted = [...tokens].sort((a, b) => b.mass - a.mass)
  writeJSON("mass_top.json", massSorted.slice(0, 100).map((t) => ({ id: t.id, tier: t.tier, mass: t.mass })))

  const blueTokens = tokens.filter((t) => t.tier === 3).sort((a, b) => b.mass - a.mass)
  writeJSON("blue_mass.json", blueTokens.slice(0, 100).map((t) => ({ id: t.id, tier: t.tier, mass: t.mass })))

  const mergesSorted = [...tokens].filter((t) => t.merges > 0).sort((a, b) => b.merges - a.merges)
  writeJSON("merges_top.json", mergesSorted.slice(0, 100).map((t) => ({ id: t.id, tier: t.tier, mass: t.mass, merges: t.merges })))

  // --- mass_repartition.json (bucket-based) ---
  const BUCKETS = [1, 2, 3, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 15000]
  const bucketCounts = new Array(BUCKETS.length).fill(0)
  for (const t of tokens) {
    let placed = false
    for (let i = 0; i < BUCKETS.length - 1; i++) {
      if (t.mass < BUCKETS[i + 1]) {
        bucketCounts[i]++
        placed = true
        break
      }
    }
    if (!placed) bucketCounts[BUCKETS.length - 1]++
  }
  const repartition = []
  for (let i = 0; i < BUCKETS.length; i++) {
    const label = i < BUCKETS.length - 1 ? `${BUCKETS[i]}-${BUCKETS[i + 1] - 1}` : `${BUCKETS[i]}+`
    repartition.push({ label: `m(${label})`, min: BUCKETS[i], count: bucketCounts[i] })
  }
  writeJSON("mass_repartition.json", repartition)

  // --- matter.json ---
  const matterTokens = {
    class1: tokens.filter((t) => t.class === 1),
    class2: tokens.filter((t) => t.class === 2),
    class3: tokens.filter((t) => t.class === 3),
    class4: tokens.filter((t) => t.class === 4),
  }
  writeJSON("matter.json", {
    unidentified_count: matterTokens.class3.length,
    antimatter_count: matterTokens.class2.length,
    masses: {
      positive: matterTokens.class1.reduce((s, t) => s + t.mass, 0) +
                matterTokens.class4.reduce((s, t) => s + t.mass, 0),
      unidentified: matterTokens.class3.reduce((s, t) => s + t.mass, 0),
      negative: matterTokens.class2.reduce((s, t) => s + t.mass, 0),
    },
  })

  writeJSON("token_28xxx.json", { count: tokens.filter((t) => t.id > 28000).length })

  console.log(`  Token files: ${tokens.length} tokens, mass ${totalMass}, alpha ${alphaMass}`)
  console.log(`  Class distribution: c1=${matterTokens.class1.length} c2=${matterTokens.class2.length} c3=${matterTokens.class3.length} c4=${matterTokens.class4.length}`)
}

// Write event-derived JSON files
async function writeEventFiles(mergeEvents, tokenById) {
  const mergeMap = new Map()
  const mergedIntoMap = new Map()

  for (const event of mergeEvents) {
    mergeMap.set(event.burnedId, {
      persistId: event.persistId,
      mass: event.mass,
      blockNumber: event.blockNumber,
      timestamp: event.timestamp,
    })
    if (!mergedIntoMap.has(event.persistId)) mergedIntoMap.set(event.persistId, [])
    mergedIntoMap.get(event.persistId).push({
      id: event.burnedId,
      mass: event.mass,
      blockNumber: event.blockNumber,
      timestamp: event.timestamp,
    })
  }

  // --- latest_merges.json ---
  const sortedEvents = [...mergeEvents]
    .sort((a, b) => b.blockNumber - a.blockNumber)
    .slice(0, 100)

  console.log(`  Fetching burned token data for ${sortedEvents.length} latest merge events...`)
  const latestMerges = []
  for (let i = 0; i < sortedEvents.length; i += 5) {
    const batch = sortedEvents.slice(i, i + 5)
    const results = await Promise.all(
      batch.map(async (event) => {
        const persistToken = tokenById.get(event.persistId)
        let burnedMass = 0
        let burnedTier = 0
        try {
          const value = await contract.getValueOf(event.burnedId, { blockTag: event.blockNumber - 1 })
          const decoded = decodeValue(value)
          burnedMass = decoded.mass
          burnedTier = decoded.class
        } catch {
          // Could not fetch historical state
        }
        return {
          id: event.burnedId,
          mass: burnedMass,
          tier: burnedTier,
          merged_on: event.timestamp ? new Date(event.timestamp * 1000).toISOString() : null,
          merged_to: {
            id: event.persistId,
            mass: event.mass,
            tier: persistToken?.tier ?? 0,
          },
        }
      })
    )
    latestMerges.push(...results)
    await sleep(500)
  }
  writeJSON("latest_merges.json", latestMerges)

  // --- merged_into.json ---
  const burnedDataById = new Map()
  for (const m of latestMerges) {
    burnedDataById.set(m.id, { mass: m.mass, tier: m.tier })
  }
  const mergedInto = {}
  for (const [persistId, burned] of mergedIntoMap) {
    mergedInto[persistId] = burned.map((b) => {
      const recovered = burnedDataById.get(b.id)
      return { id: b.id, tier: recovered?.tier ?? 0, mass: recovered?.mass ?? 0 }
    })
  }
  writeJSON("merged_into.json", mergedInto)

  // --- merge_history.json ---
  const mergeHistory = {}
  for (const [burnedId, info] of mergeMap) {
    mergeHistory[burnedId] = {
      merged_to: info.persistId,
      merged_on: info.timestamp ? new Date(info.timestamp * 1000).toISOString() : null,
    }
  }
  writeJSON("merge_history.json", mergeHistory)

  console.log(`  Event files: ${mergeEvents.length} events`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  mkdirSync(DATA_DIR, { recursive: true })

  const eventsOnly = process.argv.includes("--events-only")

  if (eventsOnly) {
    // Only re-fetch events, skip token scan, don't overwrite token files
    console.log("🔄 Merge Data Sync (events only)\n")
    const { readFileSync } = await import("fs")
    // Load token lookup from cached top lists (for persist token tier in latest_merges)
    const tokenMap = new Map()
    for (const f of ["mass_top.json", "blue_mass.json", "merges_top.json"]) {
      try {
        const arr = JSON.parse(readFileSync(join(DATA_DIR, f), "utf-8"))
        for (const t of arr) tokenMap.set(t.id, t)
      } catch {}
    }
    console.log(`  Loaded ${tokenMap.size} tokens from cached JSON (for tier lookup)`)
    const mergeEvents = await fetchMergeEvents()
    await writeEventFiles(mergeEvents, tokenMap)
  } else {
    console.log("🔄 Merge Data Sync (full)\n")
    const { tokens, totalSupply } = await fetchAllTokens()
    const tokenById = new Map()
    for (const t of tokens) tokenById.set(t.id, t)
    console.log("\nWriting token files...")
    writeTokenFiles(tokens, totalSupply)
    const mergeEvents = await fetchMergeEvents()
    console.log("Writing event files...")
    await writeEventFiles(mergeEvents, tokenById)
  }

  console.log("\nDone! ✅")
}

main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
