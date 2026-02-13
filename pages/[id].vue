<script setup>
const $route = useRoute()
const $router = useRouter()

if (isNaN($route.params.id)) $router.push("/")

const stats = await useAPI("/stats")
const { token } = await useToken(+$route.params.id)

// Small delay to avoid Etherscan rate limit (1 req/sec on free tier)
await new Promise(r => setTimeout(r, 1200))

const [{ transfers }, { timeline: mergeTimeline, initialMass }] = await Promise.all([
  useTokenTransfers(+$route.params.id),
  useTokenMergeTimeline(+$route.params.id),
])

const alpha_mass = computed(() => stats.value?.alpha_mass ?? 0)

const tokenData = computed(() => {
  if (!token.value) return null
  return {
    ...token.value,
    merged_to: token.value.mergedTo ?? null,
    merged_on: token.value.mergedOn ?? null,
  }
})
</script>

<template>
  <section class="overview">
    <div class="overview__nav">
      <button class="text-white" @click="$router.go(-1)"><icon class="w-6" variant="return" /></button>
    </div>
    <div v-if="tokenData" class="overview__content">
      <card-token v-bind="tokenData" :token_class="tokenData.class" :alpha_mass="alpha_mass" />
      <card-merged v-bind="tokenData" />
      <div class="col-span-full grid grid-cols-1 md:grid-cols-2 gap-8">
        <card-merges v-if="tokenData.merges > 0" :id="+tokenData.id" />
        <card-activity
          :id="+tokenData.id"
          :merged="tokenData.merged"
          :merged_to="tokenData.merged_to"
          :merged_on="tokenData.merged_on"
          :transfers="transfers"
          :merge-timeline="mergeTimeline"
          :initial-mass="initialMass"
        />
      </div>
    </div>
    <div v-else class="overview__content">
      <p class="text-white text-opacity-60">Loading token data...</p>
    </div>
  </section>
</template>

<style lang="postcss" scoped>
section.overview {
  @apply bg-black;
  @apply p-4 md:p-8;
}
.overview__nav {
  @apply mb-4 md:mb-0;
}
.overview__content {
  @apply mt-6;
  @apply grid grid-cols-1 md:grid-cols-3 gap-8;
}
</style>
