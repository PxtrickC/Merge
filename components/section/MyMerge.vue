<script setup>
import { decodeValue } from '~/utils/contract.mjs'

const { isConnected, myTokenId } = useWallet()
const { db, aliveTokens, alphaMass } = useDB()
const { open: openDrawer } = useTokenDrawer()

const alpha_mass = computed(() => alphaMass.value || 1)

const myToken = computed(() => {
  if (!myTokenId.value || !db.value?.tokens) return null
  const entry = db.value.tokens[myTokenId.value]
  if (!entry || entry[0] === 0) return null
  const { class: tier, mass } = decodeValue(entry[0])
  return { id: myTokenId.value, tier, mass, merges: entry[1] || 0 }
})

const ranks = computed(() => {
  if (!myToken.value || !aliveTokens.value.length) return null
  const t = myToken.value
  const all = aliveTokens.value

  const massSorted = [...all].sort((a, b) => b.mass - a.mass)
  const massRank = massSorted.findIndex(x => x.id === t.id) + 1

  const mergesSorted = [...all].sort((a, b) => (b.merges ?? 0) - (a.merges ?? 0))
  const mergesRank = mergesSorted.findIndex(x => x.id === t.id) + 1

  return {
    massRank, massTotal: all.length,
    mergesRank, mergesTotal: all.length,
  }
})

const TIER_LABELS = { 1: 'White', 2: 'Yellow', 3: 'Blue', 4: 'Red' }

const rightRef = ref(null)
const infoHeight = ref(0)
let _ro = null

watch(rightRef, (el) => {
  _ro?.disconnect()
  if (!el) return
  _ro = new ResizeObserver(() => { infoHeight.value = el.offsetHeight })
  _ro.observe(el)
  nextTick(() => { infoHeight.value = el.offsetHeight })
}, { immediate: true })

const windowWidth = ref(process.client ? window.innerWidth : 1200)
function _onResize() { windowWidth.value = window.innerWidth }
onMounted(() => window.addEventListener('resize', _onResize))
onUnmounted(() => { window.removeEventListener('resize', _onResize); _ro?.disconnect() })

const sphereStyle = computed(() => {
  const maxSize = windowWidth.value < 768 ? 150 : 280
  const size = Math.min(infoHeight.value || 120, maxSize)
  return { width: size + 'px', height: size + 'px' }
})
</script>

<template>
  <ClientOnly>
    <section v-if="isConnected && myToken" class="mymerge">
      <h2 class="mymerge__title">My Merge</h2>

      <div class="mymerge__layout">
        <div class="mymerge__sphere-col" @click="openDrawer(myToken.id)">
          <div class="mymerge__sphere" :style="sphereStyle">
            <merge-svg :tier="myToken.tier" :mass="myToken.mass" :alpha_mass="alpha_mass" />
          </div>
        </div>

        <div ref="rightRef" class="mymerge__right">
          <div class="mymerge__info">
            <span class="mymerge__mass">m({{ myToken.mass.toLocaleString() }})</span>
            <span class="mymerge__id">#{{ myToken.id }}</span>

            <div class="mymerge__badges">
              <span class="mymerge__badge mymerge__badge--tier" :data-tier="myToken.tier">{{ TIER_LABELS[myToken.tier] || 'Tier ' + myToken.tier }}</span>
              <span class="mymerge__badge">{{ (myToken.merges || 0).toLocaleString() }} merges</span>
            </div>

            <div v-if="ranks" class="mymerge__ranks">
              <div class="mymerge__rank">
                <span class="mymerge__rank-label">Mass Rank</span>
                <span class="mymerge__rank-value">#{{ ranks.massRank }} <span class="mymerge__rank-total">/ {{ ranks.massTotal.toLocaleString() }}</span></span>
              </div>
              <div class="mymerge__rank">
                <span class="mymerge__rank-label">Merges Rank</span>
                <span class="mymerge__rank-value">#{{ ranks.mergesRank }} <span class="mymerge__rank-total">/ {{ ranks.mergesTotal.toLocaleString() }}</span></span>
              </div>
            </div>
          </div>

          <button class="mymerge__cta" @click="openDrawer(myToken.id)">
            View Details →
          </button>
        </div>
      </div>
    </section>
  </ClientOnly>
</template>

<style lang="postcss" scoped>
.mymerge {
  @apply py-8 lg:py-12 px-4 lg:px-8;
  border-top: 1px solid #1a1a1a;
}
.mymerge__title {
  @apply text-white mb-6;
  font-family: 'HND', sans-serif;
  font-size: 2em;
}
@media (min-width: 768px) {
  .mymerge__title {
    @apply text-6xl;
  }
}
.mymerge__layout {
  display: flex;
  flex-direction: row;
  gap: 1.5rem;
  align-items: flex-start;
}
.mymerge__sphere-col {
  flex-shrink: 0;
  cursor: pointer;
  transition: opacity 0.2s;
}
.mymerge__sphere-col:hover {
  opacity: 0.7;
}
.mymerge__sphere {
  overflow: hidden;
  border: 1px solid #333;
  display: block;
}
.mymerge__right {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
@media (max-width: 767px) {
  .mymerge__sphere-col {
    flex-shrink: 0;
  }
  .mymerge__right {
    flex: 1;
    min-width: 0;
  }
}
.mymerge__info {
  @apply flex flex-col gap-1;
}
.mymerge__mass {
  @apply text-xl lg:text-3xl text-white;
  font-family: 'HND', sans-serif;
}
.mymerge__id {
  @apply text-sm lg:text-base;
  color: #555;
}
.mymerge__badges {
  @apply flex flex-wrap gap-1.5 mt-1;
}
.mymerge__badge {
  @apply text-2xs lg:text-xs px-2 py-0.5 rounded;
  background: #1a1a1a;
  color: #aaa;
  border: 1px solid #333;
}
.mymerge__badge--tier[data-tier="4"] {
  background: #f33;
  color: #fff;
  border-color: #f33;
}
.mymerge__badge--tier[data-tier="3"] {
  background: #33f;
  color: #fff;
  border-color: #33f;
}
.mymerge__badge--tier[data-tier="2"] {
  background: #000;
  color: #fc3;
  border-color: #fc3;
}
.mymerge__badge--tier[data-tier="1"] {
  background: #000;
  color: #fff;
  border-color: #555;
}
.mymerge__ranks {
  @apply flex flex-wrap gap-3 lg:gap-4 mt-3;
}
.mymerge__rank {
  @apply flex flex-col;
}
.mymerge__rank-label {
  @apply text-2xs lg:text-xs;
  color: #555;
}
.mymerge__rank-value {
  @apply text-sm lg:text-base text-white;
  font-family: 'HND', sans-serif;
}
.mymerge__rank-total {
  @apply text-2xs lg:text-xs;
  color: #555;
}
.mymerge__cta {
  @apply self-start px-4 py-2 text-sm text-white;
  font-family: 'HND', sans-serif;
  border: 1px solid #333;
  background: transparent;
  transition: background 0.2s, border-color 0.2s;
  cursor: pointer;
}
.mymerge__cta:hover {
  background: #1a1a1a;
  border-color: #555;
  opacity: 1;
}
</style>
