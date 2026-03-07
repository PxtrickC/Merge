export function useSupplyHistory() {
  // Use useFetch at the top level of the composable
  const { data: history, pending: loading } = useFetch('/data/supply_history.json', {
    key: 'supply-history',
    server: true, // Allow SSR to fetch it once
    lazy: true    // Don't block navigation
  })

  // Generate date strings from startDate + index
  const dates = computed(() => {
    if (!history.value) return []
    const start = new Date(history.value.startDate + 'T00:00:00Z')
    return history.value.data.map((_, i) => {
      const d = new Date(start)
      d.setUTCDate(d.getUTCDate() + i)
      return d.toISOString().slice(0, 10)
    })
  })

  // Column extractors: [alive, t1, t2, t3, t4, alphaMass, mergeCount, omnibusCount, omnibusMass]
  const aliveOverTime = computed(() => history.value?.data.map(r => r[0]) ?? [])
  const tier1OverTime = computed(() => history.value?.data.map(r => r[1]) ?? [])
  const tier2OverTime = computed(() => history.value?.data.map(r => r[2]) ?? [])
  const tier3OverTime = computed(() => history.value?.data.map(r => r[3]) ?? [])
  const tier4OverTime = computed(() => history.value?.data.map(r => r[4]) ?? [])
  const alphaMassOverTime = computed(() => history.value?.data.map(r => r[5]) ?? [])
  const mergeCountOverTime = computed(() => history.value?.data.map(r => r[6]) ?? [])
  const omnibusOverTime = computed(() => history.value?.data.map(r => r[7]) ?? [])
  const omnibusMassOverTime = computed(() => history.value?.data.map(r => r[8]) ?? [])
  const alphaChanges = computed(() => history.value?.alphaChanges ?? [])
  const alphaTokenHistory = computed(() => history.value?.alphaTokenHistory ?? null)

  return {
    history,
    loading,
    dates,
    aliveOverTime,
    tier1OverTime,
    tier2OverTime,
    tier3OverTime,
    tier4OverTime,
    alphaMassOverTime,
    mergeCountOverTime,
    omnibusOverTime,
    omnibusMassOverTime,
    alphaChanges,
    alphaTokenHistory,
  }
}
