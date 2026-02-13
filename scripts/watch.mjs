import { ethers } from "ethers"
import { readFileSync, writeFileSync } from "fs"
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
// RPC provider for querying token data after event
// ---------------------------------------------------------------------------
const rpcProvider = new ethers.JsonRpcProvider(RPC_URL)
const rpcContract = new ethers.Contract(MERGE_CONTRACT_ADDRESS, MERGE_ABI, rpcProvider)

async function fetchTokenData(tokenId) {
  try {
    const [value, mergeCount] = await Promise.all([
      rpcContract.getValueOf(tokenId),
      rpcContract.getMergeCount(tokenId),
    ])
    const { class: classVal, mass } = decodeValue(value)
    return {
      id: tokenId,
      mass,
      class: classVal,
      tier: classVal, // class = tier directly
      merges: Number(mergeCount),
    }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Incremental update logic
// ---------------------------------------------------------------------------
async function handleMassUpdate(tokenIdBurned, tokenIdPersist, newMass, blockNumber) {
  log(`MassUpdate: #${tokenIdBurned} → #${tokenIdPersist} (mass: ${newMass})`)

  // Fetch updated persist token data from chain
  const persistToken = await fetchTokenData(tokenIdPersist)
  if (!persistToken) {
    log(`  ⚠️ Could not fetch persist token #${tokenIdPersist}, skipping`)
    return
  }

  // Fetch block timestamp
  let mergedOn = null
  try {
    const block = await rpcProvider.getBlock(blockNumber)
    mergedOn = new Date(block.timestamp * 1000).toISOString()
  } catch {
    mergedOn = new Date().toISOString()
  }

  // Read all current JSON files
  const stats = readJSON("stats.json")
  const massTop = readJSON("mass_top.json")
  const blueTop = readJSON("blue_mass.json")
  const mergesTop = readJSON("merges_top.json")
  const latestMerges = readJSON("latest_merges.json")
  const matter = readJSON("matter.json")
  const massRepartition = readJSON("mass_repartition.json")
  const mergedInto = readJSON("merged_into.json")
  const mergeHistory = readJSON("merge_history.json")
  const token28xxx = readJSON("token_28xxx.json")

  // --- Find burned token info from existing data ---
  const burnedInMassTop = massTop.find((t) => t.id === tokenIdBurned)
  const burnedMass = burnedInMassTop?.mass ?? 0
  const burnedTier = burnedInMassTop?.tier ?? 0
  const burnedClass = burnedTier === 4 ? 1 : burnedTier === 3 ? 2 : burnedTier === 2 ? 3 : 4

  // --- 1. stats.json ---
  stats.token_count = Math.max(0, stats.token_count - 1)
  stats.merged_count += 1
  // total_mass stays the same (mass is conserved in merges)
  writeJSON("stats.json", stats)
  log("  ✅ stats.json")

  // --- 2. mass_top.json ---
  updateLeaderboard(massTop, tokenIdBurned, persistToken, "mass")
  writeJSON("mass_top.json", massTop)
  log("  ✅ mass_top.json")

  // --- 3. blue_mass.json ---
  // Remove burned if present
  const burnedBlueIdx = blueTop.findIndex((t) => t.id === tokenIdBurned)
  if (burnedBlueIdx !== -1) blueTop.splice(burnedBlueIdx, 1)
  // Update or insert persist if it's blue (tier 3)
  if (persistToken.tier === 3) {
    const existIdx = blueTop.findIndex((t) => t.id === tokenIdPersist)
    if (existIdx !== -1) {
      blueTop[existIdx].mass = persistToken.mass
    } else {
      blueTop.push({ id: tokenIdPersist, tier: persistToken.tier, mass: persistToken.mass })
    }
    blueTop.sort((a, b) => b.mass - a.mass)
    blueTop.splice(100) // keep top 100
  }
  writeJSON("blue_mass.json", blueTop)
  log("  ✅ blue_mass.json")

  // --- 4. merges_top.json ---
  {
    // Remove burned if present
    const burnedIdx = mergesTop.findIndex((t) => t.id === tokenIdBurned)
    if (burnedIdx !== -1) mergesTop.splice(burnedIdx, 1)
    // Update or insert persist
    const existIdx = mergesTop.findIndex((t) => t.id === tokenIdPersist)
    if (existIdx !== -1) {
      mergesTop[existIdx].mass = persistToken.mass
      mergesTop[existIdx].merges = persistToken.merges
    } else if (persistToken.merges > 0) {
      mergesTop.push({
        id: tokenIdPersist,
        tier: persistToken.tier,
        mass: persistToken.mass,
        merges: persistToken.merges,
      })
    }
    mergesTop.sort((a, b) => b.merges - a.merges)
    mergesTop.splice(100)
  }
  writeJSON("merges_top.json", mergesTop)
  log("  ✅ merges_top.json")

  // --- 5. latest_merges.json ---
  latestMerges.unshift({
    id: tokenIdBurned,
    mass: burnedMass,
    tier: burnedTier,
    merged_on: mergedOn,
    merged_to: {
      id: tokenIdPersist,
      mass: persistToken.mass,
      tier: persistToken.tier,
    },
  })
  latestMerges.splice(100) // keep latest 100
  writeJSON("latest_merges.json", latestMerges)
  log("  ✅ latest_merges.json")

  // --- 6. matter.json ---
  if (burnedClass === 4) {
    matter.unidentified_count = Math.max(0, matter.unidentified_count - 1)
    matter.masses.unidentified = Math.max(0, matter.masses.unidentified - burnedMass)
  } else if (burnedClass === 2) {
    matter.antimatter_count = Math.max(0, matter.antimatter_count - 1)
    matter.masses.negative = Math.max(0, matter.masses.negative - burnedMass)
  } else {
    matter.masses.positive = Math.max(0, matter.masses.positive - burnedMass)
  }
  // Persist token gains mass but its class doesn't change,
  // so we add the burned mass to the persist token's class category
  const persistClass = persistToken.class
  if (persistClass === 4) {
    matter.masses.unidentified += burnedMass
  } else if (persistClass === 2) {
    matter.masses.negative += burnedMass
  } else {
    matter.masses.positive += burnedMass
  }
  writeJSON("matter.json", matter)
  log("  ✅ matter.json")

  // --- 7. mass_repartition.json ---
  {
    // Decrement old mass count for burned token
    if (burnedMass > 0) {
      const oldEntry = massRepartition.find((e) => e.mass === burnedMass)
      if (oldEntry) {
        oldEntry.count = Math.max(0, oldEntry.count - 1)
        if (oldEntry.count === 0) {
          massRepartition.splice(massRepartition.indexOf(oldEntry), 1)
        }
      }
    }
    // Decrement old mass count for persist token (it had a different mass before)
    const persistOldMass = persistToken.mass - burnedMass // before merge
    if (persistOldMass > 0) {
      const oldPersist = massRepartition.find((e) => e.mass === persistOldMass)
      if (oldPersist) {
        oldPersist.count = Math.max(0, oldPersist.count - 1)
        if (oldPersist.count === 0) {
          massRepartition.splice(massRepartition.indexOf(oldPersist), 1)
        }
      }
    }
    // Increment new mass count for persist token
    const newEntry = massRepartition.find((e) => e.mass === persistToken.mass)
    if (newEntry) {
      newEntry.count += 1
    } else {
      massRepartition.push({ mass: persistToken.mass, count: 1 })
    }
    massRepartition.sort((a, b) => a.mass - b.mass)
  }
  writeJSON("mass_repartition.json", massRepartition)
  log("  ✅ mass_repartition.json")

  // --- 8. merged_into.json ---
  if (!mergedInto[tokenIdPersist]) mergedInto[tokenIdPersist] = []
  mergedInto[tokenIdPersist].push({
    id: tokenIdBurned,
    tier: burnedTier,
    mass: burnedMass,
  })
  writeJSON("merged_into.json", mergedInto)
  log("  ✅ merged_into.json")

  // --- 9. merge_history.json ---
  mergeHistory[tokenIdBurned] = {
    merged_to: tokenIdPersist,
    merged_on: mergedOn,
  }
  writeJSON("merge_history.json", mergeHistory)
  log("  ✅ merge_history.json")

  // --- 10. token_28xxx.json ---
  if (tokenIdBurned > 28000) {
    token28xxx.count = Math.max(0, token28xxx.count - 1)
    writeJSON("token_28xxx.json", token28xxx)
    log("  ✅ token_28xxx.json")
  }

  log(`  🎉 All JSON files updated for merge #${tokenIdBurned} → #${tokenIdPersist}\n`)
}

// ---------------------------------------------------------------------------
// Helper: update a mass leaderboard (mass_top)
// ---------------------------------------------------------------------------
function updateLeaderboard(list, burnedId, persistToken, sortKey) {
  // Remove burned token if present
  const burnedIdx = list.findIndex((t) => t.id === burnedId)
  if (burnedIdx !== -1) list.splice(burnedIdx, 1)

  // Update or insert persist token
  const existIdx = list.findIndex((t) => t.id === persistToken.id)
  if (existIdx !== -1) {
    list[existIdx].mass = persistToken.mass
    list[existIdx].tier = persistToken.tier
  } else {
    list.push({ id: persistToken.id, tier: persistToken.tier, mass: persistToken.mass })
  }

  list.sort((a, b) => b[sortKey] - a[sortKey])
  list.splice(100) // keep top 100
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
