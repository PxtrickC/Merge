<script setup>
const $route = useRoute()
const $router = useRouter()

if (isNaN($route.params.id)) $router.push("/")

const stats = await useAPI("/stats")
const { token } = await useToken(+$route.params.id)
const { mergedTo, mergedOn } = await useTokenMergeHistory(+$route.params.id)

const alpha_mass = computed(() => stats.value?.alpha_mass ?? 0)

const tokenData = computed(() => {
  if (!token.value) return null
  return {
    ...token.value,
    merged_to: mergedTo.value,
    merged_on: mergedOn.value,
  }
})
</script>

<template>
  <section class="overview">
    <nav-bar :id="+$route.params.id" back />
    <div v-if="tokenData" class="overview__content">
      <card-token v-bind="tokenData" :token_class="tokenData.class" :alpha_mass="alpha_mass" />
      <card-merged v-bind="tokenData" />
      <card-merges v-if="tokenData.merges > 0" :id="+tokenData.id" />
    </div>
    <div v-else class="overview__content">
      <p class="text-white text-opacity-60">Loading token data...</p>
    </div>
  </section>
</template>

<style lang="postcss" scoped>
section.overview {
  @apply bg-black;
}
.overview__content {
  @apply mt-6;
  @apply grid grid-cols-1 md:grid-cols-3 gap-8;
}
</style>
