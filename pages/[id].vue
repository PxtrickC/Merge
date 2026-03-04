<script setup>
const $route = useRoute()
const config = useRuntimeConfig()
const id = +$route.params.id

const baseUrl = computed(() => {
  const raw = config.public.API_URL || ''
  return raw.replace(/\/$/, '') || 'https://merge.ppatrick.xyz'
})

useSeoMeta({
  title: `Merge — Token #${id}`,
  description: `Details for Merge token #${id} — view tier, mass, merge history, ranking, and trade.`,
  ogTitle: `Merge — Token #${id}`,
  ogDescription: `Details for Merge token #${id} — view tier, mass, merge history, ranking, and trade.`,
  ogImage: `${baseUrl.value}/api/og/${id}`,
  twitterTitle: `Merge — Token #${id}`,
  twitterDescription: `Details for Merge token #${id} — view tier, mass, merge history, ranking, and trade.`,
  twitterImage: `${baseUrl.value}/api/og/${id}`,
  twitterCard: 'summary_large_image',
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
