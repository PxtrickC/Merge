<script setup>
const stats = await useAPI("/stats")
const top_100 = reactive({ mass: [], blue: [], merges: [] })
top_100.mass = await useAPI("/mass_top")
top_100.blue = await useAPI("/blue_mass")
top_100.merges = await useAPI("/merges_top")

const alpha_mass = computed(() => stats.value?.alpha_mass ?? 0)
const index = ref("mass")
</script>

<template>
  <section class="section__container">
    <div class="section__header">
      <span class="section__header_title" :class="index === 'mass' ? 'active' : 'inactive'" @click="index = 'mass'"
        >Global</span
      >
      <span class="section__sep">|</span>
      <span class="section__header_title" :class="index === 'blue' ? 'active' : 'inactive'" @click="index = 'blue'"
        >Blue</span
      >
      <span class="section__sep">|</span>
      <span class="section__header_title" :class="index === 'merges' ? 'active' : 'inactive'" @click="index = 'merges'"
        >Merges</span
      >
    </div>

    <div class="section__content">
      <merge v-for="token in top_100[index]" :key="token.id" class="w-18 md:w-24 xl:w-32" :id="+token.id" :tier="token.tier" :mass="token.mass" :alpha_mass="alpha_mass"/>
    </div>
  </section>
</template>

<style lang="postcss" scoped>
.section__container {
  @apply bg-black;
}
.section__header {
  @apply flex items-center gap-3;
  @apply cursor-pointer;
}
.section__header_title {
  @apply text-sm md:text-base tracking-widest uppercase;
  @apply transition-opacity;
}
.section__header_title.active {
  @apply text-white;
}
.section__header_title.inactive {
  color: #555;
}
.section__header_title.inactive:hover {
  color: #888;
}
.section__sep {
  color: #333;
}
.section__content {
  max-height: 60vh;
  @apply mt-4;
  @apply flex content-start flex-wrap gap-x-2 md:gap-x-6 gap-y-2;
  @apply overflow-y-auto;
}

::-webkit-scrollbar {
  @apply w-1;
}
::-webkit-scrollbar-track {
  background: #111;
}
::-webkit-scrollbar-thumb {
  background: #333;
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>
