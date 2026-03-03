<script setup>
useHead({
  title: 'Merge — Dashboard',
  meta: [
    { name: 'description', content: 'Live dashboard for Merge by Pak — track supply deflation, alpha mass, tier survival, merge rate, and NG Omnibus stats.' },
  ],
})

const { stats, tierCount } = useDB()
const t1 = tierCount(1)
const t2 = tierCount(2)
const t3 = tierCount(3)
const t4 = tierCount(4)
const geoSummary = computed(() => {
  const s = stats.value
  if (!s) return ''
  return `Merge by Pak: ${s.token_count.toLocaleString()} tokens alive out of 28,990 minted. Alpha mass: ${s.alpha_mass.toLocaleString()}. Total mass: ${s.total_mass.toLocaleString()}. ${s.merged_count.toLocaleString()} tokens burned. Tier 1 (white): ${t1.value.toLocaleString()}, Tier 2 (yellow): ${t2.value.toLocaleString()}, Tier 3 (blue): ${t3.value.toLocaleString()}, Tier 4 (red): ${t4.value.toLocaleString()}.`
})
</script>

<template>
  <div>
    <p v-if="geoSummary" class="sr-only">{{ geoSummary }}</p>
    <section-stats-bar />
    <section-my-merge />
    <section-latest-merges />
    <section-chart-supply />
    <section-chart-merge-rate />
    <section-chart-tier-survival />
    <section-chart-alpha />
    <section-chart-omnibus />
    <section-chart-concentration />
    <section-mass-distribution />
  </div>
</template>
