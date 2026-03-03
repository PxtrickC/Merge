/**
 * Patch db.json with MassUpdate events from the OLD merge contract.
 * Old contract: 0x27d270b7d58d15d455c85c02286413075f3c8a31
 * These 278 tokens were merged before the contract migration and show as null in db.json.
 *
 * Usage: source .env && node scripts/patch-old-contract.mjs
 */
import { ethers } from "ethers"
import { readFileSync, writeFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { MERGE_ABI, decodeValue } from "../utils/contract.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, "..", "public", "data")

const ALCHEMY_API_KEY = process.env.NUXT_PUBLIC_ALCHEMY_API_KEY
if (!ALCHEMY_API_KEY) {
  console.error("Missing NUXT_PUBLIC_ALCHEMY_API_KEY env var")
  process.exit(1)
}
const RPC_URL = `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`

const OLD_CONTRACT = "0x27d270b7d58d15d455c85c02286413075f3c8a31"
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || ""
const ETHERSCAN_BASE = "https://api.etherscan.io/v2/api"
const ETHERSCAN_DELAY_MS = ETHERSCAN_API_KEY ? 250 : 5500
const MASS_UPDATE_TOPIC = "0x7ba170514e8ea35827dbbd10c6d3376ca77ff64b62e4b0a395bac9b142dc81dc"

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ---------------------------------------------------------------------------
// 1. Find null token IDs in current db.json
// ---------------------------------------------------------------------------
function findNullTokens(db) {
  const nullIds = new Set()
  for (let i = 1; i < db.tokens.length; i++) {
    if (!db.tokens[i]) nullIds.add(i)
  }
  return nullIds
}

// ---------------------------------------------------------------------------
// 2. Fetch MassUpdate events from old contract via Etherscan
// ---------------------------------------------------------------------------
async function fetchOldContractEvents() {
  console.log(`Fetching MassUpdate events from old contract ${OLD_CONTRACT}...`)

  const events = []
  let fromBlock = 13_700_000 // old contract era
  let requests = 0

  while (true) {
    const url = new URL(ETHERSCAN_BASE)
    url.searchParams.set("chainid", "1")
    url.searchParams.set("module", "logs")
    url.searchParams.set("action", "getLogs")
    url.searchParams.set("address", OLD_CONTRACT)
    url.searchParams.set("topic0", MASS_UPDATE_TOPIC)
    url.searchParams.set("fromBlock", fromBlock.toString())
    url.searchParams.set("toBlock", "latest")
    url.searchParams.set("page", "1")
    url.searchParams.set("offset", "1000")
    if (ETHERSCAN_API_KEY) url.searchParams.set("apikey", ETHERSCAN_API_KEY)

    const res = await fetch(url)
    const json = await res.json()
    requests++

    if (json.status !== "1" || !Array.isArray(json.result) || json.result.length === 0) break

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

    if (json.result.length >= 1000) {
      const lastBlock = parseInt(json.result[json.result.length - 1].blockNumber, 16)
      if (lastBlock === fromBlock) fromBlock = lastBlock + 1
      else fromBlock = lastBlock
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

  console.log(`\n  ${unique.length} events from old contract (${requests} requests)`)
  return unique
}

// ---------------------------------------------------------------------------
// 3. Fetch burned token values via archive RPC (block before burn)
// ---------------------------------------------------------------------------
async function fetchBurnedValues(events, nullIds) {
  // Only care about events where burnedId is in our null set
  const relevant = events.filter(e => nullIds.has(e.burnedId))
  console.log(`\n${relevant.length} events match null tokens in db.json`)

  if (relevant.length === 0) return new Map()

  const provider = new ethers.JsonRpcProvider(RPC_URL)
  // Use the OLD contract for archive calls
  const contract = new ethers.Contract(OLD_CONTRACT, MERGE_ABI, provider)

  const results = new Map() // burnedId → { value, persistId, mass }
  const failed = []

  for (let i = 0; i < relevant.length; i++) {
    const e = relevant[i]
    try {
      const value = await contract.getValueOf(e.burnedId, { blockTag: e.blockNumber - 1 })
      const numValue = Number(value)
      if (numValue > 0) {
        const decoded = decodeValue(numValue)
        results.set(e.burnedId, {
          value: numValue,
          persistId: e.persistId,
          mass: decoded.mass,
          tier: decoded.class,
        })
        console.log(`  ✅ #${e.burnedId}: tier=${decoded.class}, mass=${decoded.mass} → #${e.persistId}`)
      } else {
        failed.push(e.burnedId)
        console.log(`  ⚠️  #${e.burnedId}: value=0`)
      }
    } catch (err) {
      failed.push(e.burnedId)
      console.log(`  ❌ #${e.burnedId}: ${err.message?.slice(0, 60)}`)
    }
    if ((i + 1) % 20 === 0) await sleep(1000) // rate limit
    else await sleep(200)
  }

  console.log(`\n  Fetched ${results.size}/${relevant.length} (${failed.length} failed)`)
  return results
}

// ---------------------------------------------------------------------------
// 4. Patch db.json
// ---------------------------------------------------------------------------
function patchDB(db, events, burnedValues, nullIds) {
  const tokens = db.tokens
  let patched = 0, skipped = 0

  // Also build mergeCount from old events (for persist tokens)
  const oldMergeCount = new Map()
  for (const e of events) {
    if (e.persistId !== 0) {
      oldMergeCount.set(e.persistId, (oldMergeCount.get(e.persistId) || 0) + 1)
    }
  }

  for (const e of events) {
    if (!nullIds.has(e.burnedId)) continue

    const info = burnedValues.get(e.burnedId)
    const value = info?.value ?? 0
    const persistId = e.persistId || e.burnedId

    tokens[e.burnedId] = [value, 0, persistId]
    patched++
  }

  // Update merge counts on persist tokens that received old-contract merges
  for (const [persistId, count] of oldMergeCount) {
    if (tokens[persistId] && tokens[persistId][2] === 0) {
      // Only add if this persist token exists and is alive
      tokens[persistId][1] = (tokens[persistId][1] || 0) + count
    }
  }

  console.log(`\nPatched ${patched} null tokens`)
  console.log(`Updated merge counts for ${oldMergeCount.size} persist tokens`)

  // Check remaining nulls
  let remaining = 0
  for (let i = 1; i < tokens.length; i++) {
    if (!tokens[i]) remaining++
  }
  console.log(`Remaining null tokens: ${remaining}`)

  return db
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("🔧 Patch db.json with old contract events\n")

  const db = JSON.parse(readFileSync(join(DATA_DIR, "db.json"), "utf-8"))
  const nullIds = findNullTokens(db)
  console.log(`Found ${nullIds.size} null tokens in db.json\n`)

  if (nullIds.size === 0) {
    console.log("No null tokens to patch! ✅")
    return
  }

  const events = await fetchOldContractEvents()
  const burnedValues = await fetchBurnedValues(events, nullIds)
  patchDB(db, events, burnedValues, nullIds)

  writeFileSync(join(DATA_DIR, "db.json"), JSON.stringify(db))
  console.log("\n✅ db.json updated")
}

main().catch(err => { console.error("Fatal:", err); process.exit(1) })
