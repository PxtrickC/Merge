<script setup>
const props = defineProps({
  title: String,
  items: Array,
  alphaMass: Number,
  valueKey: { type: String, default: null },
  sortable: { type: Boolean, default: false },
})

const scrollEl = useDragScroll()
const sortMode = ref('mass') // 'mass' | 'id'

const sortedItems = computed(() => {
  if (!props.items) return []
  if (!props.sortable || sortMode.value === 'mass') return props.items
  return [...props.items].sort((a, b) => a.id - b.id)
})

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
    <div class="ranking__header">
      <h2 class="ranking__title">{{ title }}</h2>
      <div v-if="sortable" class="ranking__toggle">
        <button
          class="ranking__toggle-btn"
          :class="{ 'ranking__toggle-btn--active': sortMode === 'mass' }"
          @click="sortMode = 'mass'"
        >mass</button>
        <span class="ranking__toggle-sep">/</span>
        <button
          class="ranking__toggle-btn"
          :class="{ 'ranking__toggle-btn--active': sortMode === 'id' }"
          @click="sortMode = 'id'"
        >id</button>
      </div>
    </div>


    <div ref="scrollEl" class="ranking__scroll">
      <TransitionGroup name="rank">
      <NuxtLink
        v-for="(token, i) in sortedItems"
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
      </TransitionGroup>
    </div>
  </section>
</template>

<style lang="postcss" scoped>
.ranking {
  @apply py-8 md:py-12;
  border-top: 1px solid #1a1a1a;
}
.ranking__header {
  @apply flex items-center sm:items-baseline justify-between mb-6 gap-2 sm:gap-4 px-4 md:px-8;
}
.ranking__title {
  @apply text-2xl sm:text-4xl md:text-6xl text-white;
}
.ranking__toggle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
}
@media (min-width: 1024px) {
  .ranking__toggle {
    display: flex;
    gap: 0.75rem;
    align-items: baseline;
  }
}
.ranking__toggle-sep {
  display: none;
  color: rgba(255, 255, 255, 0.5);
}
@media (min-width: 1024px) {
  .ranking__toggle-sep {
    display: inline;
    font-size: 2.25rem;
    line-height: 2.5rem;
  }
}
@media (min-width: 1081px) {
  .ranking__toggle-sep {
    font-size: 3.75rem;
    line-height: 1;
  }
}
.ranking__toggle-btn {
  font-size: 1rem;
  line-height: 1;
  padding: 0 0.4rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 1.5rem;
  flex: 1;
  background: none;
  border: none;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.5);
  transition: color 0.2s, background-color 0.2s;
}
.ranking__toggle-btn--active {
  background: #fff;
  color: #000;
}
@media (min-width: 1024px) {
  .ranking__toggle-btn {
    font-size: 2.25rem;
    line-height: 2.5rem;
    padding: 0;
    flex: none;
    justify-content: initial;
    height: auto;
  }
  .ranking__toggle-btn--active {
    background: none;
    color: rgba(255, 255, 255, 1);
  }
}
@media (min-width: 1081px) {
  .ranking__toggle-btn {
    font-size: 3.75rem;
    line-height: 1;
  }
}
.rank-move {
  transition: transform 1s ease;
}
.ranking__scroll {
  @apply flex items-end gap-4 sm:gap-6 md:gap-8;
  @apply overflow-x-auto pb-4 px-4 md:px-8;
  scrollbar-width: none;
}
.ranking__scroll::-webkit-scrollbar {
  display: none;
}
@media (min-width: 1024px) {
  .ranking__scroll {
    scrollbar-width: thin;
    scrollbar-color: #333 transparent;
  }
  .ranking__scroll::-webkit-scrollbar {
    display: block;
    height: 4px;
  }
  .ranking__scroll::-webkit-scrollbar-track {
    background: transparent;
  }
  .ranking__scroll::-webkit-scrollbar-thumb {
    background: #333;
    border-radius: 4px;
  }
}
.ranking__item {
  @apply flex flex-col items-center;
  @apply flex-shrink-0;
  @apply cursor-pointer;
  transition: transform 0.2s ease;
}
.ranking__item.rank-move {
  transition: transform 1s ease;
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
