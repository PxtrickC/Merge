<script setup>
const stats = await useAPI("/stats")
const mass_top = await useAPI("/mass_top")
const yellow_mass = await useAPI("/yellow_mass")
const blue_mass = await useAPI("/blue_mass")
const red_mass = await useAPI("/red_mass")
const merges_top = await useAPI("/merges_top")

const alpha_mass = computed(() => stats.value?.alpha_mass ?? 1)
</script>

<template>
  <div>
    <section-hero />
    <section-stats-bar />
    <section-latest-merges />
    <section-ranking title="Top Mass" :items="mass_top" :alpha-mass="alpha_mass" />
    <section-ranking title="Top Merges" :items="merges_top" :alpha-mass="alpha_mass" value-key="merges" />
    <section-ranking :title="`Yellow Mass ${yellow_mass?.length ?? 0}/94`" :items="yellow_mass" :alpha-mass="alpha_mass" sortable />
    <section-ranking :title="`Blue Mass ${blue_mass?.length ?? 0}/50`" :items="blue_mass" :alpha-mass="alpha_mass" sortable />
    <section-ranking :title="`Red Mass ${red_mass?.length ?? 0}/5`" :items="red_mass" :alpha-mass="alpha_mass" />
    <section-mass-distribution />
  </div>
</template>
