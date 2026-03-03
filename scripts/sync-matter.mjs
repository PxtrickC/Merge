import { writeFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

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
const ALCHEMY_NFT_BASE = `https://eth-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}`

const MATTER_CONTRACT = "0x9ad00312bb2a67fffba0caab452e1a0559a41a9e"
const PAGE_LIMIT = 100
const PAGE_DELAY = 1000

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ---------------------------------------------------------------------------
// Fetch all alive NFTs via getNFTsForContract (paginated)
// ---------------------------------------------------------------------------
async function fetchAllTokens() {
  console.log("Fetching all Matter tokens via getNFTsForContract...")

  const tokens = new Map()
  let startToken = ""
  let page = 0

  while (true) {
    const url = new URL(`${ALCHEMY_NFT_BASE}/getNFTsForContract`)
    url.searchParams.set("contractAddress", MATTER_CONTRACT)
    url.searchParams.set("withMetadata", "true")
    url.searchParams.set("limit", String(PAGE_LIMIT))
    if (startToken) url.searchParams.set("startToken", startToken)

    let data = null
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        data = await res.json()
        break
      } catch (err) {
        console.warn(`  Retry ${attempt}/3 page ${page}: ${err.message}`)
        await sleep(attempt * 2000)
      }
    }

    if (!data?.nfts) {
      console.error(`  Failed to fetch page ${page}, aborting`)
      break
    }

    for (const nft of data.nfts) {
      const id = Number(nft.tokenId)
      const attrs = {}
      for (const a of (nft.raw?.metadata?.attributes || [])) {
        attrs[String(a.trait_type).toLowerCase()] = a.value
      }

      const imageCdn = nft.image?.cachedUrl || nft.image?.pngUrl || nft.image?.originalUrl || ""

      tokens.set(id, {
        id,
        name: nft.name || nft.raw?.metadata?.name || `Matter #${id}`,
        description: nft.description || nft.raw?.metadata?.description || "",
        type: attrs.type ?? "unidentified",
        mass: typeof attrs.mass === "number" ? attrs.mass : 0,
        order: typeof attrs.order === "number" ? attrs.order : 0,
        parent: typeof attrs.parent === "number" ? attrs.parent : 0,
        image_cdn: imageCdn,
      })
    }

    page++
    process.stdout.write(`\r  Page ${page}: ${tokens.size} tokens so far`)

    if (!data.pageKey) break // no more pages
    startToken = data.pageKey
    await sleep(PAGE_DELAY)
  }

  console.log(`\n  Total: ${tokens.size} tokens`)
  return tokens
}

// ---------------------------------------------------------------------------
// Fetch alive token IDs via getOwnersForContract
// ---------------------------------------------------------------------------
async function fetchAliveIds() {
  console.log("\nFetching owners to determine alive tokens...")

  const aliveIds = new Set()
  let pageKey = ""

  while (true) {
    const url = new URL(`${ALCHEMY_NFT_BASE}/getOwnersForContract`)
    url.searchParams.set("contractAddress", MATTER_CONTRACT)
    url.searchParams.set("withTokenBalances", "true")
    if (pageKey) url.searchParams.set("pageKey", pageKey)

    let data = null
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        data = await res.json()
        break
      } catch (err) {
        console.warn(`  Retry ${attempt}/3: ${err.message}`)
        await sleep(attempt * 2000)
      }
    }

    if (!data?.owners) {
      console.error("  Failed to fetch owners, aborting")
      break
    }

    for (const entry of data.owners) {
      // Skip zero address (burned tokens)
      if (entry.ownerAddress === "0x0000000000000000000000000000000000000000") continue
      for (const tb of (entry.tokenBalances || [])) {
        aliveIds.add(Number(tb.tokenId))
      }
    }

    process.stdout.write(`\r  ${aliveIds.size} alive token IDs found`)

    if (!data.pageKey) break
    pageKey = data.pageKey
    await sleep(PAGE_DELAY)
  }

  console.log(`\n  Total alive: ${aliveIds.size}`)
  return aliveIds
}

// ---------------------------------------------------------------------------
// Write output and report stats
// ---------------------------------------------------------------------------
function writeOutput(tokensMap) {
  const tokens = [...tokensMap.values()].sort((a, b) => a.id - b.id)

  const json = JSON.stringify(tokens)
  writeFileSync(join(DATA_DIR, "matter_tokens.json"), json)
  console.log(`\nWritten ${tokens.length} tokens (${(json.length / 1024).toFixed(0)} KB)`)

  // Stats
  console.log("\n--- Statistics ---")
  console.log(`  Total: ${tokens.length}`)

  const byType = {}
  for (const t of tokens) byType[t.type] = (byType[t.type] || 0) + 1
  console.log("  By type:")
  for (const type of Object.keys(byType).sort()) {
    console.log(`    ${type}: ${byType[type]}`)
  }

  const antimatter = tokens.filter(t => t.mass < 0)
  console.log(`  Antimatter (negative mass): ${antimatter.length}`)

  const unidentified = tokens.filter(t => t.type === "unidentified")
  console.log(`  Unidentified: ${unidentified.length}`)

  const masses = tokens.map(t => t.mass)
  console.log(`  Mass range: ${Math.min(...masses)} to ${Math.max(...masses)}`)

  if (tokens.length) {
    console.log(`  ID range: ${tokens[0].id} to ${tokens.at(-1).id}`)
  }

  const noImage = tokens.filter(t => !t.image_cdn)
  if (noImage.length) console.warn(`  ⚠️  Missing image: ${noImage.map(t => `#${t.id}`).join(", ")}`)

  return tokens
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("Matter Token Sync\n")

  const tokensMap = await fetchAllTokens()
  const aliveIds = await fetchAliveIds()

  // Filter to only alive tokens
  const deadIds = []
  for (const [id] of tokensMap) {
    if (!aliveIds.has(id)) {
      deadIds.push(id)
      tokensMap.delete(id)
    }
  }
  if (deadIds.length) {
    console.log(`\n  Removed ${deadIds.length} dead tokens: ${deadIds.sort((a, b) => a - b).join(", ")}`)
  }

  writeOutput(tokensMap)

  console.log("\nDone!")
}

main().catch(err => { console.error("Fatal:", err); process.exit(1) })
