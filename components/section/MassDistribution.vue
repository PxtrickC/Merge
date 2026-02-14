<script setup>
const tokens_cache = await useAPI("/tokens_cache")

const scrollEl = useDragScroll()

const sortMode = ref('count') // 'count' | 'mass'
const BAR_MAX_HEIGHT = 220

function isPrime(n) {
  if (n < 2) return false
  if (n < 4) return true
  if (n % 2 === 0 || n % 3 === 0) return false
  for (let i = 5; i * i <= n; i += 6) {
    if (n % i === 0 || n % (i + 2) === 0) return false
  }
  return true
}

// Aggregate mass distribution from tokens_cache
const massDistribution = computed(() => {
  if (!tokens_cache.value) return []
  const countMap = {}
  for (const t of tokens_cache.value) {
    if (t.mass >= 1) {
      countMap[t.mass] = (countMap[t.mass] || 0) + 1
    }
  }
  return Object.entries(countMap)
    .map(([mass, count]) => ({ mass: Number(mass), count }))
})

const sorted_data = computed(() => {
  const items = [...massDistribution.value]
  if (sortMode.value === 'count') {
    items.sort((a, b) => b.count - a.count || a.mass - b.mass)
  } else {
    items.sort((a, b) => a.mass - b.mass)
  }
  return items.map(item => ({
    label: `m(${item.mass})`,
    count: item.count,
    prime: isPrime(item.mass),
  }))
})

// Track which bars are visible via IntersectionObserver
const visibleSet = reactive(new Set())
const barRefs = ref([])
let observer = null

function getBarHeight(count) {
  if (!visibleMax.value) return 2
  return Math.max(2, (count / visibleMax.value) * BAR_MAX_HEIGHT)
}

const visibleMax = computed(() => {
  if (visibleSet.size === 0) return 1
  let max = 0
  for (const idx of visibleSet) {
    const item = sorted_data.value[idx]
    if (item && item.count > max) max = item.count
  }
  return max || 1
})

function setupObserver() {
  if (observer) observer.disconnect()
  if (!scrollEl.value) return

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const idx = Number(entry.target.dataset.idx)
        if (entry.isIntersecting) {
          visibleSet.add(idx)
        } else {
          visibleSet.delete(idx)
        }
      }
    },
    { root: scrollEl.value, threshold: 0 }
  )

  for (const el of barRefs.value) {
    if (el) observer.observe(el)
  }
}

watch([sorted_data, scrollEl], () => {
  nextTick(setupObserver)
}, { immediate: true })

onBeforeUnmount(() => {
  if (observer) observer.disconnect()
})
</script>

<template>
  <section class="massd">
    <div class="massd__header">
      <h2 class="massd__title">Mass Distribution</h2>
      <div class="massd__toggle">
        <button
          class="massd__toggle-btn"
          :class="{ 'massd__toggle-btn--active': sortMode === 'count' }"
          @click="sortMode = 'count'"
        >by count</button>
        <span class="massd__toggle-sep">/</span>
        <button
          class="massd__toggle-btn"
          :class="{ 'massd__toggle-btn--active': sortMode === 'mass' }"
          @click="sortMode = 'mass'"
        >by mass</button>
      </div>
    </div>

    <div ref="scrollEl" class="massd__scroll">
      <div
        v-for="(item, idx) in sorted_data"
        :key="item.label"
        ref="barRefs"
        :data-idx="idx"
        class="massd__bar-group"
      >
        <span class="massd__count">{{ item.count.toLocaleString() }}</span>
        <div
          class="massd__bar"
          :style="{ height: getBarHeight(item.count) + 'px' }"
        ></div>
        <span class="massd__label" :class="{ 'massd__label--prime': item.prime }">{{ item.label }}</span>
      </div>
    </div>
  </section>
</template>

<style lang="postcss" scoped>
.massd {
  @apply py-8 md:py-12 px-4 md:px-8;
  border-top: 1px solid #1a1a1a;
}
.massd__header {
  @apply flex items-baseline justify-between mb-6 gap-4;
}
.massd__title {
  @apply text-4xl md:text-6xl text-white;
}
.massd__toggle {
  @apply flex items-baseline gap-3;
}
.massd__toggle-sep {
  @apply text-4xl md:text-6xl;
  color: rgba(255, 255, 255, 0.5);
}
.massd__toggle-btn {
  @apply text-4xl md:text-6xl;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.5);
  transition: color 0.2s;
}
.massd__toggle-btn--active {
  color: rgba(255, 255, 255, 1);
}
.massd__scroll {
  @apply flex items-end gap-3 md:gap-4;
  @apply overflow-x-auto pb-4;
  height: 300px;
  cursor: grab;
  scrollbar-width: thin;
  scrollbar-color: #333 transparent;
}
.massd__scroll::-webkit-scrollbar {
  height: 4px;
}
.massd__scroll::-webkit-scrollbar-track {
  background: transparent;
}
.massd__scroll::-webkit-scrollbar-thumb {
  background: #333;
  border-radius: 4px;
}
.massd__bar-group {
  @apply flex flex-col items-center;
  @apply flex-shrink-0;
  min-width: 44px;
}
.massd__count {
  @apply text-2xs md:text-xs mb-2;
  color: #888;
}
.massd__bar {
  @apply w-8 md:w-10 rounded-t;
  background: #fff;
  @apply transition-all duration-300;
}
.massd__bar-group:hover .massd__bar {
  background: #ccc;
}
.massd__label {
  @apply text-xs md:text-sm text-white mt-2;
}
.massd__label--prime {
  @apply underline;
}
</style>
