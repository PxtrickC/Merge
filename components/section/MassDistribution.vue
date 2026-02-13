<script setup>
const mass_repartition = await useAPI("/mass_repartition")

const scrollEl = useDragScroll()

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
  if (!mass_repartition.value) return []
  const filtered = [...mass_repartition.value].filter(d => d.count > 0)
  filtered.sort((a, b) => b.count - a.count)
  const max = Math.max(...filtered.map(d => d.count))
  return filtered.map(item => ({
    label: `m(${item.mass})`,
    count: item.count,
    height: Math.max(2, (item.count / max) * 240),
    prime: isPrime(item.mass),
  }))
})
</script>

<template>
  <section class="massd">
    <h2 class="massd__title">Mass Distribution</h2>

    <div ref="scrollEl" class="massd__scroll">
      <div
        v-for="item in sorted_data"
        :key="item.label"
        class="massd__bar-group"
      >
        <span class="massd__count">{{ item.count.toLocaleString() }}</span>
        <div
          class="massd__bar"
          :style="{ height: item.height + 'px' }"
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
.massd__title {
  @apply text-4xl md:text-6xl text-white mb-6;
}
.massd__scroll {
  @apply flex items-end gap-3 md:gap-4;
  @apply overflow-x-auto pb-4;
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
