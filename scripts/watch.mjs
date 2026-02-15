import { ethers } from "ethers"
import { readFileSync, writeFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { MERGE_CONTRACT_ADDRESS, MERGE_ABI, decodeValue } from "../utils/contract.mjs"

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
const WS_URL = `wss://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
const RPC_URL = `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`

// ---------------------------------------------------------------------------
// JSON helpers
// ---------------------------------------------------------------------------
function readJSON(filename) {
  return JSON.parse(readFileSync(join(DATA_DIR, filename), "utf-8"))
}

function writeJSON(filename, data) {
  writeFileSync(join(DATA_DIR, filename), JSON.stringify(data))
}

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`)
}

// ---------------------------------------------------------------------------
// RPC provider (only for block timestamp lookups)
// ---------------------------------------------------------------------------
const rpcProvider = new ethers.JsonRpcProvider(RPC_URL)

// ---------------------------------------------------------------------------
// Incremental update — pure computation from event data, no state queries
// ---------------------------------------------------------------------------
async function handleMassUpdate(tokenIdBurned, tokenIdPersist, newMass, blockNumber) {
  log(`MassUpdate: #${tokenIdBurned} → #${tokenIdPersist} (mass: ${newMass})`)

  const db = readJSON("db.json")
  const tokens = db.tokens

  // Ensure array is long enough
  while (tokens.length <= Math.max(tokenIdBurned, tokenIdPersist)) tokens.push(null)

  // Burned token: keep existing value, mark as merged
  const burnedValue = tokens[tokenIdBurned]?.[0] ?? 0
  const burnedMerges = tokens[tokenIdBurned]?.[1] ?? 0
  tokens[tokenIdBurned] = [burnedValue, burnedMerges, tokenIdPersist]

  // Persist token: derive new value from existing tier + event mass
  const existingEntry = tokens[tokenIdPersist]
  const existingTier = existingEntry ? Math.floor(existingEntry[0] / CLASS_DIVISOR) : 1
  const newValue = existingTier * CLASS_DIVISOR + newMass
  const persistMerges = (existingEntry?.[1] ?? 0) + 1
  tokens[tokenIdPersist] = [newValue, persistMerges, 0]

  db.block = blockNumber
  writeJSON("db.json", db)
  log("  ✅ db.json")

  // Update latest_merges.json
  let mergedOn
  try {
    const block = await rpcProvider.getBlock(blockNumber)
    mergedOn = new Date(block.timestamp * 1000).toISOString()
  } catch {
    mergedOn = new Date().toISOString()
  }

  const burnedDecoded = decodeValue(burnedValue)

  const latestMerges = readJSON("latest_merges.json")
  latestMerges.unshift({
    id: tokenIdBurned,
    mass: burnedDecoded.mass,
    tier: burnedDecoded.class,
    merged_on: mergedOn,
    merged_to: {
      id: tokenIdPersist,
      mass: newMass,
      tier: existingTier,
    },
  })
  latestMerges.splice(100)
  writeJSON("latest_merges.json", latestMerges)
  log("  ✅ latest_merges.json")

  log(`  🎉 #${tokenIdBurned} (m=${burnedDecoded.mass}) → #${tokenIdPersist} (m=${newMass})\n`)
}

// ---------------------------------------------------------------------------
// WebSocket connection with auto-reconnect
// ---------------------------------------------------------------------------
function startListening() {
  log("🔌 Connecting to Alchemy WebSocket...")

  const wsProvider = new ethers.WebSocketProvider(WS_URL)
  const wsContract = new ethers.Contract(MERGE_CONTRACT_ADDRESS, MERGE_ABI, wsProvider)

  wsContract.on("MassUpdate", async (tokenIdBurned, tokenIdPersist, mass, event) => {
    const burnedId = Number(tokenIdBurned)
    const persistId = Number(tokenIdPersist)
    const newMass = Number(mass)
    const blockNumber = event.log.blockNumber

    try {
      await handleMassUpdate(burnedId, persistId, newMass, blockNumber)
    } catch (err) {
      log(`  ❌ Error processing event: ${err.message}`)
    }
  })

  wsProvider.websocket.on("open", () => {
    log("✅ WebSocket connected. Listening for MassUpdate events...\n")
  })

  wsProvider.websocket.on("close", () => {
    log("⚠️ WebSocket disconnected. Reconnecting in 5s...")
    setTimeout(startListening, 5000)
  })

  wsProvider.websocket.on("error", (err) => {
    log(`❌ WebSocket error: ${err.message}`)
  })
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
log("👀 Merge Event Watcher\n")
startListening()
