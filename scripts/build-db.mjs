import { ethers } from "ethers"
import { readFileSync, writeFileSync, mkdirSync } from "fs"
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

const BATCH_SIZE = 50
const BATCH_DELAY = 1000
const MAX_TOKEN_ID = 28990
const DEPLOY_BLOCK = 13_755_675
const CONTRACT_TOTAL_MASS = 312_712 // from contract _massTotal

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || ""
const ETHERSCAN_BASE = "https://api.etherscan.io/v2/api"
const ETHERSCAN_PAGE_SIZE = 1000
const ETHERSCAN_DELAY_MS = ETHERSCAN_API_KEY ? 250 : 5500
const MASS_UPDATE_TOPIC = "0x7ba170514e8ea35827dbbd10c6d3376ca77ff64b62e4b0a395bac9b142dc81dc"

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ---------------------------------------------------------------------------
// 1. Fetch all MassUpdate events via Etherscan
// ---------------------------------------------------------------------------
async function fetchMergeEvents() {
  console.log("Fetching MassUpdate events via Etherscan...")
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
// 2. Build maps from events
// ---------------------------------------------------------------------------
function buildMaps(events) {
  // burnedMap: burnedId → { persistId, blockNumber }
  const burnedMap = new Map()
  // mergeCountMap: persistId → count (how many tokens merged into it)
  const mergeCountMap = new Map()

  for (const e of events) {
    // persistId === 0 means burned without merge target (sent to dead address)
    // Use self-ID as persistId so mergedTo !== 0 in db (0 = alive)
    const effectivePersistId = e.persistId || e.burnedId
    burnedMap.set(e.burnedId, { persistId: effectivePersistId, blockNumber: e.blockNumber })
    if (e.persistId !== 0) {
      mergeCountMap.set(e.persistId, (mergeCountMap.get(e.persistId) || 0) + 1)
    }
  }

  console.log(`  burnedMap: ${burnedMap.size} burned tokens`)
  console.log(`  mergeCountMap: ${mergeCountMap.size} tokens with merges`)
  return { burnedMap, mergeCountMap }
}

// ---------------------------------------------------------------------------
// 3. Batch fetch getValueOf for alive tokens
// ---------------------------------------------------------------------------
async function fetchAliveTokens(burnedMap) {
  console.log("\nFetching alive tokens...")
  const provider = new ethers.JsonRpcProvider(RPC_URL, undefined, {
    batchMaxCount: BATCH_SIZE,
  })
  const contract = new ethers.Contract(MERGE_CONTRACT_ADDRESS, MERGE_ABI, provider)

  const snapshotBlock = await provider.getBlockNumber()
  const totalSupply = Number(await contract.totalSupply({ blockTag: snapshotBlock }))
  console.log(`  Snapshot block: ${snapshotBlock}, totalSupply: ${totalSupply}`)

  // Build list of alive IDs (not in burnedMap)
  const aliveIds = []
  for (let id = 1; id <= MAX_TOKEN_ID; id++) {
    if (!burnedMap.has(id)) aliveIds.push(id)
  }
  console.log(`  Scanning ${aliveIds.length} alive IDs (batch ${BATCH_SIZE}, ${BATCH_DELAY}ms delay)`)

  const aliveValues = new Map() // id → rawValue
  const failedIds = []
  const callOpts = { blockTag: snapshotBlock }

  for (let i = 0; i < aliveIds.length; i += BATCH_SIZE) {
    const batchIds = aliveIds.slice(i, i + BATCH_SIZE)

    const results = await Promise.all(
      batchIds.map(id =>
        contract.getValueOf(id, callOpts)
          .then(value => ({ id, value: Number(value) }))
          .catch(err => {
            if (err.message?.includes("nonexistent")) return { id, value: null }
            return { id, value: undefined } // retry
          })
      )
    )

    // Collect results + retry failures
    const retryIds = []
    for (const r of results) {
      if (r.value === null || r.value === 0) continue // burned or invalid (value=0)
      if (r.value === undefined) { retryIds.push(r.id); continue }
      aliveValues.set(r.id, r.value)
    }

    if (retryIds.length > 0) {
      for (const id of retryIds) {
        let fetched = false
        for (let attempt = 1; attempt <= 3; attempt++) {
          await sleep(attempt * 500)
          try {
            const value = await contract.getValueOf(id, callOpts)
            aliveValues.set(id, Number(value))
            fetched = true
            break
          } catch (err) {
            if (err.message?.includes("nonexistent")) { fetched = true; break }
          }
        }
        if (!fetched) failedIds.push(id)
      }
    }

    const scanned = Math.min(i + BATCH_SIZE, aliveIds.length)
    const pct = Math.round((scanned / aliveIds.length) * 100)
    process.stdout.write(`\r  ${pct}% (${aliveValues.size} tokens, ${failedIds.length} errors)`)

    if (aliveValues.size >= totalSupply) {
      console.log(`\n  Reached totalSupply (${totalSupply}), stopping early`)
      break
    }

    await sleep(BATCH_DELAY)
  }

  console.log(`\n  ${aliveValues.size} alive tokens (${failedIds.length} errors)`)
  if (failedIds.length > 0) {
    writeFileSync(join(DATA_DIR, "failed_ids.json"), JSON.stringify(failedIds))
    console.log(`  ⚠️  Failed IDs saved to failed_ids.json: ${failedIds.join(", ")}`)
  }
  return { aliveValues, snapshotBlock }
}

// ---------------------------------------------------------------------------
// 4. Fetch burned token values via archive calls
// ---------------------------------------------------------------------------
const ARCHIVE_BATCH = 20
const ARCHIVE_DELAY = 1000

async function fetchBurnedTokenValues(burnedMap) {
  console.log("\nFetching burned token values (archive calls)...")
  const provider = new ethers.JsonRpcProvider(RPC_URL, undefined, {
    batchMaxCount: ARCHIVE_BATCH,
  })
  const contract = new ethers.Contract(MERGE_CONTRACT_ADDRESS, MERGE_ABI, provider)

  const entries = [...burnedMap.entries()] // [id, { persistId, blockNumber }]
  const burnedValues = new Map() // id → rawValue
  const failedIds = []

  for (let i = 0; i < entries.length; i += ARCHIVE_BATCH) {
    const batch = entries.slice(i, i + ARCHIVE_BATCH)

    const results = await Promise.all(
      batch.map(([id, { blockNumber }]) =>
        contract.getValueOf(id, { blockTag: blockNumber - 1 })
          .then(value => ({ id, value: Number(value) }))
          .catch(() => ({ id, value: null }))
      )
    )

    for (const r of results) {
      if (r.value && r.value > 0) burnedValues.set(r.id, r.value)
      else failedIds.push(r.id)
    }

    const done = Math.min(i + ARCHIVE_BATCH, entries.length)
    const pct = Math.round((done / entries.length) * 100)
    process.stdout.write(`\r  ${pct}% (${burnedValues.size} ok, ${failedIds.length} errors)`)

    await sleep(ARCHIVE_DELAY)
  }

  console.log(`\n  ${burnedValues.size} burned values fetched (${failedIds.length} errors)`)
  if (failedIds.length > 0) {
    writeFileSync(join(DATA_DIR, "failed_burned_ids.json"), JSON.stringify(failedIds))
    console.log(`  ⚠️  Failed burned IDs saved to failed_burned_ids.json`)
  }
  return burnedValues
}

// ---------------------------------------------------------------------------
// 5. Assemble and write db.json
// ---------------------------------------------------------------------------
function buildDB(aliveValues, burnedMap, mergeCountMap, burnedValues, snapshotBlock) {
  console.log("\nBuilding db.json...")

  // tokens array: index = token ID, value = [value, merges, mergedTo]
  // null for non-existent (index 0 or gaps)
  const tokens = new Array(MAX_TOKEN_ID + 1).fill(null)

  // Alive tokens: mergedTo = 0
  for (const [id, value] of aliveValues) {
    const merges = mergeCountMap.get(id) || 0
    tokens[id] = [value, merges, 0]
  }

  // Burned tokens: value from archive call (or 0 if failed), mergedTo = persistId
  for (const [id, { persistId }] of burnedMap) {
    if (tokens[id] !== null) continue // already set as alive (edge case)
    const merges = mergeCountMap.get(id) || 0
    const value = burnedValues.get(id) || 0
    tokens[id] = [value, merges, persistId]
  }

  const db = { block: snapshotBlock, tokens }

  const json = JSON.stringify(db)
  mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(join(DATA_DIR, "db.json"), json)

  // Stats
  let alive = 0, burned = 0, burnedWithValue = 0, missing = 0
  for (let i = 1; i <= MAX_TOKEN_ID; i++) {
    if (tokens[i] === null) { missing++; continue }
    if (tokens[i][2] === 0) alive++
    else {
      burned++
      if (tokens[i][0] > 0) burnedWithValue++
    }
  }

  console.log(`  ✅ db.json written (${(json.length / 1024).toFixed(0)} KB)`)
  console.log(`  Alive: ${alive}, Burned: ${burned} (${burnedWithValue} with value), Missing: ${missing}`)

  // Mass verification
  let aliveMass = 0
  for (let i = 1; i <= MAX_TOKEN_ID; i++) {
    if (tokens[i] !== null && tokens[i][2] === 0 && tokens[i][0] > 0) {
      aliveMass += tokens[i][0] % 100_000_000
    }
  }
  const massDiff = CONTRACT_TOTAL_MASS - aliveMass
  if (massDiff === 0) {
    console.log(`  ✅ Mass verified: ${aliveMass.toLocaleString()} = contract total`)
  } else {
    console.log(`  ⚠️  Mass mismatch: alive=${aliveMass.toLocaleString()}, contract=${CONTRACT_TOTAL_MASS.toLocaleString()}, diff=${massDiff}`)
    // List null tokens (potential missing mass)
    const nullIds = []
    for (let i = 1; i <= MAX_TOKEN_ID; i++) {
      if (tokens[i] === null && !burnedMap.has(i)) nullIds.push(i)
    }
    if (nullIds.length > 0) {
      console.log(`  ⚠️  ${nullIds.length} tokens not in burnedMap and null in db (possible missing mass)`)
      console.log(`     Run --retry to attempt recovery`)
    }
  }

  return tokens
}

// ---------------------------------------------------------------------------
// 6. Rebuild latest_merges.json from last 100 events
//    Persist token tier from db.json, burned token via archive calls
// ---------------------------------------------------------------------------
function rebuildLatestMerges(events, dbTokens) {
  console.log("\nRebuilding latest_merges.json...")

  // Take last 100 events (sorted by block desc)
  const latest = [...events].sort((a, b) => b.blockNumber - a.blockNumber).slice(0, 100)

  // Build latest merges from db values (no archive calls needed)
  console.log(`  Building ${latest.length} entries from db...`)
  const latestMerges = latest.map((event) => {
    const burnedEntry = dbTokens[event.burnedId]
    let burnedTier = 0, burnedMass = 0
    if (burnedEntry && burnedEntry[0] > 0) {
      const decoded = decodeValue(burnedEntry[0])
      burnedTier = decoded.class
      burnedMass = decoded.mass
    }

    const persistEntry = dbTokens[event.persistId]
    let persistTier = 0
    if (persistEntry && persistEntry[0] > 0) {
      persistTier = Math.floor(persistEntry[0] / 100_000_000)
    }

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

  writeFileSync(join(DATA_DIR, "latest_merges.json"), JSON.stringify(latestMerges))
  console.log(`\n  ✅ latest_merges.json (${latestMerges.length} entries)`)
}

// ---------------------------------------------------------------------------
// Retry: patch failed IDs into existing db.json
// ---------------------------------------------------------------------------
async function retryFailed() {
  console.log("🔄 Retry failed IDs\n")

  let ids
  try {
    ids = JSON.parse(readFileSync(join(DATA_DIR, "failed_ids.json"), "utf-8"))
  } catch {
    console.log("  No failed_ids.json found. Nothing to retry.")
    return
  }
  if (!ids.length) { console.log("  No failed IDs."); return }
  console.log(`  Retrying ${ids.length} IDs: ${ids.join(", ")}`)

  const provider = new ethers.JsonRpcProvider(RPC_URL, undefined, { batchMaxCount: BATCH_SIZE })
  const contract = new ethers.Contract(MERGE_CONTRACT_ADDRESS, MERGE_ABI, provider)
  const db = JSON.parse(readFileSync(join(DATA_DIR, "db.json"), "utf-8"))
  const tokens = db.tokens

  let fixed = 0
  const stillFailed = []

  for (const id of ids) {
    while (tokens.length <= id) tokens.push(null)

    // 1. Check if token exists on-chain
    let exists = false
    try {
      exists = await contract.exists(id)
    } catch { exists = false }

    if (!exists) {
      // Token doesn't exist — burned outside merge, mark as burned (self-ref)
      const existingMerges = tokens[id]?.[1] ?? 0
      tokens[id] = [0, existingMerges, id]
      console.log(`  ⏭️  #${id}: does not exist on-chain, marked as burned`)
      fixed++
      await sleep(200)
      continue
    }

    // 2. Try getValueOf (3 attempts)
    let value = null
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        value = Number(await contract.getValueOf(id))
        break
      } catch {
        await sleep(attempt * 500)
      }
    }

    // 3. Fallback: try massOf
    if (value === null || value === 0) {
      try {
        const mass = Number(await contract.massOf(id))
        if (mass > 0) {
          // Reconstruct value: assume tier 1 (most common), mass from massOf
          value = 1 * 100_000_000 + mass
          console.log(`  🔧 #${id}: used massOf fallback (mass=${mass})`)
        }
      } catch {}
    }

    if (value && value > 0) {
      const existingMerges = tokens[id]?.[1] ?? 0
      tokens[id] = [value, existingMerges, 0]
      fixed++
      const decoded = decodeValue(value)
      console.log(`  ✅ #${id}: tier=${decoded.class}, mass=${decoded.mass}`)
    } else {
      stillFailed.push(id)
      console.log(`  ❌ #${id}: all methods failed`)
    }
    await sleep(200)
  }

  writeFileSync(join(DATA_DIR, "db.json"), JSON.stringify(db))

  // Mass verification
  let aliveMass = 0
  for (let i = 1; i < tokens.length; i++) {
    if (tokens[i] !== null && tokens[i][2] === 0 && tokens[i][0] > 0) {
      aliveMass += tokens[i][0] % 100_000_000
    }
  }
  console.log(`\n  Fixed ${fixed}/${ids.length} tokens`)
  const massDiff = CONTRACT_TOTAL_MASS - aliveMass
  if (massDiff === 0) {
    console.log(`  ✅ Mass verified: ${aliveMass.toLocaleString()} = contract total`)
  } else {
    console.log(`  ⚠️  Mass: alive=${aliveMass.toLocaleString()}, contract=${CONTRACT_TOTAL_MASS.toLocaleString()}, diff=${massDiff}`)
  }

  writeFileSync(join(DATA_DIR, "failed_ids.json"), JSON.stringify(stillFailed))
  if (stillFailed.length === 0) {
    console.log("  🎉 All failed IDs resolved!")
  } else {
    console.log(`  ${stillFailed.length} still failed: ${stillFailed.join(", ")}`)
  }
}

// ---------------------------------------------------------------------------
// Retry burned: patch failed burned IDs into existing db.json
// ---------------------------------------------------------------------------
async function retryBurned() {
  console.log("🔄 Retry failed burned IDs\n")

  let ids
  try {
    ids = JSON.parse(readFileSync(join(DATA_DIR, "failed_burned_ids.json"), "utf-8"))
  } catch {
    console.log("  No failed_burned_ids.json found. Nothing to retry.")
    return
  }
  if (!ids.length) { console.log("  No failed burned IDs."); return }
  console.log(`  Retrying ${ids.length} burned IDs...`)

  const provider = new ethers.JsonRpcProvider(RPC_URL)
  const contract = new ethers.Contract(MERGE_CONTRACT_ADDRESS, MERGE_ABI, provider)
  const db = JSON.parse(readFileSync(join(DATA_DIR, "db.json"), "utf-8"))
  const tokens = db.tokens

  let fixed = 0
  const stillFailed = []

  for (const id of ids) {
    try {
      // Find the MassUpdate event where this token was burned
      const topic1 = '0x' + id.toString(16).padStart(64, '0')
      const url = new URL(ETHERSCAN_BASE)
      url.searchParams.set('chainid', '1')
      url.searchParams.set('module', 'logs')
      url.searchParams.set('action', 'getLogs')
      url.searchParams.set('address', MERGE_CONTRACT_ADDRESS)
      url.searchParams.set('topic0', MASS_UPDATE_TOPIC)
      url.searchParams.set('topic1', topic1)
      url.searchParams.set('topic0_1_opr', 'and')
      url.searchParams.set('fromBlock', DEPLOY_BLOCK.toString())
      url.searchParams.set('toBlock', 'latest')
      url.searchParams.set('page', '1')
      url.searchParams.set('offset', '1')
      if (ETHERSCAN_API_KEY) url.searchParams.set('apikey', ETHERSCAN_API_KEY)

      const res = await fetch(url)
      const json = await res.json()

      if (json.status !== '1' || !json.result?.length) {
        stillFailed.push(id)
        continue
      }

      const blockNumber = parseInt(json.result[0].blockNumber, 16)
      const value = await contract.getValueOf(id, { blockTag: blockNumber - 1 })
      const numValue = Number(value)

      if (numValue > 0) {
        while (tokens.length <= id) tokens.push(null)
        const entry = tokens[id]
        tokens[id] = [numValue, entry?.[1] ?? 0, entry?.[2] ?? 0]
        fixed++
        const decoded = decodeValue(numValue)
        console.log(`  ✅ #${id}: tier=${decoded.class}, mass=${decoded.mass}`)
      } else {
        stillFailed.push(id)
      }
    } catch (err) {
      stillFailed.push(id)
      console.log(`  ❌ #${id}: ${err.message?.slice(0, 60)}`)
    }
    await sleep(ETHERSCAN_DELAY_MS)
  }

  writeFileSync(join(DATA_DIR, "db.json"), JSON.stringify(db))
  console.log(`\n  Fixed ${fixed}/${ids.length} burned tokens`)
  writeFileSync(join(DATA_DIR, "failed_burned_ids.json"), JSON.stringify(stillFailed))
  if (stillFailed.length === 0) {
    console.log("  🎉 All failed burned IDs resolved!")
  } else {
    console.log(`  ${stillFailed.length} still failed, saved to failed_burned_ids.json`)
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  if (process.argv.includes("--retry")) {
    await retryFailed()
  } else if (process.argv.includes("--retry-burned")) {
    await retryBurned()
  } else if (process.argv.includes("--latest")) {
    console.log("🔄 Rebuild latest_merges.json\n")
    const events = await fetchMergeEvents()
    const db = JSON.parse(readFileSync(join(DATA_DIR, "db.json"), "utf-8"))
    await rebuildLatestMerges(events, db.tokens)
  } else {
    console.log("🔨 Build db.json\n")
    const events = await fetchMergeEvents()
    const { burnedMap, mergeCountMap } = buildMaps(events)
    const { aliveValues, snapshotBlock } = await fetchAliveTokens(burnedMap)
    const burnedValues = await fetchBurnedTokenValues(burnedMap)
    const dbTokens = buildDB(aliveValues, burnedMap, mergeCountMap, burnedValues, snapshotBlock)
    await rebuildLatestMerges(events, dbTokens)
  }
  console.log("\nDone! ✅")
}

main().catch(err => { console.error("Fatal:", err); process.exit(1) })
