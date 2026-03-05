<script setup>
// db.json is now handled lazily in useDB.js and db-summary API is used for SSR stats.

const loading = ref(true)
const { isOpen: drawerIsOpen } = useTokenDrawer()

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
      <Loading v-if="loading && !drawerIsOpen" />
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
