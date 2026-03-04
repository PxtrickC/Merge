import { decodeValue } from "~/utils/contract.mjs"

const TOTAL_MINTED = 28990
// Tier counts from original mint (used for tier section titles)
const TIER_TOTAL = { 2: 94, 3: 50, 4: 5 }

export function useDB() {
  const { data: db, pending: loading } = useNuxtData('global-db-json')

  // Fetch a lightweight summary for SSR to avoid 3MB payload and 504 timeouts
  const { data: summary } = useFetch('/api/db-summary', {
    key: 'db-summary',
    server: true,
    pick: ['token_count', 'merged_count', 'total_mass', 'alpha_mass', 'tier_counts']
  })

  // On client, if full DB is missing, trigger lazy fetch
  if (process.client && !db.value && !loading.value) {
    useFetch('/data/db.json', { key: 'global-db-json', server: false, lazy: true })
  }

  const prepare = async () => {
    return db.value || null
  }

  // ---------------------------------------------------------------------------
  // Decode all alive tokens
  // ---------------------------------------------------------------------------
  const aliveTokens = computed(() => {
    if (!db.value?.tokens) return []
    const tokens = db.value.tokens
    const result = []
    for (let id = 1; id < tokens.length; id++) {
      const entry = tokens[id]
      if (!entry || entry[2] !== 0 || entry[0] === 0) continue // null, burned, or invalid
      const { class: tier, mass } = decodeValue(entry[0])
      result.push({ id, tier, mass, merges: entry[1] })
    }
    return result
  })

  // ---------------------------------------------------------------------------
  // Decode all burned tokens
  // ---------------------------------------------------------------------------
  const burnedTokens = computed(() => {
    if (!db.value?.tokens) return []
    const tokens = db.value.tokens
    const results = []
    for (let id = 1; id < tokens.length; id++) {
      const entry = tokens[id]
      if (!entry || entry[2] === 0) continue
      const { class: tier, mass } = entry[0] > 0 ? decodeValue(entry[0]) : { class: 0, mass: 0 }
      results.push({ id, tier, mass, merges: entry[1] || 0, burned: true, mergedTo: entry[2] })
    }
    return results
  })

  const allTokens = computed(() => {
    return [...(aliveTokens.value || []), ...(burnedTokens.value || [])]
  })

  // ---------------------------------------------------------------------------
  // Stats - Falls back to summary during SSR
  // ---------------------------------------------------------------------------
  const stats = computed(() => {
    if (db.value?.tokens && aliveTokens.value.length > 0) {
      const alive = aliveTokens.value
      return {
        token_count: alive.length,
        merged_count: TOTAL_MINTED - alive.length,
        total_mass: alive.reduce((s, t) => s + t.mass, 0),
        alpha_mass: alive.reduce((max, t) => Math.max(max, t.mass), 0),
      }
    }
    return summary.value || null
  })

  // ---------------------------------------------------------------------------
  // Rankings
  // ---------------------------------------------------------------------------
  function byTier(tier) {
    return computed(() => {
      return aliveTokens.value.filter(t => t.tier === tier)
    })
  }

  function tierCount(tier) {
    return computed(() => {
      if (db.value?.tokens) {
        return aliveTokens.value.filter(t => t.tier === tier).length
      }
      return summary.value?.tier_counts?.[tier] ?? 0
    })
  }

  // ---------------------------------------------------------------------------
  // Mass distribution
  // ---------------------------------------------------------------------------
  const massDistribution = computed(() => {
    const alive = aliveTokens.value
    if (!alive.length) return []
    const countMap = new Map()
    for (const t of alive) {
      countMap.set(t.mass, (countMap.get(t.mass) || 0) + 1)
    }
    return [...countMap.entries()].map(([mass, count]) => ({ mass, count }))
  })

  // ---------------------------------------------------------------------------
  // Merged-into index: persistId → [burnedId, ...]
  // ---------------------------------------------------------------------------
  const mergedIntoIndex = computed(() => {
    if (!db.value?.tokens) return new Map()
    const index = new Map()
    const tokens = db.value.tokens
    for (let id = 1; id < tokens.length; id++) {
      const entry = tokens[id]
      if (!entry || entry[2] === 0) continue // alive or null
      const persistId = entry[2]
      if (!index.has(persistId)) index.set(persistId, [])
      index.get(persistId).push(id)
    }
    return index
  })

  // ---------------------------------------------------------------------------
  // Alpha token (highest mass) — returns { id, mass } or null
  // ---------------------------------------------------------------------------
  const alphaToken = computed(() => {
    const alive = aliveTokens.value
    if (!alive.length) return null
    return alive.reduce((best, t) => t.mass > best.mass ? t : best)
  })
  const alphaMass = computed(() => alphaToken.value?.mass ?? 0)

  // ---------------------------------------------------------------------------
  // Tier total from mint (for section titles like "Yellow Mass 82/94")
  // ---------------------------------------------------------------------------
  function tierTotal(tier) {
    return TIER_TOTAL[tier] ?? 0
  }

  return {
    db,
    loading,
    aliveTokens,
    burnedTokens,
    allTokens,
    stats,
    alphaToken,
    alphaMass,
    byTier,
    tierCount,
    tierTotal,
    massDistribution,
    mergedIntoIndex,
    prepare,
  }
}
