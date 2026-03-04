<script setup>
const $route = useRoute()
const config = useRuntimeConfig()
const id = +$route.params.id

const baseUrl = computed(() => {
  const raw = config.public.API_URL || ''
  return raw.replace(/\/$/, '') || 'https://merge.ppatrick.xyz'
})

useHead({
  title: `Merge — Token #${id}`,
  meta: [
    { name: 'description', content: `Details for Merge token #${id} — view tier, mass, merge history, ranking, and trade.` },
    { hid: 'og:title', property: 'og:title', content: `Merge — Token #${id}` },
    { hid: 'og:image', property: 'og:image', content: `${baseUrl.value}/api/og/${id}` },
    { hid: 'twitter:image', name: 'twitter:image', content: `${baseUrl.value}/api/og/${id}` },
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
