<script setup>
const $route = useRoute()
const config = useRuntimeConfig()
const id = +$route.params.id

const baseUrl = computed(() => {
  const raw = config.public.API_URL || ''
  return raw.replace(/\/$/, '') || 'https://merge.ppatrick.xyz'
})

const { allTokens, prepare } = useDB()
if (prepare) await prepare()

const { data: token } = await useAsyncData(`token-${id}`, async () => {
  if (process.server) {
    try {
      const res = await $fetch(`/api/token/${id}`)
      if (res && !res.error) {
        return {
          id: res.id,
          mass: res.mass,
          tier: res.tier,
          class: res.tier,
          merges: res.merges,
          merged: res.isMerged,
          owner: res.isMerged ? `Merged to #${res.mergedTo}` : null
        }
      }
    } catch (e) {
      console.error('SSR token fetch failed:', e)
    }
  }

  const found = allTokens.value?.find(t => t.id === id)
  if (found) return found
  
  // If not in db, try RPC fallback
  const { token: rpcToken } = await useToken(id)
  return rpcToken.value
})

const massVal = computed(() => token.value?.mass ?? '\u2014')

useServerSeoMeta({
  title: `Merge — m(${massVal.value}) #${id}`,
  description: `Details for Merge m(${massVal.value}) #${id} — view tier, mass, merge history, ranking, and trade.`,
  ogTitle: `Merge — m(${massVal.value}) #${id}`,
  ogDescription: `Details for Merge m(${massVal.value}) #${id} — view tier, mass, merge history, ranking, and trade.`,
  ogImage: `${baseUrl.value}/api/og/${id}`,
  twitterTitle: `Merge — m(${massVal.value}) #${id}`,
  twitterDescription: `Details for Merge m(${massVal.value}) #${id} — view tier, mass, merge history, ranking, and trade.`,
  twitterImage: `${baseUrl.value}/api/og/${id}`,
  twitterCard: 'summary_large_image',
})

const { open, isOpen } = useTokenDrawer()
if (!isNaN(id)) {
  open(id, null, token.value)
}

watch(isOpen, (val) => {
  if (!val) {
    navigateTo('/', { replace: false })
  }
})
</script>

<template>
  <ClientOnly>
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
  </ClientOnly>
</template>
