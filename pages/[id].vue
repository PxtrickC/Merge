<script setup>
useHead({ title: 'Merge' })

const $route = useRoute()
const { open, isOpen } = useTokenDrawer()

const id = +$route.params.id
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
