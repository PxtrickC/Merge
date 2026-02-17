/**
 * Incremental db.json update — designed for GitHub Actions / CI.
 *
 * Uses Etherscan API for event scanning (no block range limit).
 * Uses Alchemy RPC only for block timestamps.
 *
 * Usage:
 *   node scripts/update-db.mjs    # scan events from db.block+1 to latest
 */
import { ethers } from "ethers"
import { readFileSync, writeFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { MERGE_CONTRACT_ADDRESS, decodeValue } from "../utils/contract.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, "..", "public", "data")

const CLASS_DIVISOR = 100_000_000
const MASS_UPDATE_TOPIC = "0x7ba170514e8ea35827dbbd10c6d3376ca77ff64b62e4b0a395bac9b142dc81dc"
const ETHERSCAN_BASE = "https://api.etherscan.io/v2/api"

const ALCHEMY_API_KEY = process.env.NUXT_PUBLIC_ALCHEMY_API_KEY
if (!ALCHEMY_API_KEY) {
  console.error("Missing NUXT_PUBLIC_ALCHEMY_API_KEY env var")
  process.exit(1)
}
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || ""
const RPC_URL = `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`

function readJSON(filename) {
  return JSON.parse(readFileSync(join(DATA_DIR, filename), "utf-8"))
}

function writeJSON(filename, data) {
  writeFileSync(join(DATA_DIR, filename), JSON.stringify(data))
  console.log(`  ✅ ${filename}`)
}

async function fetchEventsFromEtherscan(fromBlock) {
  const allLogs = []
  let currentFrom = fromBlock

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
    url.searchParams.set("offset", "1000")
    if (ETHERSCAN_API_KEY) url.searchParams.set("apikey", ETHERSCAN_API_KEY)

    const res = await fetch(url)
    const json = await res.json()

    if (json.status !== "1" || !Array.isArray(json.result) || json.result.length === 0) break

    for (const log of json.result) {
      allLogs.push({
        burnedId: parseInt(log.topics[1], 16),
        persistId: parseInt(log.topics[2], 16),
        mass: parseInt(log.data, 16),
        blockNumber: parseInt(log.blockNumber, 16),
        timestamp: parseInt(log.timeStamp, 16),
      })
    }

    console.log(`    Fetched ${json.result.length} logs from block ${currentFrom}...`)

    if (json.result.length < 1000) break
    const lastBlock = parseInt(json.result[json.result.length - 1].blockNumber, 16)
    if (lastBlock <= currentFrom) { currentFrom = lastBlock + 1 } else { currentFrom = lastBlock }

    // Rate limit
    await new Promise(r => setTimeout(r, 300))
  }

  return allLogs
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("🔄 Incremental db.json update\n")

  const db = readJSON("db.json")
  const tokens = db.tokens
  const fromBlock = (db.block || 0) + 1

  // 1. Fetch new MassUpdate events via Etherscan API
  console.log(`  Scanning events from block ${fromBlock} via Etherscan...`)
  const events = await fetchEventsFromEtherscan(fromBlock)

  console.log(`  Found ${events.length} new events`)

  if (events.length === 0) {
    console.log("\n  db.json is up to date.")
    return
  }

  // 2. Apply each event — pure computation, no RPC state queries
  const latestMerges = readJSON("latest_merges.json")

  for (const { burnedId, persistId, mass, blockNumber, timestamp } of events) {
    // persistId === 0 means burned without merge target (sent to dead address)
    const effectivePersistId = persistId || burnedId

    // Ensure array is long enough
    while (tokens.length <= Math.max(burnedId, effectivePersistId)) tokens.push(null)

    // Burned token: keep existing value, mark as merged
    const burnedValue = tokens[burnedId]?.[0] ?? 0
    const burnedMerges = tokens[burnedId]?.[1] ?? 0
    tokens[burnedId] = [burnedValue, burnedMerges, effectivePersistId]

    // Persist token: update only if a real merge (persistId !== 0)
    if (persistId !== 0) {
      const existingEntry = tokens[persistId]
      const existingTier = existingEntry ? Math.floor(existingEntry[0] / CLASS_DIVISOR) : 1
      const newValue = existingTier * CLASS_DIVISOR + mass
      const persistMerges = (existingEntry?.[1] ?? 0) + 1
      tokens[persistId] = [newValue, persistMerges, 0]
    }

    // Append to latest_merges
    const burnedDecoded = decodeValue(burnedValue)
    if (persistId !== 0) {
      const existingEntry = tokens[persistId]
      const existingTier = existingEntry ? Math.floor(existingEntry[0] / CLASS_DIVISOR) : 1
      latestMerges.unshift({
        id: burnedId,
        mass: burnedDecoded.mass,
        tier: burnedDecoded.class,
        merged_on: new Date(timestamp * 1000).toISOString(),
        merged_to: {
          id: persistId,
          mass,
          tier: existingTier,
        },
      })
    }

    const label = persistId === 0 ? 'BURNED (dead)' : `#${persistId} (m=${mass})`
    console.log(`    #${burnedId} (m=${burnedDecoded.mass}) → ${label} [block ${blockNumber}]`)
  }

  // 3. Write results
  db.block = events[events.length - 1].blockNumber
  latestMerges.splice(100)

  writeJSON("db.json", db)
  writeJSON("latest_merges.json", latestMerges)

  console.log(`\n  Applied ${events.length} events. Block: ${db.block}`)
  console.log("\nDone! ✅")
}

main().catch(err => { console.error("Fatal:", err); process.exit(1) })
