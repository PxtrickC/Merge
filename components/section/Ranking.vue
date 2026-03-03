<script setup>
import { decodeValue } from "~/utils/contract.mjs"

const props = defineProps({
  title: String,
  items: Array,
  alphaMass: Number,
  searchable: Boolean,
  filterable: Boolean,
  tier: Number,
  compact: Boolean,
  highlightId: Number,
  sortDefault: { type: String, default: 'mass' },
  filterDefault: { type: String, default: 'alive' },
  scopeItems: Array,
  scopeLabel: String,
  subtitle: String,
})

const { db } = useDB()
const { open: openDrawer } = useTokenDrawer()
const { trackEvent } = useAnalytics()
const scrollEl = useDragScroll()
const sortMode = ref(props.sortDefault)
const filterMode = ref(props.filterDefault)
const scopeMode = ref('all')
const searchQuery = ref('')

const DISPLAY_LIMIT = 100
const MOVE_THRESHOLD = 50 // 超過此排名距離改用淡入淡出

const prevRanks = ref(new Map())
const sortEpoch = ref(0)

const showFilter = computed(() => props.searchable || props.filterable)

// Burned tokens decoded from db (filtered by tier if set)
const burnedTokens = computed(() => {
  if (!db.value?.tokens) return []
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

const effectiveItems = computed(() =>
  scopeMode.value === 'tier' && props.scopeItems?.length ? props.scopeItems : props.items
)

const sortedItems = computed(() => {
  if (!effectiveItems.value) return []

  // Filter by alive/dead
  let list
  if (filterMode.value === 'alive') {
    list = effectiveItems.value
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

  // When highlightId is set (drawer), always show a ±5 window around the token
  if (props.highlightId) {
    const idx = sorted.findIndex(x => x.id === props.highlightId)
    if (idx !== -1) {
      const CONTEXT = 5
      const start = Math.max(0, idx - CONTEXT)
      const end = Math.min(sorted.length, idx + CONTEXT + 1)
      return sorted.slice(start, end).map((item, wi) => ({ ...item, displayRank: start + wi + 1 }))
    }
  }
  return sorted.slice(0, DISPLAY_LIMIT)
})

// Current token's rank position and scope total
const sortedTotal = computed(() => {
  if (filterMode.value === 'dead') return burnedTokens.value.length
  if (filterMode.value === 'all') return (effectiveItems.value?.length ?? 0) + burnedTokens.value.length
  return effectiveItems.value?.length ?? 0
})

const highlightRank = computed(() => {
  if (!props.highlightId || !sortedItems.value.length) return null
  const token = sortedItems.value.find(x => x.id === props.highlightId)
  if (!token) return null
  const idx = sortedItems.value.indexOf(token)
  return token.displayRank ?? idx + 1
})

// Rank-up hint: compute based on current scope/filter
const rankUpHint = computed(() => {
  if (!props.highlightId || !props.compact) return null
  const items = effectiveItems.value
  if (!items?.length) return null

  const myToken = items.find(t => t.id === props.highlightId)
  if (!myToken) return null

  const isMass = sortMode.value === 'mass'
  const myVal = isMass ? myToken.mass : (myToken.merges ?? 0)
  const myId = myToken.id

  const sorted = [...items].sort(isMass
    ? (a, b) => b.mass - a.mass || b.id - a.id
    : (a, b) => (b.merges ?? 0) - (a.merges ?? 0) || b.id - a.id
  )
  const myIdx = sorted.findIndex(t => t.id === myId)
  if (myIdx <= 0) return null
  const currentRank = myIdx + 1

  const above = sorted[myIdx - 1]
  const aboveVal = isMass ? above.mass : (above.merges ?? 0)
  let needed
  if (aboveVal === myVal) {
    needed = 1
  } else {
    const diff = aboveVal - myVal
    needed = myId > above.id ? diff : diff + 1
  }

  const newVal = myVal + needed
  let aboveCount = 0
  for (const t of items) {
    if (t.id === myId) continue
    const tv = isMass ? t.mass : (t.merges ?? 0)
    if (tv > newVal || (tv === newVal && t.id > myId)) aboveCount++
  }
  const newRank = aboveCount + 1
  const gain = currentRank - newRank
  if (gain <= 0) return null

  if (isMass) {
    return `+${needed} mass to #${newRank} (↑${gain})`
  }
  return `${needed} more merge${needed > 1 ? 's' : ''} to #${newRank} (↑${gain})`
})

watch(sortedItems, (_new, old) => {
  if (!old) return
  const map = new Map()
  old.forEach((t, i) => map.set(t.id, i))
  prevRanks.value = map
})

watch(sortMode, (v) => { sortEpoch.value++; trackEvent('ranking_sort_changed', { sort_mode: v, section: props.title }) })
watch(filterMode, (v) => { trackEvent('ranking_filter_changed', { filter_mode: v, section: props.title }) })

let searchTimer = null
watch(searchQuery, (v) => {
  clearTimeout(searchTimer)
  if (v) searchTimer = setTimeout(() => trackEvent('ranking_searched', { query: v, section: props.title }), 800)
})

async function scrollToHighlight() {
  if (!props.highlightId || !scrollEl.value) return
  await nextTick()
  await new Promise(resolve => requestAnimationFrame(resolve))
  const el = scrollEl.value.querySelector(`[data-highlight-id="${props.highlightId}"]`)
  if (!el) return
  const containerRect = scrollEl.value.getBoundingClientRect()
  const elRect = el.getBoundingClientRect()
  // Move scrollLeft so the element center aligns with the container center
  const elCenterX = elRect.left + elRect.width / 2
  const containerCenterX = containerRect.left + containerRect.width / 2
  scrollEl.value.scrollLeft += elCenterX - containerCenterX
}

watch([() => props.highlightId, sortedItems], scrollToHighlight, { immediate: true })
onMounted(scrollToHighlight)

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
  // Use the tallest ball in the visible window, not the global alpha mass
  const maxMass = sortedItems.value.length
    ? sortedItems.value.reduce((m, t) => Math.max(m, t.mass ?? 0), 0)
    : (props.alphaMass || 1)
  const tallest = parseFloat(sphereSize(maxMass))
  return (tallest + 120) + 'px' // rank(~30px) + sphere + info(~50px) + padding
})

// Make circle fill the sphere-wrap; size difference is handled by container
function fillAlpha(mass) {
  const am = props.alphaMass || 1
  if (mass >= am) return am
  // Small offset so circle fills container without triggering alpha class
  return mass + 0.01
}
</script>

<template>
  <section class="ranking" :class="{ 'ranking--compact': compact }">
    <div class="ranking__header">
      <h2 v-if="title" class="ranking__title">{{ title }}<template v-if="highlightRank"> <span class="ranking__title-stat">#{{ highlightRank }}/{{ sortedTotal }}</span></template></h2>
      <p v-if="rankUpHint || subtitle" class="ranking__toggle">{{ rankUpHint || subtitle }}</p>
      <p v-if="showFilter && !compact" class="ranking__toggle">show
        <span v-for="(mode, i) in ['all', 'alive', 'dead']" :key="mode"
          >{{ i > 0 ? ' ' : '' }}[<span
            class="ranking__mode"
            :class="{ 'ranking__mode--active': filterMode === mode }"
            @click="filterMode = mode"
          >{{ mode }}</span>]</span>
      </p>
      <p v-if="!compact" class="ranking__toggle">sort by
        <span v-for="(mode, i) in ['id', 'mass', 'merges']" :key="mode"
          >{{ i > 0 ? ' ' : '' }}[<span
            class="ranking__mode"
            :class="{ 'ranking__mode--active': sortMode === mode }"
            @click="sortMode = mode"
          >{{ mode }}</span>]</span>
      </p>
      <p v-if="scopeItems" class="ranking__toggle">[<span
          class="ranking__mode"
          :class="{ 'ranking__mode--active': scopeMode === 'all' }"
          @click="scopeMode = 'all'"
        >All</span>] [<span
          class="ranking__mode"
          :class="{ 'ranking__mode--active': scopeMode === 'tier' }"
          @click="scopeMode = 'tier'"
        >{{ scopeLabel || 'tier' }}</span>]</p>
      <input
        v-if="searchable"
        v-model="searchQuery"
        type="number"
        placeholder="search by #id"
        class="ranking__search"
      />
    </div>


    <Transition name="fade" mode="out-in">
    <div :key="filterMode + '-' + scopeMode" ref="scrollEl" class="ranking__scroll" :style="{ height: scrollHeight }">
      <TransitionGroup name="rank">
      <a
        v-for="(token, i) in sortedItems"
        :key="itemKey(token, i)"
        :href="`/${token.id}`"
        :data-highlight-id="token.id"
        class="ranking__item"
        :class="{ 'ranking__item--highlight': token.id === highlightId }"
        @click.prevent="openDrawer(token.id)"
      >
        <div class="ranking__rank">{{ token.displayRank ?? i + 1 }}</div>
        <div
          class="sphere-wrap"
          :class="{ 'sphere-wrap--burned': token.burned }"
          :style="{ width: sphereSize(token.mass), height: sphereSize(token.mass) }"
        >
          <merge-svg :tier="token.tier" :mass="token.mass" :alpha_mass="fillAlpha(token.mass)" bordered />
        </div>
        <div class="ranking__info">
          <span class="ranking__value">m({{ token.mass }})</span>
          <span class="ranking__id">#{{ token.id }}</span>
          <span v-if="token.burned" class="ranking__burned">merged → #{{ token.mergedTo }}</span>
          <span v-else class="ranking__merges">{{ (token.merges ?? 0).toLocaleString() }} merges</span>
        </div>
      </a>
      </TransitionGroup>
    </div>
    </Transition>
  </section>
</template>

<style lang="postcss" scoped>
.ranking {
  @apply py-8 lg:py-12;
  border-top: 1px solid var(--d-border, #1a1a1a);
}
.ranking--compact {
  @apply py-0;
  border-top: none;
}
.ranking--compact .ranking__title {
  font-size: 1.25rem;
}
.ranking--compact .ranking__header {
  @apply mb-2 gap-1 px-0;
}
.ranking--compact .ranking__toggle {
  @apply text-sm lg:text-sm;
}
.ranking--compact .ranking__scroll {
  margin-left: -2rem;
  margin-right: -2rem;
  padding-left: 2rem;
  padding-right: 2rem;
}
.ranking__header {
  @apply flex flex-col mb-3 lg:mb-6 gap-1 lg:gap-2 px-4 lg:px-8;
}
.ranking__title {
  color: var(--d-text, #fff);
  font-family: 'HND', sans-serif;
  font-size: 2em;
}
@media (min-width: 768px) {
  .ranking__title {
    @apply text-6xl;
  }
}
.ranking__title-stat {
  font-family: 'HND', sans-serif;
  font-size: 1em;
  color: var(--d-text, #fff);
  margin-left: 0.4em;
}
.ranking__toggle {
  @apply text-base lg:text-3xl;
  color: var(--d-text, #fff);
  font-family: 'HND', sans-serif;
}
.ranking__mode {
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}
.ranking__mode:hover {
  background: var(--d-text, #fff);
  color: var(--d-bg, #000);
}
.ranking__mode--active {
  text-decoration: underline;
  text-underline-offset: 3px;
}
.ranking__search {
  @apply mt-3 px-4 py-2 rounded-lg text-base;
  color: var(--d-text, #fff);
  max-width: 24rem;
  background: var(--d-surface, #1a1a1a);
  border: 1px solid var(--d-border-3, #333);
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
  border-color: var(--d-text-3, #555);
}
.ranking__search::placeholder {
  color: var(--d-text-4, rgba(255, 255, 255, 0.3));
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
.rank-move {
  transition: none;
}
.ranking__scroll {
  @apply flex items-end gap-4 md:gap-6 lg:gap-8;
  @apply overflow-x-auto pb-4 px-4 lg:px-8;
  scrollbar-width: none;
}
.ranking__scroll::-webkit-scrollbar {
  display: none;
}
.ranking__item {
  @apply flex flex-col items-center;
  @apply flex-shrink-0;
  @apply cursor-pointer;
  transition: scale 0.2s ease;
}
.ranking__item:hover {
  scale: 1.08;
}
.ranking__item--highlight .ranking__rank {
  color: var(--d-text, #fff);
}
.ranking__item--highlight {
  position: relative;
}
.ranking__item--highlight::after {
  content: '';
  position: absolute;
  bottom: -12px;
  left: 50%;
  transform: translateX(-50%);
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--d-text, #fff);
}
.ranking__rank {
  @apply text-lg lg:text-xl font-medium mb-2;
  color: var(--d-text-4, #333);
}
.ranking__info {
  @apply mt-2 flex flex-col items-center;
}
.ranking__id {
  @apply text-2xs lg:text-xs;
  color: var(--d-text-3, #555);
}
.ranking__value {
  @apply text-xs lg:text-sm;
  color: var(--d-text, #fff);
}
.ranking__merges {
  @apply text-2xs lg:text-xs;
  color: var(--d-text-3, #555);
}
.ranking__burned {
  @apply text-2xs lg:text-xs;
  color: var(--d-text-3, #555);
}
.sphere-wrap--burned {
  opacity: 0.5;
}
</style>
