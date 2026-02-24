<script setup>
defineProps({
  id: { type: Number, default: 27000 },
  back: Boolean,
  tip: Boolean,
  path: String,
})

const $router = useRouter()
</script>

<template>
  <div class="navbar__container">
    <div class="flex items-center gap-4">
      <NuxtLink tag="a" to="/" class="text-white"><h1>Merge.</h1></NuxtLink>
      <tip v-if="tip" />
    </div>
    <div v-if="path" class="flex items-end">
      <span class="text-3xl text-white text-opacity-90">{{path}}</span>
    </div>
    <div v-if="back" class="flex items-center">
      <button @click="$router.go(-1)"><icon class="w-6" variant="return" /></button>
    </div>
    <trade-wallet-button />
  </div>
</template>

<style lang="postcss" scoped>
.navbar__container {
  @apply mb-4 md:mb-0;
  @apply flex items-center justify-between gap-4;
}
</style>
