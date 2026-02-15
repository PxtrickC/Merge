<script setup>
const { stats, alphaMass, aliveTokens, byTier, tierCount, tierTotal } = useDB()

const yellow_mass = byTier(2)
const blue_mass = byTier(3)
const red_mass = byTier(4)

const yellowCount = tierCount(2)
const blueCount = tierCount(3)
const redCount = tierCount(4)

const alpha_mass = computed(() => stats.value?.alpha_mass ?? 1)
</script>

<template>
  <div>
    <section-hero />
    <section-stats-bar />
    <section-latest-merges />
    <section-ranking :title="`All Mass ${stats?.token_count ?? ''}/28990`" :items="aliveTokens" :alpha-mass="alpha_mass" searchable />
    <section-ranking :title="`Yellow Mass ${yellowCount}/${tierTotal(2)}`" :items="yellow_mass" :alpha-mass="alpha_mass" filterable :tier="2" />
    <section-ranking :title="`Blue Mass ${blueCount}/${tierTotal(3)}`" :items="blue_mass" :alpha-mass="alpha_mass" filterable :tier="3" />
    <section-ranking :title="`Red Mass ${redCount}/${tierTotal(4)}`" :items="red_mass" :alpha-mass="alpha_mass" />
    <section-mass-distribution />
  </div>
</template>
