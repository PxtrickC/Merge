<script setup>
const props = defineProps({
  title: String,
  items: Array,
  alphaMass: Number,
  showMerges: Boolean,
})

const emit = defineEmits(['open'])

const scrollEl = useDragScroll()

function sphereSize(mass) {
  const ratio = Math.pow(mass / (props.alphaMass || 1), 1 / 3)
  return (20 + ratio * 80) + 'px'
}

const scrollHeight = computed(() => {
  const maxMass = props.items?.length ? Math.max(...props.items.map(i => i.mass)) : 1
  const maxSphere = parseFloat(sphereSize(maxMass))
  return (maxSphere + 140) + 'px'
})

function fmtPrice(v) {
  return parseFloat(v.toFixed(4)).toString()
}

function fillAlpha(tier, mass) {
  const am = props.alphaMass || 1
  if (mass >= am) return am
  if (tier >= 3) return am
  return mass + 0.01
}
</script>

<template>
  <section v-if="items?.length" class="mrow">
    <h3 class="mrow__title">{{ title }}</h3>
    <div ref="scrollEl" class="mrow__scroll" :style="{ height: scrollHeight }">
      <div
        v-for="(item, i) in items"
        :key="item.orderHash"
        class="mrow__item"
        @click="emit('open', item)"
      >
        <div class="mrow__rank">{{ i + 1 }}</div>
        <div
          class="sphere-wrap"
          :style="{ width: sphereSize(item.mass), height: sphereSize(item.mass) }"
        >
          <merge-svg :tier="item.tier" :mass="item.mass" :alpha_mass="fillAlpha(item.tier, item.mass)" />
        </div>
        <div class="mrow__info">
          <span class="mrow__mass">m({{ item.mass }})</span>
          <span v-if="showMerges" class="mrow__merges">{{ item.merges }} merges</span>
          <span class="mrow__id">#{{ item.id }}</span>
        </div>
        <span class="mrow__price">{{ fmtPrice(item.price) }} ETH</span>
        <span class="mrow__ppm">{{ fmtPrice(item.pricePerMass) }}/m</span>
      </div>
    </div>
  </section>
</template>

<style lang="postcss" scoped>
.mrow {
  @apply py-6 lg:py-8;
  border-top: 1px solid #1a1a1a;
}
.mrow__title {
  @apply text-white mb-3 lg:mb-4 px-4 lg:px-8;
  font-family: 'HND', sans-serif;
  font-size: 2em;
}
@media (min-width: 768px) {
  .mrow__title {
    @apply text-6xl;
  }
}
.mrow__scroll {
  @apply flex items-end gap-4 md:gap-6 lg:gap-8;
  @apply overflow-x-auto pb-4 px-4 lg:px-8;
  scrollbar-width: none;
}
.mrow__scroll::-webkit-scrollbar {
  display: none;
}
.mrow__item {
  @apply flex flex-col items-center;
  @apply flex-shrink-0;
  @apply cursor-pointer;
  transition: scale 0.2s ease;
}
.mrow__item:hover {
  scale: 1.08;
}
.mrow__rank {
  @apply text-lg lg:text-xl font-medium mb-2;
  color: #333;
}
.mrow__info {
  @apply mt-2 flex flex-col items-center;
}
.mrow__mass {
  @apply text-xs lg:text-sm text-white;
}
.mrow__merges {
  @apply text-2xs lg:text-xs;
  color: #888;
}
.mrow__id {
  @apply text-2xs lg:text-xs;
  color: #555;
}
.mrow__price {
  @apply text-xs lg:text-sm text-white font-medium mt-1;
}
.mrow__ppm {
  @apply text-2xs lg:text-xs;
  color: #888;
}
</style>
