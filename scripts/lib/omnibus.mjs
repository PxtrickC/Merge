/**
 * Shared helpers for the daily NG Omnibus snapshot (count + mass).
 *
 * Used by both scripts/update-db.mjs (CI) and scripts/sync.mjs (manual).
 *
 * Two safeguards live here:
 *   1. Pagination is deduplicated (Set) and guarded against repeated pageKeys,
 *      truncated responses and HTTP errors — a duplicated page used to double
 *      the count (2026-07-22), a swallowed error used to drop pages (2026-08-09).
 *   2. A sanity check against the previous day rejects implausible jumps, with
 *      one re-fetch so a genuine large move can still get through.
 */
import { MERGE_CONTRACT_ADDRESS, NIFTY_OMNIBUS_ADDRESS } from "../../utils/contract.mjs"

const CLASS_DIVISOR = 100_000_000
const PAGE_SIZE = 100
const MAX_PAGES = 500
const RECHECK_DELAY_MS = 3000
const PAGE_RETRIES = 4
const PAGE_RETRY_BASE_MS = 500

// Omnibus holdings only shrink over time (tokens leave NG custody and never
// come back in bulk), so any meaningful jump upward means the fetch went wrong.
const MAX_INCREASE = 10
const MAX_DECREASE_RATIO = 0.1
const MIN_DECREASE_ALLOWANCE = 100

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

/** GET with retries on 429/5xx — the free Alchemy tier throws occasional 503s mid-pagination. */
async function fetchPage(url) {
  let lastErr
  for (let attempt = 0; attempt <= PAGE_RETRIES; attempt++) {
    if (attempt > 0) await sleep(PAGE_RETRY_BASE_MS * 2 ** (attempt - 1))
    try {
      const res = await fetch(url)
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
      json = await fetchPage(url)
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

/** True when `count` is a believable next value after `prevCount`. */
export function isPlausibleOmnibusCount(prevCount, count) {
  if (!Number.isFinite(prevCount) || prevCount <= 0) return true
  if (!Number.isFinite(count) || count < 0) return false
  if (count > prevCount + MAX_INCREASE) return false
  const maxDrop = Math.max(MIN_DECREASE_ALLOWANCE, prevCount * MAX_DECREASE_RATIO)
  return prevCount - count <= maxDrop
}

/**
 * Fetch a snapshot and sanity-check it against the previous day's count.
 * Returns null when the value stays implausible after a re-fetch — callers
 * should then carry the previous day's values forward.
 */
export async function resolveOmnibusSnapshot(db, alchemyKey, prevCount, log = console.log) {
  const first = await fetchOmnibusSnapshot(db, alchemyKey)
  if (isPlausibleOmnibusCount(prevCount, first.count)) return first

  log(`  ⚠️  Omnibus count ${first.count} implausible vs previous day (${prevCount}) — re-checking...`)
  await sleep(RECHECK_DELAY_MS)
  const second = await fetchOmnibusSnapshot(db, alchemyKey)

  if (isPlausibleOmnibusCount(prevCount, second.count)) {
    log(`  ✅ Re-check returned ${second.count} — first read was a fetch glitch`)
    return second
  }
  if (second.count === first.count && second.mass === first.mass) {
    log(`  ⚠️  Re-check identical (${second.count}) — accepting as a real change`)
    return second
  }

  log(`  ⚠️  Re-check disagreed (${first.count} vs ${second.count}) — snapshot rejected`)
  return null
}
