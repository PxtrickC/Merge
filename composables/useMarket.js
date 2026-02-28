import { decodeValue } from "~/utils/contract.mjs"
import { SEAPORT_ADDRESS } from "~/utils/trading.mjs"

export function useMarket() {
  const listings = ref([])
  const loading = ref(false)
  const error = ref(null)
  const nextCursor = ref(null)
  const hasMore = ref(true)
  const { db } = useDB()

  // Build a Map of tokenId -> { tier, mass, merges } from db.json
  const tokenMap = computed(() => {
    if (!db.value?.tokens) return new Map()
    const map = new Map()
    const tokens = db.value.tokens
    for (let id = 1; id < tokens.length; id++) {
      const entry = tokens[id]
      if (!entry || entry[0] === 0) continue
      const { class: tier, mass } = decodeValue(entry[0])
      map.set(id, { tier, mass, merges: entry[1] || 0 })
    }
    return map
  })

  async function fetchListings(reset = false) {
    if (loading.value) return
    if (!reset && !hasMore.value) return

    loading.value = true
    error.value = null

    if (reset) {
      listings.value = []
      nextCursor.value = null
      hasMore.value = true
    }

    try {
      const query = nextCursor.value ? { next: nextCursor.value } : {}
      const data = await $fetch('/api/opensea/listings', { query })

      const newListings = (data.listings || [])
        .map(listing => {
          // Token ID from Seaport offer
          const offer = listing.protocol_data?.parameters?.offer?.[0]
          const tokenId = offer ? Number(offer.identifierOrCriteria) : 0
          if (!tokenId) return null

          // Price in wei → ETH
          const priceWei = listing.price?.current?.value
          const decimals = listing.price?.current?.decimals ?? 18
          const price = priceWei ? Number(priceWei) / Math.pow(10, decimals) : 0
          if (price <= 0) return null

          const dbToken = tokenMap.value.get(tokenId)
          if (!dbToken) return null // burned or not in db

          return {
            id: tokenId,
            tier: dbToken.tier,
            mass: dbToken.mass,
            merges: dbToken.merges,
            price,
            priceWei: priceWei,
            pricePerMass: price / dbToken.mass,
            source: 'OpenSea',
            orderHash: listing.order_hash,
            protocolAddress: SEAPORT_ADDRESS,
          }
        })
        .filter(Boolean)

      // Deduplicate: same token may have multiple listings, keep cheapest
      const existingIds = new Set(listings.value.map(l => l.id))
      for (const item of newListings) {
        if (existingIds.has(item.id)) {
          const idx = listings.value.findIndex(l => l.id === item.id)
          if (idx !== -1 && item.price < listings.value[idx].price) {
            listings.value[idx] = item
          }
        } else {
          listings.value.push(item)
          existingIds.add(item.id)
        }
      }
      nextCursor.value = data.next || null
      hasMore.value = !!data.next
    } catch (err) {
      error.value = err.message || 'Failed to load market data'
    } finally {
      loading.value = false
    }
  }

  return {
    listings,
    loading,
    error,
    hasMore,
    fetchListings,
  }
}
