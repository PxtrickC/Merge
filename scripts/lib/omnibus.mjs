/**
 * Shared helpers for the daily NG Omnibus snapshot (count + mass).
 *
 * Used by both scripts/update-db.mjs (CI) and scripts/sync.mjs (manual).
 *
 * Two safeguards live here:
 *   1. Pagination is deduplicated (Set) and guarded against repeated pageKeys,
 *      truncated responses and HTTP errors — a duplicated page used to double
 *      the count (2026-07-22).
 *   2. The enumerated count must equal the contract's on-chain balanceOf.
 *      Alchemy sometimes ends pagination early with a well-formed terminal page
 *      (2026-08-09: 6900 = 69 pages, 2026-10-02: 7200 = 72 pages) and repeats the
 *      same truncated result on an immediate re-fetch, so only an independent
 *      source can tell a glitch from a real move.
 */
import { MERGE_CONTRACT_ADDRESS, NIFTY_OMNIBUS_ADDRESS } from "../../utils/contract.mjs"

const CLASS_DIVISOR = 100_000_000
const PAGE_SIZE = 100
const MAX_PAGES = 500
const PAGE_RETRIES = 4
const PAGE_RETRY_BASE_MS = 500
const SNAPSHOT_ATTEMPTS = 3
const RECHECK_DELAY_MS = 5000
const BALANCE_OF_SELECTOR = "0x70a08231"

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

/** Fetch JSON with retries on 429/5xx — the free Alchemy tier throws occasional 503s mid-pagination. */
async function fetchJSON(url, init) {
  let lastErr
  for (let attempt = 0; attempt <= PAGE_RETRIES; attempt++) {
    if (attempt > 0) await sleep(PAGE_RETRY_BASE_MS * 2 ** (attempt - 1))
    try {
      const res = await fetch(url, init)
      if (res.ok) return await res.json()
      lastErr = new Error(`Alchemy HTTP ${res.status}`)
      if (res.status !== 429 && res.status < 500) throw lastErr
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr
}

/**
 * Fetch the current omnibus token ids via Alchemy and sum their mass from db.
 * Throws on any pagination or transport problem rather than returning a partial count.
 */
export async function fetchOmnibusSnapshot(db, alchemyKey) {
  const tokenIds = new Set()
  const seenPageKeys = new Set()
  let pageKey
  let complete = false

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(`https://eth-mainnet.g.alchemy.com/nft/v3/${alchemyKey}/getNFTsForOwner`)
    url.searchParams.set("owner", NIFTY_OMNIBUS_ADDRESS)
    url.searchParams.set("contractAddresses[]", MERGE_CONTRACT_ADDRESS)
    url.searchParams.set("withMetadata", "false")
    url.searchParams.set("pageSize", String(PAGE_SIZE))
    if (pageKey) url.searchParams.set("pageKey", pageKey)

    let json
    try {
      json = await fetchJSON(url)
    } catch (err) {
      throw new Error(`${err.message} on page ${page + 1}`)
    }
    if (json.error) throw new Error(`Alchemy error: ${json.error.message || json.error}`)
    if (!Array.isArray(json.ownedNfts)) throw new Error(`Alchemy response missing ownedNfts on page ${page + 1}`)

    for (const nft of json.ownedNfts) {
      const id = parseInt(nft.tokenId)
      if (Number.isFinite(id)) tokenIds.add(id)
    }

    if (!json.pageKey) { complete = true; break }
    if (seenPageKeys.has(json.pageKey)) throw new Error("Alchemy returned a repeated pageKey")
    seenPageKeys.add(json.pageKey)
    pageKey = json.pageKey
  }

  if (!complete) throw new Error(`Pagination exceeded ${MAX_PAGES} pages`)

  let mass = 0
  for (const id of tokenIds) {
    const entry = db.tokens[id]
    if (entry && entry[0] > 0) mass += entry[0] % CLASS_DIVISOR
  }

  return { count: tokenIds.size, mass }
}

/** On-chain balanceOf(omnibus) on the Merge contract — the authoritative token count. */
export async function fetchOmnibusBalance(alchemyKey) {
  const data = BALANCE_OF_SELECTOR + NIFTY_OMNIBUS_ADDRESS.slice(2).padStart(64, "0")
  const json = await fetchJSON(`https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: MERGE_CONTRACT_ADDRESS, data }, "latest"] }),
  })
  if (json.error) throw new Error(`balanceOf failed: ${json.error.message || json.error}`)
  const balance = parseInt(json.result, 16)
  if (!Number.isFinite(balance)) throw new Error(`balanceOf returned ${json.result}`)
  return balance
}

/**
 * Fetch a snapshot whose count matches on-chain balanceOf, re-fetching a few
 * times to ride out truncated pagination or a transfer landing mid-fetch.
 * Returns null when they never agree — callers should then keep the values
 * they already have rather than record a partial count.
 */
export async function resolveOmnibusSnapshot(db, alchemyKey, log = console.log) {
  for (let attempt = 1; attempt <= SNAPSHOT_ATTEMPTS; attempt++) {
    if (attempt > 1) await sleep(RECHECK_DELAY_MS * (attempt - 1))
    const snapshot = await fetchOmnibusSnapshot(db, alchemyKey)
    const balance = await fetchOmnibusBalance(alchemyKey)
    if (snapshot.count === balance) return snapshot
    log(`  ⚠️  Alchemy listed ${snapshot.count} omnibus tokens but balanceOf is ${balance} (attempt ${attempt}/${SNAPSHOT_ATTEMPTS})`)
  }
  log(`  ⚠️  Omnibus enumeration never matched balanceOf — snapshot rejected`)
  return null
}
