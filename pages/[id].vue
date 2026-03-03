<script setup>
const $route = useRoute()
const id = +$route.params.id

useHead({
  title: `Merge — Token #${id}`,
  meta: [
    { name: 'description', content: `Details for Merge token #${id} — view tier, mass, merge history, ranking, and trade.` },
  ],
})

const { open, isOpen } = useTokenDrawer()
if (!isNaN(id)) {
  open(id)
}

watch(isOpen, (val) => {
  if (!val) {
    navigateTo('/', { replace: false })
  }
})
</script>

<template>
  <div>
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
