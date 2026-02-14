<script setup>
const props = defineProps({
  id: Number,
  tier: Number,
  mass: Number,
  alpha_mass: { type: Number, default: 12149 },
})

const { open } = useTokenDrawer()
const is_alpha = computed(() => props.mass >= props.alpha_mass)
</script>

<template>
  <div class="merge__container" @click="open(id)">
    <merge-svg class="rounded-lg" :tier="tier" :mass="mass" :alpha_mass="alpha_mass" />
    <div class="merge_label" :class="{ 'merge_label--alpha': is_alpha }">
      <span>m({{mass}})</span>
      <span>#{{id}}</span>
    </div>
  </div>
</template>

<style lang="postcss" scoped>
.merge__container {
  @apply cursor-pointer;
}
.merge_label {
  @apply mt-1;
  @apply py-0.5 px-1.5 xl:py-1 xl:px-2;
  @apply flex justify-between;
  @apply text-3xs md:text-2xs xl:text-sm;
  color: #555;
}
.merge_label--alpha {
  @apply text-white font-medium;
}
</style>
