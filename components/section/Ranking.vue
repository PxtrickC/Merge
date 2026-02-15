<script setup>
import { decodeValue } from "~/utils/contract.mjs"

const props = defineProps({
  title: String,
  items: Array,
  alphaMass: Number,
  searchable: Boolean,
  filterable: Boolean,
  tier: Number,
})

const { db } = useDB()
const scrollEl = useDragScroll()
const sortMode = ref('id') // 'id' | 'mass' | 'merges'
const filterMode = ref('alive') // 'all' | 'alive' | 'dead'
const searchQuery = ref('')

const DISPLAY_LIMIT = 100
const MOVE_THRESHOLD = 10 // 超過此排名距離改用淡入淡出

const prevRanks = ref(new Map())
const sortEpoch = ref(0)

const showFilter = computed(() => props.searchable || props.filterable)

// Burned tokens decoded from db (filtered by tier if set)
const burnedTokens = computed(() => {
  if (!showFilter.value || !db.value?.tokens) return []
  const tokens = db.value.tokens
  const results = []
  for (let id = 1; id < tokens.length; id++) {
    const entry = tokens[id]
    if (!entry || entry[2] === 0) continue
    const { class: tier, mass } = entry[0] > 0 ? decodeValue(entry[0]) : { class: 0, mass: 0 }
    if (props.tier && tier !== props.tier) continue
    results.push({ id, tier, mass, merges: entry[1] || 0, burned: true, mergedTo: entry[2] })
  }
  return results
})

const sortedItems = computed(() => {
  if (!props.items) return []

  // Filter by alive/dead
  let list
  if (!showFilter.value || filterMode.value === 'alive') {
    list = props.items
  } else if (filterMode.value === 'dead') {
    list = burnedTokens.value
  } else {
    list = [...props.items, ...burnedTokens.value]
  }

  // Search filter
  if (props.searchable && searchQuery.value) {
    const q = searchQuery.value
    list = list.filter(t => String(t.id).includes(q))
  }

  const sorted = [...list]
  if (sortMode.value === 'mass') sorted.sort((a, b) => b.mass - a.mass || b.id - a.id)
  else if (sortMode.value === 'merges') sorted.sort((a, b) => (b.merges ?? 0) - (a.merges ?? 0) || b.id - a.id)
  else sorted.sort((a, b) => a.id - b.id)
  return sorted.slice(0, DISPLAY_LIMIT)
})

watch(sortedItems, (_new, old) => {
  if (!old) return
  const map = new Map()
  old.forEach((t, i) => map.set(t.id, i))
  prevRanks.value = map
})

watch(sortMode, () => { sortEpoch.value++ })

function itemKey(token, index) {
  const prev = prevRanks.value.get(token.id)
  if (prev !== undefined && Math.abs(index - prev) > MOVE_THRESHOLD) {
    return `${token.id}-${sortEpoch.value}`
  }
  return token.id
}

function sphereSize(mass) {
  const ratio = Math.pow(mass / (props.alphaMass || 1), 1 / 3)
  return (20 + ratio * 80) + 'px'
}

const scrollHeight = computed(() => {
  const alphaSphere = parseFloat(sphereSize(props.alphaMass || 1))
  return (alphaSphere + 120) + 'px' // rank(~30px) + sphere + info(~50px) + padding
})

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
      <p v-if="showFilter" class="ranking__toggle">show
        <span v-for="(mode, i) in ['all', 'alive', 'dead']" :key="mode"
          >{{ i > 0 ? ' ' : '' }}[<span
            class="ranking__mode"
            :class="{ 'ranking__mode--active': filterMode === mode }"
            @click="filterMode = mode"
          >{{ mode }}</span>]</span>
      </p>
      <p class="ranking__toggle">sort by
        <span v-for="(mode, i) in ['id', 'mass', 'merges']" :key="mode"
          >{{ i > 0 ? ' ' : '' }}[<span
            class="ranking__mode"
            :class="{ 'ranking__mode--active': sortMode === mode }"
            @click="sortMode = mode"
          >{{ mode }}</span>]</span>
      </p>
      <input
        v-if="searchable"
        v-model="searchQuery"
        type="number"
        placeholder="search by #id"
        class="ranking__search"
      />
    </div>


    <Transition name="fade" mode="out-in">
    <div :key="filterMode" ref="scrollEl" class="ranking__scroll" :style="{ height: scrollHeight }">
      <TransitionGroup name="rank">
      <NuxtLink
        v-for="(token, i) in sortedItems"
        :key="itemKey(token, i)"
        :to="`/${token.id}`"
        class="ranking__item"
      >
        <div class="ranking__rank">{{ i + 1 }}</div>
        <div
          class="sphere-wrap"
          :class="{ 'sphere-wrap--burned': token.burned }"
          :style="{ width: sphereSize(token.mass), height: sphereSize(token.mass) }"
        >
          <merge-svg :tier="token.tier" :mass="token.mass" :alpha_mass="fillAlpha(token.tier, token.mass)" />
        </div>
        <div class="ranking__info">
          <span class="ranking__value">m({{ token.mass }})</span>
          <span class="ranking__id">#{{ token.id }}</span>
          <span v-if="token.burned" class="ranking__burned">merged → #{{ token.mergedTo }}</span>
          <span v-else class="ranking__merges">{{ (token.merges ?? 0).toLocaleString() }} merges</span>
        </div>
      </NuxtLink>
      </TransitionGroup>
    </div>
    </Transition>
  </section>
</template>

<style lang="postcss" scoped>
.ranking {
  @apply py-8 md:py-12;
  border-top: 1px solid #1a1a1a;
}
.ranking__header {
  @apply flex flex-col mb-3 md:mb-6 gap-1 md:gap-2 px-4 md:px-8;
}
.ranking__title {
  @apply text-white;
  font-family: 'HND', sans-serif;
  font-size: 2em;
}
@media (min-width: 768px) {
  .ranking__title {
    @apply text-6xl;
  }
}
.ranking__toggle {
  @apply text-base md:text-3xl text-white;
  font-family: 'HND', sans-serif;
}
.ranking__mode {
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}
.ranking__mode:hover {
  background: #fff;
  color: #000;
}
.ranking__mode--active {
  text-decoration: underline;
  text-underline-offset: 3px;
}
.ranking__search {
  @apply mt-3 px-4 py-2 rounded-lg text-sm text-white;
  max-width: 24rem;
  background: #1a1a1a;
  border: 1px solid #333;
  outline: none;
  transition: border-color 0.2s;
  -moz-appearance: textfield;
}
.ranking__search::-webkit-inner-spin-button,
.ranking__search::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.ranking__search:focus {
  border-color: #555;
}
.ranking__search::placeholder {
  color: rgba(255, 255, 255, 0.3);
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.rank-enter-active {
  transition: opacity 0.4s ease 0.2s;
}
.rank-leave-active {
  transition: opacity 0.3s ease;
  position: absolute;
  pointer-events: none;
}
.rank-enter-from,
.rank-leave-to {
  opacity: 0;
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
  transition: scale 0.2s ease, transform 2s cubic-bezier(0.16, 1, 0.3, 1);
}
.ranking__item:hover {
  scale: 1.08;
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
.ranking__merges {
  @apply text-2xs md:text-xs;
  color: #555;
}
.ranking__burned {
  @apply text-2xs md:text-xs;
  color: #555;
}
.sphere-wrap--burned {
  opacity: 0.5;
}
</style>
