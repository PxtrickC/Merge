import { decodeValue } from "~/utils/contract.mjs"

const TOTAL_MINTED = 28990
// Tier counts from original mint (used for tier section titles)
const TIER_TOTAL = { 2: 94, 3: 50, 4: 5 }

export function useDB() {
  const { data: db, status } = useAsyncData('global-db-cache', () => {
    return $fetch('/data/db.json', { responseType: 'json' })
  }, {
    server: true,
    lazy: false,
    default: () => null
  })

  const loading = computed(() => status.value === 'pending')

  // Export a promise that resolves when db.value is available for explicit awaiting
  const prepare = new Promise((resolve) => {
    if (db.value) return resolve(db.value)
    const unwatch = watch(db, (val) => {
      if (val) {
        unwatch()
        resolve(val)
      }
    }, { immediate: true })
  })

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
  // Stats
  // ---------------------------------------------------------------------------
  const stats = computed(() => {
    const alive = aliveTokens.value
    if (!alive.length) return null
    const totalMass = alive.reduce((s, t) => s + t.mass, 0)
    const alphaMass = alive.reduce((max, t) => Math.max(max, t.mass), 0)
    return {
      token_count: alive.length,
      merged_count: TOTAL_MINTED - alive.length,
      total_mass: totalMass,
      alpha_mass: alphaMass,
    }
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
      return aliveTokens.value.filter(t => t.tier === tier).length
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
