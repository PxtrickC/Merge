<script setup>
const stats = await useAPI("/stats")
const mass_top = await useAPI("/mass_top")
const blue_mass = await useAPI("/blue_mass")
const merges_top = await useAPI("/merges_top")

const alpha_mass = computed(() => stats.value?.alpha_mass ?? 1)
</script>

<template>
  <div>
    <section-hero />
    <section-stats-bar />
    <section-ranking title="Top Mass" :items="mass_top" :alpha-mass="alpha_mass" />
    <section-ranking title="Blue Mass" :items="blue_mass" :alpha-mass="alpha_mass" />
    <section-ranking title="Top Merges" :items="merges_top" :alpha-mass="alpha_mass" value-key="merges" />
    <section-mass-distribution />
    <section-latest-merges />
  </div>
</template>
