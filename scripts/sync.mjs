import { readFileSync, writeFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { MERGE_CONTRACT_ADDRESS, NIFTY_OMNIBUS_ADDRESS, decodeValue } from "../utils/contract.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, "..", "public", "data")

const CLASS_DIVISOR = 100_000_000

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const ALCHEMY_API_KEY = process.env.NUXT_PUBLIC_ALCHEMY_API_KEY
if (!ALCHEMY_API_KEY) {
  console.error("Missing NUXT_PUBLIC_ALCHEMY_API_KEY env var")
  process.exit(1)
}
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || ""
const ETHERSCAN_BASE = "https://api.etherscan.io/v2/api"
const ETHERSCAN_PAGE_SIZE = 1000
const ETHERSCAN_DELAY_MS = ETHERSCAN_API_KEY ? 250 : 5500
const MASS_UPDATE_TOPIC = "0x7ba170514e8ea35827dbbd10c6d3376ca77ff64b62e4b0a395bac9b142dc81dc"

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function readJSON(filename) {
  return JSON.parse(readFileSync(join(DATA_DIR, filename), "utf-8"))
}

function writeJSON(filename, data) {
  writeFileSync(join(DATA_DIR, filename), JSON.stringify(data))
}

// ---------------------------------------------------------------------------
// 1. Fetch new MassUpdate events since lastBlock
// ---------------------------------------------------------------------------
async function fetchNewEvents(fromBlock) {
  console.log(`Fetching MassUpdate events from block ${fromBlock}...`)

  const events = []
  let currentFrom = fromBlock
  let requests = 0

  while (true) {
    const url = new URL(ETHERSCAN_BASE)
    url.searchParams.set("chainid", "1")
    url.searchParams.set("module", "logs")
    url.searchParams.set("action", "getLogs")
    url.searchParams.set("address", MERGE_CONTRACT_ADDRESS)
    url.searchParams.set("topic0", MASS_UPDATE_TOPIC)
    url.searchParams.set("fromBlock", currentFrom.toString())
    url.searchParams.set("toBlock", "latest")
    url.searchParams.set("page", "1")
    url.searchParams.set("offset", ETHERSCAN_PAGE_SIZE.toString())
    if (ETHERSCAN_API_KEY) url.searchParams.set("apikey", ETHERSCAN_API_KEY)

    const res = await fetch(url)
    const json = await res.json()
    requests++

    if (json.status !== "1" || !Array.isArray(json.result) || json.result.length === 0) {
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

    process.stdout.write(`\r  Request ${requests}: ${events.length} events`)

    if (json.result.length >= ETHERSCAN_PAGE_SIZE) {
      const lastBlock = parseInt(json.result[json.result.length - 1].blockNumber, 16)
      if (lastBlock === currentFrom) currentFrom = lastBlock + 1
      else currentFrom = lastBlock
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

  if (unique.length) console.log(`\n  ${unique.length} new events`)
  else console.log("  No new events")
  return unique.sort((a, b) => a.blockNumber - b.blockNumber)
}

// ---------------------------------------------------------------------------
// 2. Apply events to db.json (same logic as watch.mjs)
// ---------------------------------------------------------------------------
function applyEvents(db, events) {
  const tokens = db.tokens

  for (const event of events) {
    const { burnedId, persistId, mass: newMass, blockNumber } = event

    while (tokens.length <= Math.max(burnedId, persistId)) tokens.push(null)

    // Burned token: keep existing value, mark as merged
    const burnedValue = tokens[burnedId]?.[0] ?? 0
    const burnedMerges = tokens[burnedId]?.[1] ?? 0
    tokens[burnedId] = [burnedValue, burnedMerges, persistId]

    // Persist token: derive new value from existing tier + event mass
    const existingEntry = tokens[persistId]
    const existingTier = existingEntry ? Math.floor(existingEntry[0] / CLASS_DIVISOR) : 1
    const newValue = existingTier * CLASS_DIVISOR + newMass
    const persistMerges = (existingEntry?.[1] ?? 0) + 1
    tokens[persistId] = [newValue, persistMerges, 0]

    db.block = blockNumber

    const burnedDecoded = burnedValue > 0 ? decodeValue(burnedValue) : { class: 0, mass: 0 }
    console.log(`  #${burnedId} (m=${burnedDecoded.mass}) → #${persistId} (m=${newMass})`)
  }

  return db
}

// ---------------------------------------------------------------------------
// 3. Update latest_merges.json
// ---------------------------------------------------------------------------
function updateLatestMerges(db, events) {
  const latestMerges = readJSON("latest_merges.json")

  // Prepend new events (newest first)
  const newEntries = [...events].reverse().map((event) => {
    const burnedEntry = db.tokens[event.burnedId]
    let burnedTier = 0, burnedMass = 0
    if (burnedEntry && burnedEntry[0] > 0) {
      const decoded = decodeValue(burnedEntry[0])
      burnedTier = decoded.class
      burnedMass = decoded.mass
    }

    const persistEntry = db.tokens[event.persistId]
    const persistTier = persistEntry ? Math.floor(persistEntry[0] / CLASS_DIVISOR) : 0

    return {
      id: event.burnedId,
      mass: burnedMass,
      tier: burnedTier,
      merged_on: event.timestamp ? new Date(event.timestamp * 1000).toISOString() : null,
      merged_to: {
        id: event.persistId,
        mass: event.mass,
        tier: persistTier,
      },
    }
  })

  latestMerges.unshift(...newEntries)
  latestMerges.splice(100)
  writeJSON("latest_merges.json", latestMerges)
  console.log(`  ✅ latest_merges.json (added ${newEntries.length})`)
}

// ---------------------------------------------------------------------------
// 4. Update supply_history.json
// ---------------------------------------------------------------------------
async function updateSupplyHistory(db, events) {
  try {
    const history = readJSON("supply_history.json")
    const startDate = new Date(history.startDate + "T00:00:00Z")
    for (const event of events) {
      const mergedOn = event.timestamp
        ? new Date(event.timestamp * 1000).toISOString()
        : new Date().toISOString()
      const eventDate = mergedOn.slice(0, 10)
      const dayIndex = Math.floor((new Date(eventDate + "T00:00:00Z") - startDate) / 86400000)

      while (history.data.length <= dayIndex) {
        const prev = history.data[history.data.length - 1]
        history.data.push([prev[0], prev[1], prev[2], prev[3], prev[4], prev[5], 0, prev[7] ?? 0, prev[8] ?? 0])
      }

      const row = history.data[dayIndex]
      row[0]-- // alive
      const burnedValue = db.tokens[event.burnedId]?.[0] ?? 0
      const burnedTier = burnedValue > 0 ? decodeValue(burnedValue).class : 1
      if (burnedTier >= 1 && burnedTier <= 4) row[burnedTier]--
      if (event.mass > row[5]) row[5] = event.mass // alpha mass
      row[6]++ // merge count
    }

    // Update omnibus count AND mass via Alchemy NFT API
    try {
      const omnibusTokenIds = []
      let pageKey
      while (true) {
        const nftUrl = new URL(`https://eth-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}/getNFTsForOwner`)
        nftUrl.searchParams.set("owner", NIFTY_OMNIBUS_ADDRESS)
        nftUrl.searchParams.set("contractAddresses[]", MERGE_CONTRACT_ADDRESS)
        nftUrl.searchParams.set("withMetadata", "false")
        nftUrl.searchParams.set("pageSize", "100")
        if (pageKey) nftUrl.searchParams.set("pageKey", pageKey)

        const nftRes = await fetch(nftUrl)
        const nftJson = await nftRes.json()
        for (const nft of (nftJson.ownedNfts || [])) {
          omnibusTokenIds.push(parseInt(nft.tokenId))
        }
        if (nftJson.pageKey) { pageKey = nftJson.pageKey } else { break }
      }

      let omnibusMass = 0
      for (const id of omnibusTokenIds) {
        const entry = db.tokens[id]
        if (entry && entry[0] > 0) {
          omnibusMass += entry[0] % CLASS_DIVISOR
        }
      }

      const lastRow = history.data[history.data.length - 1]
      lastRow[7] = omnibusTokenIds.length
      lastRow[8] = omnibusMass
      console.log(`  Omnibus: ${omnibusTokenIds.length} tokens, mass=${omnibusMass}`)
    } catch (err) {
      console.log(`  ⚠️  Omnibus update failed: ${err.message}`)
    }

    writeJSON("supply_history.json", history)
    console.log(`  ✅ supply_history.json`)
  } catch (err) {
    console.log(`  ⚠️  supply_history.json skipped: ${err.message}`)
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("🔄 Incremental sync\n")

  const db = readJSON("db.json")
  const lastBlock = db.block
  console.log(`Last synced block: ${lastBlock}`)

  const events = await fetchNewEvents(lastBlock + 1)

  if (events.length === 0) {
    console.log("\nAlready up to date! ✅")
    return
  }

  console.log(`\nApplying ${events.length} events...`)
  applyEvents(db, events)
  writeJSON("db.json", db)
  console.log(`  ✅ db.json (block: ${db.block})`)

  updateLatestMerges(db, events)
  await updateSupplyHistory(db, events)

  console.log("\nDone! ✅")
}

main().catch(err => { console.error("Fatal:", err); process.exit(1) })
