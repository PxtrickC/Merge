<script setup>
const props = defineProps({
  title: String,
  items: Array,
  alphaMass: Number,
  valueKey: { type: String, default: null },
})

const scrollEl = useDragScroll()

function sphereSize(mass) {
  const ratio = Math.pow(mass / (props.alphaMass || 1), 1 / 3)
  return Math.max(40, ratio * 100) + 'px'
}

// Make circle fill the sphere-wrap; size difference is handled by container
function fillAlpha(tier, mass) {
  const am = props.alphaMass || 1
  if (mass >= am) return am
  // Tier 3 (blue) / 4 (red): background is the distinctive color, keep circle small
  if (tier >= 3) return am
  // Small offset so circle fills container without triggering alpha class
  return mass + 0.01
}
</script>

<template>
  <section class="ranking">
    <h2 class="ranking__title">{{ title }}</h2>

    <div ref="scrollEl" class="ranking__scroll">
      <NuxtLink
        v-for="(token, i) in (items ?? [])"
        :key="token.id"
        :to="`/${token.id}`"
        class="ranking__item"
      >
        <div class="ranking__rank">{{ i + 1 }}</div>
        <div
          class="sphere-wrap"
          :style="{ width: sphereSize(token.mass), height: sphereSize(token.mass) }"
        >
          <merge-svg :tier="token.tier" :mass="token.mass" :alpha_mass="fillAlpha(token.tier, token.mass)" />
        </div>
        <div class="ranking__info">
          <span class="ranking__id">#{{ token.id }}</span>
          <span v-if="valueKey" class="ranking__value">{{ token[valueKey]?.toLocaleString() }} merges</span>
          <span v-else class="ranking__value">m({{ token.mass?.toLocaleString() }})</span>
        </div>
      </NuxtLink>
    </div>
  </section>
</template>

<style lang="postcss" scoped>
.ranking {
  @apply py-8 md:py-12 px-4 md:px-8;
  border-top: 1px solid #1a1a1a;
}
.ranking__title {
  @apply text-4xl md:text-6xl text-white mb-6;
}
.ranking__scroll {
  @apply flex items-end gap-6 md:gap-8;
  @apply overflow-x-auto pb-4;
  scrollbar-width: thin;
  scrollbar-color: #333 transparent;
}
.ranking__scroll::-webkit-scrollbar {
  height: 4px;
}
.ranking__scroll::-webkit-scrollbar-track {
  background: transparent;
}
.ranking__scroll::-webkit-scrollbar-thumb {
  background: #333;
  border-radius: 4px;
}
.ranking__item {
  @apply flex flex-col items-center;
  @apply flex-shrink-0;
  @apply cursor-pointer;
  @apply transition-transform duration-200;
}
.ranking__item:hover {
  transform: scale(1.08);
}
.ranking__rank {
  @apply text-lg md:text-xl font-medium mb-2;
  color: #333;
}
.ranking__info {
  @apply mt-2 flex flex-col items-center;
}
.ranking__id {
  @apply text-2xs md:text-xs;
  color: #555;
}
.ranking__value {
  @apply text-xs md:text-sm text-white;
}
</style>
