<script setup>
const $route = useRoute()
const config = useRuntimeConfig()
const id = +$route.params.id

const baseUrl = computed(() => {
  const raw = config.public.API_URL || ''
  return raw.replace(/\/$/, '') || 'https://merge.ppatrick.xyz'
})

const { allTokens } = useDB()

// Use lazy (non-blocking) so this page never suspends the Suspense boundary,
// which prevents the full-page loading animation from firing on PWA reload.
const { data: token } = useLazyAsyncData(`token-${id}`, async () => {
  if (process.server) {
    try {
      const res = await $fetch(`/api/token/${id}`)
      if (res && !res.error) {
        return {
          id: res.id,
          mass: res.mass,
          tier: res.tier ?? res.class ?? 1,
          class: res.tier ?? res.class ?? 1,
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
  description: `Details for m(${massVal.value}) #${id} — view merge history, ranking, matters and trade.`,
  ogTitle: `Merge — m(${massVal.value}) #${id}`,
  ogDescription: `Details for m(${massVal.value}) #${id} — view merge history, ranking, matters and trade.`,
  ogUrl: `${baseUrl.value}/${id}`,
  ogImage: `${baseUrl.value}/api/og/${id}`,
  ogImageWidth: 1400,
  ogImageHeight: 787,
  twitterTitle: `Merge — m(${massVal.value}) #${id}`,
  twitterDescription: `Details for m(${massVal.value}) #${id} — view merge history, ranking, matters and trade.`,
  twitterImage: `${baseUrl.value}/api/og/${id}`,
  twitterCard: 'summary_large_image',
})

const { open, isOpen } = useTokenDrawer()

// Open drawer immediately if we already have token data (e.g. hydration from SSR),
// otherwise wait for lazy fetch to complete so tier class is always correct.
if (!isNaN(id)) {
  if (token.value) {
    open(id, null, token.value)
  } else {
    const stop = watch(token, (val) => {
      if (val) {
        open(id, null, val)
        stop()
      }
    }, { immediate: false })
  }
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
