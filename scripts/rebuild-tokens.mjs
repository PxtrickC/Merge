import { ethers } from "ethers"
import { writeFileSync, readFileSync, mkdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { MERGE_CONTRACT_ADDRESS, MERGE_ABI, decodeValue } from "../utils/contract.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, "..", "public", "data")

const ALCHEMY_API_KEY = process.env.NUXT_PUBLIC_ALCHEMY_API_KEY
if (!ALCHEMY_API_KEY) {
  console.error("Missing NUXT_PUBLIC_ALCHEMY_API_KEY env var")
  process.exit(1)
}
const RPC_URL = `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
const MAX_TOKEN_ID = 28738

const BATCH_SIZE = 50    // getValueOf calls per HTTP batch request
const BATCH_DELAY = 1000 // ms between batches

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
function writeJSON(filename, data) {
  writeFileSync(join(DATA_DIR, filename), JSON.stringify(data))
  console.log(`  ✅ ${filename}`)
}

async function main() {
  mkdirSync(DATA_DIR, { recursive: true })
  console.log("🔄 Rebuild token data (optimized)\n")

  // 1. Load burned token IDs from merge_history.json to skip them
  let burnedIds = new Set()
  try {
    const history = JSON.parse(readFileSync(join(DATA_DIR, "merge_history.json"), "utf-8"))
    burnedIds = new Set(Object.keys(history).map(Number))
    console.log(`Loaded ${burnedIds.size} burned IDs from merge_history.json (will skip)`)
  } catch {
    console.log("No merge_history.json found, scanning all IDs")
  }

  // 2. Load merge counts from merged_into.json (so we don't need getMergeCount RPC)
  let mergeCountMap = new Map()
  try {
    const mergedInto = JSON.parse(readFileSync(join(DATA_DIR, "merged_into.json"), "utf-8"))
    for (const [persistId, burned] of Object.entries(mergedInto)) {
      mergeCountMap.set(Number(persistId), burned.length)
    }
    console.log(`Loaded merge counts for ${mergeCountMap.size} tokens from merged_into.json`)
  } catch {
    console.log("No merged_into.json found, merge counts will be 0")
  }

  // 3. Build list of IDs to scan (skip burned)
  const idsToScan = []
  for (let id = 1; id <= MAX_TOKEN_ID; id++) {
    if (!burnedIds.has(id)) idsToScan.push(id)
  }
  console.log(`\nScanning ${idsToScan.length} IDs (skipped ${burnedIds.size} burned)`)
  console.log(`Batch: ${BATCH_SIZE} calls/request, ${BATCH_DELAY}ms delay\n`)

  // 4. Batch RPC — only getValueOf (1 call per token)
  const provider = new ethers.JsonRpcProvider(RPC_URL, undefined, {
    batchMaxCount: BATCH_SIZE,
  })
  const contract = new ethers.Contract(MERGE_CONTRACT_ADDRESS, MERGE_ABI, provider)

  const snapshotBlock = await provider.getBlockNumber()
  const totalSupply = Number(await contract.totalSupply({ blockTag: snapshotBlock }))
  console.log(`Snapshot block: ${snapshotBlock}, totalSupply: ${totalSupply}`)

  const tokens = []
  let errors = 0
  const failedIds = []
  const callOpts = { blockTag: snapshotBlock }

  for (let i = 0; i < idsToScan.length; i += BATCH_SIZE) {
    const batchIds = idsToScan.slice(i, i + BATCH_SIZE)

    const results = await Promise.all(
      batchIds.map(id =>
        contract.getValueOf(id, callOpts)
          .then(value => {
            const { class: classVal, mass } = decodeValue(value)
            return { id, mass, class: classVal, tier: classVal, merges: mergeCountMap.get(id) || 0 }
          })
          .catch(err => {
            if (err.message?.includes("nonexistent")) return null
            return { _retry: id }
          })
      )
    )

    // Collect results + retry failures
    const retryIds = []
    for (const r of results) {
      if (r === null) continue
      if (r?._retry) { retryIds.push(r._retry); continue }
      tokens.push(r)
    }

    if (retryIds.length > 0) {
      await sleep(800)
      for (const id of retryIds) {
        try {
          const value = await contract.getValueOf(id, callOpts)
          const { class: classVal, mass } = decodeValue(value)
          tokens.push({ id, mass, class: classVal, tier: classVal, merges: mergeCountMap.get(id) || 0 })
        } catch (err) {
          if (!err.message?.includes("nonexistent")) { errors++; failedIds.push(id) }
        }
        await sleep(150)
      }
    }

    const scanned = Math.min(i + BATCH_SIZE, idsToScan.length)
    const pct = Math.round((scanned / idsToScan.length) * 100)
    process.stdout.write(`\r  ${pct}% (${tokens.length} tokens, ${errors} errors)`)

    if (tokens.length >= totalSupply) {
      console.log(`\n  Reached totalSupply (${totalSupply}), stopping early`)
      break
    }

    await sleep(BATCH_DELAY)
  }

  console.log(`\n  Found ${tokens.length} tokens (${errors} errors)`)
  if (failedIds.length > 0) {
    writeJSON("failed_ids.json", failedIds)
    console.log(`  ⚠️  Failed IDs saved to failed_ids.json`)
  }
  console.log()

  // 5. Write all token-derived files
  const mergedCount = MAX_TOKEN_ID - totalSupply
  const totalMass = tokens.reduce((sum, t) => sum + t.mass, 0)
  const alphaMass = Math.max(...tokens.map(t => t.mass))

  writeJSON("stats.json", {
    token_count: totalSupply,
    merged_count: mergedCount,
    total_mass: totalMass,
    alpha_mass: alphaMass,
  })

  const massSorted = [...tokens].sort((a, b) => b.mass - a.mass)
  writeJSON("mass_top.json", massSorted.slice(0, 100).map(t => ({ id: t.id, tier: t.tier, mass: t.mass })))

  const blueTokens = tokens.filter(t => t.tier === 3).sort((a, b) => b.mass - a.mass)
  writeJSON("blue_mass.json", blueTokens.slice(0, 100).map(t => ({ id: t.id, tier: t.tier, mass: t.mass })))

  const mergesSorted = [...tokens].filter(t => t.merges > 0).sort((a, b) => b.merges - a.merges)
  writeJSON("merges_top.json", mergesSorted.slice(0, 100).map(t => ({ id: t.id, tier: t.tier, mass: t.mass, merges: t.merges })))

  // Exact mass distribution (sorted by count desc, top 20)
  const massCount = new Map()
  for (const t of tokens) massCount.set(t.mass, (massCount.get(t.mass) || 0) + 1)
  const sorted = [...massCount.entries()].sort((a, b) => b[1] - a[1])
  writeJSON("mass_repartition.json", sorted.slice(0, 20).map(([mass, count]) => ({ mass, count })))

  // Save token cache for instant re-generation later
  writeJSON("tokens_cache.json", tokens)

  // Matter
  const byClass = { 1: [], 2: [], 3: [], 4: [] }
  for (const t of tokens) (byClass[t.class] ??= []).push(t)
  writeJSON("matter.json", {
    unidentified_count: (byClass[3] || []).length,
    antimatter_count: (byClass[2] || []).length,
    masses: {
      positive: [...(byClass[1] || []), ...(byClass[4] || [])].reduce((s, t) => s + t.mass, 0),
      unidentified: (byClass[3] || []).reduce((s, t) => s + t.mass, 0),
      negative: (byClass[2] || []).reduce((s, t) => s + t.mass, 0),
    },
  })

  writeJSON("token_28xxx.json", { count: tokens.filter(t => t.id > 28000).length })

  console.log(`\n📊 Summary:`)
  console.log(`  Alive: ${totalSupply}, Merged: ${mergedCount}, Total mass: ${totalMass}, Alpha: ${alphaMass}`)
  console.log(`  Classes: c1=${(byClass[1]||[]).length} c2=${(byClass[2]||[]).length} c3=${(byClass[3]||[]).length} c4=${(byClass[4]||[]).length}`)
  console.log(`\nDone! ✅`)
}

main().catch(err => { console.error("Fatal:", err); process.exit(1) })
