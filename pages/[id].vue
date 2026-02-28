<script setup>
useHead({ title: 'Merge' })

const $route = useRoute()
const { open, isOpen } = useTokenDrawer()

const id = +$route.params.id
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
    <section-latest-merges />
    <section-mass-distribution />
  </div>
</template>
