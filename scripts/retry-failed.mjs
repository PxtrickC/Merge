import { ethers } from "ethers"
import { readFileSync, writeFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { MERGE_CONTRACT_ADDRESS, MERGE_ABI, decodeValue } from "../utils/contract.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, "..", "public", "data")

const ALCHEMY_API_KEY = process.env.NUXT_PUBLIC_ALCHEMY_API_KEY
if (!ALCHEMY_API_KEY) { console.error("Missing NUXT_PUBLIC_ALCHEMY_API_KEY"); process.exit(1) }

const provider = new ethers.JsonRpcProvider(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`)
const contract = new ethers.Contract(MERGE_CONTRACT_ADDRESS, MERGE_ABI, provider)

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  // Read failed IDs (from file or command line args)
  let ids = []
  if (process.argv.length > 2) {
    ids = process.argv.slice(2).map(Number).filter(n => !isNaN(n))
  } else {
    try {
      ids = JSON.parse(readFileSync(join(DATA_DIR, "failed_ids.json"), "utf-8"))
    } catch {
      console.log("No failed_ids.json found and no IDs provided.")
      console.log("Usage: npm run sync:retry           (reads failed_ids.json)")
      console.log("       npm run sync:retry -- 123 456 (specific IDs)")
      process.exit(0)
    }
  }

  if (ids.length === 0) { console.log("No IDs to retry."); return }
  console.log(`🔄 Retrying ${ids.length} failed token IDs: ${ids.join(", ")}\n`)

  // Load existing data files
  const mergedInto = JSON.parse(readFileSync(join(DATA_DIR, "merged_into.json"), "utf-8"))
  const stats = JSON.parse(readFileSync(join(DATA_DIR, "stats.json"), "utf-8"))
  const massTop = JSON.parse(readFileSync(join(DATA_DIR, "mass_top.json"), "utf-8"))
  const blueTop = JSON.parse(readFileSync(join(DATA_DIR, "blue_mass.json"), "utf-8"))
  const mergesTop = JSON.parse(readFileSync(join(DATA_DIR, "merges_top.json"), "utf-8"))
  const repartition = JSON.parse(readFileSync(join(DATA_DIR, "mass_repartition.json"), "utf-8"))
  const matter = JSON.parse(readFileSync(join(DATA_DIR, "matter.json"), "utf-8"))

  const BUCKETS = repartition.map(b => b.min)
  const recovered = []
  const stillFailed = []

  for (const id of ids) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const value = await contract.getValueOf(id)
        const { class: classVal, mass } = decodeValue(value)
        const merges = (mergedInto[id] || []).length
        recovered.push({ id, mass, class: classVal, tier: classVal, merges })
        console.log(`  ✅ #${id}: mass=${mass}, tier=${classVal}, merges=${merges}`)
        break
      } catch (err) {
        if (err.message?.includes("nonexistent")) {
          console.log(`  ⏭️  #${id}: burned (nonexistent)`)
          break
        }
        if (attempt === 3) {
          console.log(`  ❌ #${id}: still failing after 3 attempts`)
          stillFailed.push(id)
        }
        await sleep(2000 * attempt)
      }
    }
    await sleep(500)
  }

  if (recovered.length === 0) {
    console.log("\nNo tokens recovered.")
    return
  }

  console.log(`\nRecovered ${recovered.length} tokens. Patching JSON files...\n`)

  // Patch stats
  for (const t of recovered) {
    stats.total_mass += t.mass
    if (t.mass > stats.alpha_mass) stats.alpha_mass = t.mass
  }
  writeFileSync(join(DATA_DIR, "stats.json"), JSON.stringify(stats))
  console.log("  ✅ stats.json")

  // Patch leaderboards (merge into existing, re-sort, keep top 100)
  const patchList = (existing, tokens, hasM) => {
    const map = new Map(existing.map(t => [t.id, t]))
    for (const t of tokens) {
      const entry = { id: t.id, tier: t.tier, mass: t.mass }
      if (hasM) entry.merges = t.merges
      map.set(t.id, entry)
    }
    return [...map.values()]
  }

  const newMassTop = patchList(massTop, recovered, false).sort((a, b) => b.mass - a.mass).slice(0, 100)
  writeFileSync(join(DATA_DIR, "mass_top.json"), JSON.stringify(newMassTop))
  console.log("  ✅ mass_top.json")

  const blueRecovered = recovered.filter(t => t.tier === 3)
  if (blueRecovered.length > 0) {
    const newBlue = patchList(blueTop, blueRecovered, false).sort((a, b) => b.mass - a.mass).slice(0, 100)
    writeFileSync(join(DATA_DIR, "blue_mass.json"), JSON.stringify(newBlue))
    console.log("  ✅ blue_mass.json")
  }

  const mergesRecovered = recovered.filter(t => t.merges > 0)
  if (mergesRecovered.length > 0) {
    const newMerges = patchList(mergesTop, mergesRecovered, true).sort((a, b) => b.merges - a.merges).slice(0, 100)
    writeFileSync(join(DATA_DIR, "merges_top.json"), JSON.stringify(newMerges))
    console.log("  ✅ merges_top.json")
  }

  // Patch mass_repartition buckets
  for (const t of recovered) {
    for (let i = 0; i < BUCKETS.length; i++) {
      const upper = i < BUCKETS.length - 1 ? BUCKETS[i + 1] : Infinity
      if (t.mass < upper) { repartition[i].count++; break }
    }
  }
  writeFileSync(join(DATA_DIR, "mass_repartition.json"), JSON.stringify(repartition))
  console.log("  ✅ mass_repartition.json")

  // Patch matter
  for (const t of recovered) {
    if (t.class === 3) { matter.unidentified_count++; matter.masses.unidentified += t.mass }
    else if (t.class === 2) { matter.antimatter_count++; matter.masses.negative += t.mass }
    else { matter.masses.positive += t.mass }
  }
  writeFileSync(join(DATA_DIR, "matter.json"), JSON.stringify(matter))
  console.log("  ✅ matter.json")

  // Update failed_ids.json
  if (stillFailed.length > 0) {
    writeFileSync(join(DATA_DIR, "failed_ids.json"), JSON.stringify(stillFailed))
    console.log(`\n  ⚠️  ${stillFailed.length} IDs still failing, saved to failed_ids.json`)
  } else {
    try { const { unlinkSync } = await import("fs"); unlinkSync(join(DATA_DIR, "failed_ids.json")) } catch {}
    console.log("\n  All IDs recovered! Removed failed_ids.json")
  }

  console.log("\nDone! ✅")
}

main().catch(err => { console.error("Fatal:", err); process.exit(1) })
