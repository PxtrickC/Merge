<script setup>
const { massDistribution } = useDB()

const scrollEl = useDragScroll()

const sortMode = ref('mass') // 'mass' | 'count'
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

const sorted_data = computed(() => {
  if (!massDistribution.value) return []
  const items = [...massDistribution.value].filter(d => d.count > 0)
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

const globalMax = computed(() => {
  const items = sorted_data.value
  if (!items.length) return 1
  return Math.max(...items.map(d => d.count))
})

const visibleMax = computed(() => {
  if (visibleSet.size === 0) return globalMax.value
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

// Track scroll position for nav arrows
const atStart = ref(true)
const atEnd = ref(false)

function updateScrollState() {
  if (!scrollEl.value) return
  const { scrollLeft, scrollWidth, clientWidth } = scrollEl.value
  atStart.value = scrollLeft <= 1
  atEnd.value = scrollLeft + clientWidth >= scrollWidth - 1
}

watch(scrollEl, (el) => {
  if (!el) return
  el.addEventListener('scroll', updateScrollState, { passive: true })
  nextTick(updateScrollState)
}, { immediate: true })

onBeforeUnmount(() => {
  if (observer) observer.disconnect()
  if (scrollEl.value) scrollEl.value.removeEventListener('scroll', updateScrollState)
})
</script>

<template>
  <section class="massd">
    <div class="massd__header">
      <h2 class="massd__title">Mass Distribution</h2>
      <p class="massd__toggle">sort by
        <span v-for="(mode, i) in ['mass', 'count']" :key="mode"
          >{{ i > 0 ? ' ' : '' }}[<span
            class="massd__mode"
            :class="{ 'massd__mode--active': sortMode === mode }"
            @click="sortMode = mode"
          >{{ mode }}</span>]</span>
      </p>
    </div>

    <div ref="scrollEl" class="massd__scroll">
      <TransitionGroup name="bars">
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
      </TransitionGroup>
    </div>

    <div class="massd__nav">
      <button
        class="massd__nav-btn"
        :class="{ 'massd__nav-btn--disabled': atStart, 'massd__nav-btn--active': !atStart }"
        :disabled="atStart"
        @click="scrollEl.scrollTo({ left: 0, behavior: 'smooth' })"
      >&#8592;</button>
      <button
        class="massd__nav-btn"
        :class="{ 'massd__nav-btn--disabled': atEnd, 'massd__nav-btn--active': !atEnd }"
        :disabled="atEnd"
        @click="scrollEl.scrollTo({ left: scrollEl.scrollWidth, behavior: 'smooth' })"
      >&#8594;</button>
    </div>
  </section>
</template>

<style lang="postcss" scoped>
.massd {
  @apply py-8 md:py-12 px-4 md:px-8;
  border-top: 1px solid #1a1a1a;
}
.massd__header {
  @apply flex flex-col mb-6 gap-2;
}
.massd__title {
  @apply text-white;
  font-family: 'HND', sans-serif;
  font-size: 2em;
}
@media (min-width: 768px) {
  .massd__title {
    @apply text-6xl;
  }
}
.massd__toggle {
  @apply text-base md:text-3xl text-white;
  font-family: 'HND', sans-serif;
}
.massd__mode {
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}
.massd__mode:hover {
  background: #fff;
  color: #000;
}
.massd__mode--active {
  text-decoration: underline;
  text-underline-offset: 3px;
}
.massd__scroll {
  @apply flex gap-2 sm:gap-3 md:gap-4;
  @apply overflow-x-auto pb-4;
  height: 300px;
  cursor: grab;
  scrollbar-width: none;
}
.massd__scroll::-webkit-scrollbar {
  display: none;
}
.bars-move {
  transition: transform 1s ease;
}
.massd__bar-group {
  @apply flex flex-col items-center justify-end;
  @apply flex-shrink-0;
  height: 100%;
  min-width: 36px;
}
@media (min-width: 1024px) {
  .massd__bar-group {
    min-width: 44px;
  }
}
.massd__count {
  @apply text-2xs md:text-xs mb-2;
  color: #888;
}
.massd__bar {
  @apply w-6 sm:w-8 md:w-10 rounded-t;
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
.massd__nav {
  @apply flex justify-between mt-3;
}
.massd__nav-btn {
  background: none;
  border: none;
  padding: 0;
  font-size: 2rem;
  transition: color 0.2s;
}
.massd__nav-btn--active {
  color: rgba(255, 255, 255, 1);
  cursor: pointer;
}
.massd__nav-btn--active:hover {
  color: rgba(255, 255, 255, 0.7);
}
.massd__nav-btn--disabled {
  color: rgba(255, 255, 255, 0.15);
  cursor: default;
}
</style>
