<script setup>
// Load db.json ONCE globally, blocking SSR rendering until it succeeds
const baseUrl = process.server ? useRequestURL().origin : ''
await useFetch(`${baseUrl}/data/db.json`, { key: 'global-db-json', server: true })

const loading = ref(true)

function onPending() {
  loading.value = true
}

function onResolve() {
  setTimeout(() => {
    loading.value = false
  }, 1500)
}
</script>

<template>
  <NuxtLayout>
    <Suspense @pending="onPending" @resolve="onResolve">
      <NuxtPage />
    </Suspense>
    <Transition name="fade">
      <Loading v-if="loading" />
    </Transition>
    <TokenDrawer />
  </NuxtLayout>
</template>

<style>
.fade-leave-active {
  transition: opacity 0.4s ease;
}
.fade-leave-to {
  opacity: 0;
}
</style>
