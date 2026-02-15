<script setup>
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
    <!-- <MatterDrawer /> -->
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
