/**
 * Incremental db.json update — designed for GitHub Actions / CI.
 *
 * Zero RPC state queries needed! All data derived from event logs + existing db.json:
 *   - event.mass = persist token's new mass after merge
 *   - persist token's tier doesn't change → newValue = tier * 10^8 + event.mass
 *   - burned token's value already in db.json
 *
 * Only RPC calls: getLogs (event scan) + getBlock (timestamps for latest_merges.json)
 *
 * Usage:
 *   node scripts/update-db.mjs    # scan events from db.block+1 to latest
 */
import { ethers } from "ethers"
import { readFileSync, writeFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { MERGE_CONTRACT_ADDRESS, MERGE_ABI, decodeValue } from "../utils/contract.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, "..", "public", "data")

const CLASS_DIVISOR = 100_000_000

const ALCHEMY_API_KEY = process.env.NUXT_PUBLIC_ALCHEMY_API_KEY
if (!ALCHEMY_API_KEY) {
  console.error("Missing NUXT_PUBLIC_ALCHEMY_API_KEY env var")
  process.exit(1)
}
const RPC_URL = `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
const MASS_UPDATE_TOPIC = "0x7ba170514e8ea35827dbbd10c6d3376ca77ff64b62e4b0a395bac9b142dc81dc"

function readJSON(filename) {
  return JSON.parse(readFileSync(join(DATA_DIR, filename), "utf-8"))
}

function writeJSON(filename, data) {
  writeFileSync(join(DATA_DIR, filename), JSON.stringify(data))
  console.log(`  ✅ ${filename}`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("🔄 Incremental db.json update\n")

  const provider = new ethers.JsonRpcProvider(RPC_URL)
  const db = readJSON("db.json")
  const tokens = db.tokens
  const fromBlock = (db.block || 0) + 1

  // 1. Fetch new MassUpdate events (log query only, no state query)
  console.log(`  Scanning events from block ${fromBlock}...`)
  const logs = await provider.getLogs({
    address: MERGE_CONTRACT_ADDRESS,
    topics: [MASS_UPDATE_TOPIC],
    fromBlock,
    toBlock: "latest",
  })

  const events = logs.map(log => ({
    burnedId: parseInt(log.topics[1], 16),
    persistId: parseInt(log.topics[2], 16),
    mass: parseInt(log.data, 16),
    blockNumber: log.blockNumber,
  }))

  console.log(`  Found ${events.length} new events`)

  if (events.length === 0) {
    console.log("\n  db.json is up to date.")
    return
  }

  // 2. Apply each event — pure computation, no RPC state queries
  const latestMerges = readJSON("latest_merges.json")
  // Collect unique block numbers for timestamp lookup
  const blockNumbers = new Set(events.map(e => e.blockNumber))

  // Batch fetch block timestamps (1 RPC per unique block, for latest_merges.json)
  console.log(`  Fetching timestamps for ${blockNumbers.size} blocks...`)
  const blockTimestamps = new Map()
  for (const bn of blockNumbers) {
    try {
      const block = await provider.getBlock(bn)
      blockTimestamps.set(bn, block.timestamp)
    } catch {
      blockTimestamps.set(bn, Math.floor(Date.now() / 1000))
    }
  }

  for (const { burnedId, persistId, mass, blockNumber } of events) {
    // Ensure array is long enough
    while (tokens.length <= Math.max(burnedId, persistId)) tokens.push(null)

    // Burned token: keep existing value, mark as merged
    const burnedValue = tokens[burnedId]?.[0] ?? 0
    const burnedMerges = tokens[burnedId]?.[1] ?? 0
    tokens[burnedId] = [burnedValue, burnedMerges, persistId]

    // Persist token: derive new value from existing tier + event mass
    const existingEntry = tokens[persistId]
    const existingTier = existingEntry ? Math.floor(existingEntry[0] / CLASS_DIVISOR) : 1
    const newValue = existingTier * CLASS_DIVISOR + mass
    const persistMerges = (existingEntry?.[1] ?? 0) + 1
    tokens[persistId] = [newValue, persistMerges, 0]

    // Append to latest_merges
    const burnedDecoded = decodeValue(burnedValue)
    const timestamp = blockTimestamps.get(blockNumber)
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

    console.log(`    #${burnedId} (m=${burnedDecoded.mass}) → #${persistId} (m=${mass}) [block ${blockNumber}]`)
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
