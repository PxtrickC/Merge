<script setup>
useHead({ title: 'Merge - Market' })

const { listings, loading, error, hasMore, fetchListings } = useMarket()
const { alphaMass } = useDB()
const { open: openDrawer } = useTokenDrawer()
const { trackEvent } = useAnalytics()

function openFromMarket(item) {
  openDrawer(item.id, {
    orderHash: item.orderHash,
    protocolAddress: item.protocolAddress,
    price: item.price,
  })
}

const alpha_mass = computed(() => alphaMass.value || 1)

onMounted(() => fetchListings(true))

// --- Sorted / filtered rows ---
const byPrice = computed(() =>
  [...listings.value].sort((a, b) => a.price - b.price)
)
const byPPM = computed(() =>
  [...listings.value].sort((a, b) => a.pricePerMass - b.pricePerMass)
)
const tier2 = computed(() =>
  listings.value.filter(i => i.tier === 2).sort((a, b) => a.price - b.price)
)
const tier3 = computed(() =>
  listings.value.filter(i => i.tier === 3).sort((a, b) => a.price - b.price)
)
const tier4 = computed(() =>
  listings.value.filter(i => i.tier === 4).sort((a, b) => a.price - b.price)
)
const byMass = computed(() =>
  [...listings.value].sort((a, b) => b.mass - a.mass)
)
const byMerges = computed(() =>
  [...listings.value].sort((a, b) => b.merges - a.merges)
)

const rows = computed(() => [
  { title: 'Price (Low→High)', items: byPrice.value },
  { title: 'Price/Mass (Low→High)', items: byPPM.value },
  { title: 'Yellow Mass', items: tier2.value },
  { title: 'Blue Mass', items: tier3.value },
  { title: 'Red Mass', items: tier4.value },
  { title: 'Mass (High→Low)', items: byMass.value },
  { title: 'Merges (High→Low)', items: byMerges.value, showMerges: true },
].filter(r => r.items.length > 0))
</script>

<template>
  <div>
    <div v-if="error" class="market__error">{{ error }}</div>

    <div v-if="loading && !listings.length" class="market__loading">
      <Loading :fullscreen="false" />
    </div>

    <div v-else-if="!listings.length && !error" class="market__empty">
      No listings found.
    </div>

    <template v-else>
      <section-market-row
        v-for="row in rows"
        :key="row.title"
        :title="row.title"
        :items="row.items"
        :alpha-mass="alpha_mass"
        :show-merges="row.showMerges"
        @open="openFromMarket"
      />
    </template>

    <div v-if="loading && listings.length" class="market__loading">
      <Loading :fullscreen="false" />
    </div>

    <button v-if="hasMore && !loading" class="market__load-more" @click="trackEvent('market_load_more', { total_loaded: listings.length }); fetchListings()">
      Load more
    </button>
  </div>
</template>

<style lang="postcss" scoped>
.market__error {
  @apply text-sm mb-4 px-4 lg:px-8;
  font-family: 'HND', sans-serif;
  color: #f87171;
}
.market__empty {
  @apply text-sm py-12 text-center;
  font-family: 'HND', sans-serif;
  color: #555;
}
.market__loading {
  @apply flex items-center justify-center;
  min-height: calc(100dvh - var(--header-h, 3rem) - 4rem);
}
@media (min-width: 768px) {
  .market__loading {
    min-height: calc(100dvh - 4rem);
  }
}
.market__loading-text {
  @apply text-sm;
  font-family: 'HND', sans-serif;
  color: #555;
}
.market__load-more {
  @apply mx-auto my-6 px-6 py-2 text-sm text-white block;
  font-family: 'HND', sans-serif;
  background: #1a1a1a;
  border: 1px solid #333;
  @apply rounded;
  transition: background 0.2s;
}
.market__load-more:hover {
  background: #333;
}
</style>
