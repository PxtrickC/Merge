<script setup>
import { ethers } from 'ethers'
import { PLATFORM_FEE_BPS } from '~/utils/trading.mjs'

const { tokenId, isOpen, listing: drawerListing, close } = useTokenDrawer()

const { alphaMass } = useDB()
const alpha_mass = computed(() => alphaMass.value || 0)

const { data: matterTokens } = useLazyFetch('/data/matter_tokens.json')
const matterForToken = computed(() => {
  if (!Array.isArray(matterTokens.value) || !tokenData.value) return []
  return matterTokens.value.filter(m => m.parent === tokenData.value.id)
})

const { address: walletAddress, isConnected, openModal } = useWallet()
const { buyToken, sellToken, selling, buying, error: tradeError } = useTrading()

const tokenData = ref(null)
const transfers = ref([])
const mergeTimeline = ref([])
const initialMass = ref(null)
const loading = ref(false)
const tokenListing = ref(null)
const showSellModal = ref(false)
const buySuccess = ref(false)

const isOwnToken = computed(() => {
  if (!tokenData.value?.owner || !walletAddress.value) return false
  return tokenData.value.owner.toLowerCase() === walletAddress.value.toLowerCase()
})

const isBurned = computed(() => !!tokenData.value?.merged_to)

const listingPrice = computed(() => {
  if (!tokenListing.value) return null
  return tokenListing.value.price
})

const listingPriceDisplay = computed(() => {
  if (!listingPrice.value) return ''
  return Number(listingPrice.value).toFixed(4)
})

const buyerFeeDisplay = computed(() => {
  if (!listingPrice.value) return ''
  return (Number(listingPrice.value) * PLATFORM_FEE_BPS / 10000).toFixed(4)
})

const panelRef = ref(null)

watch(tokenId, async (id) => {
  if (!id) return
  loading.value = true
  tokenData.value = null
  transfers.value = []
  mergeTimeline.value = []
  initialMass.value = null
  tokenListing.value = drawerListing.value || null
  showSellModal.value = false
  buySuccess.value = false

  nextTick(() => {
    if (panelRef.value) panelRef.value.scrollTop = 0
  })

  try {
    const { token } = await useToken(id)
    if (token.value) {
      tokenData.value = {
        ...token.value,
        merged_to: token.value.mergedTo ?? null,
        merged_on: token.value.mergedOn ?? null,
      }
    }

    const [transferResult, timelineResult] = await Promise.all([
      useTokenTransfers(id),
      useTokenMergeTimeline(id),
    ])
    transfers.value = transferResult.transfers.value
    mergeTimeline.value = timelineResult.timeline.value
    initialMass.value = timelineResult.initialMass.value

    // Only fetch listing from API if not already provided
    if (!tokenListing.value) fetchListing(id)
  } catch (err) {
    console.error('[TokenDrawer]', err)
  } finally {
    loading.value = false
  }
})

async function fetchListing(id) {
  try {
    const data = await $fetch('/api/opensea/nft-listing', { params: { tokenId: id } })
    const orders = data?.orders
    if (orders?.length) {
      const order = orders[0]
      const priceWei = order.current_price
      tokenListing.value = {
        orderHash: order.order_hash,
        protocolAddress: order.protocol_address,
        price: Number(ethers.formatEther(priceWei)),
      }
    }
  } catch {
    // Listing fetch is best-effort
  }
}

async function handleDrawerBuy() {
  if (!isConnected.value) { openModal(); return }
  if (!tokenListing.value) return
  try {
    await buyToken(tokenListing.value)
    buySuccess.value = true
    tokenListing.value = null
  } catch {
    // error handled in useTrading
  }
}

async function handleSellComplete() {
  showSellModal.value = false
}

let savedScrollY = 0
watch(isOpen, (open) => {
  if (!import.meta.client) return
  if (open) {
    savedScrollY = window.scrollY
    document.body.style.position = 'fixed'
    document.body.style.top = `-${savedScrollY}px`
    document.body.style.left = '0'
    document.body.style.right = '0'
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.position = ''
    document.body.style.top = ''
    document.body.style.left = ''
    document.body.style.right = ''
    document.body.style.overflow = ''
    window.scrollTo(0, savedScrollY)
  }
})

function onKeyDown(e) {
  if (e.key === 'Escape' && isOpen.value) close()
}

onMounted(() => document.addEventListener('keydown', onKeyDown))
onUnmounted(() => document.removeEventListener('keydown', onKeyDown))
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen" class="drawer__backdrop" @click="close" @touchmove.prevent />
  </Transition>
  <Transition name="slide">
    <div v-if="isOpen" ref="panelRef" class="drawer__panel">
      <button class="drawer__close" @click="close">
        <icon class="w-5" variant="return" />
      </button>

      <div v-if="loading && !tokenData" class="drawer__loading">
        <Loading :fullscreen="false" />
      </div>

      <!-- Sell Modal (replaces main content) -->
      <div v-if="tokenData && showSellModal" class="drawer__content">
        <SellModal
          :token-id="+tokenData.id"
          :tier="tokenData.tier"
          :mass="tokenData.mass"
          :alpha_mass="alpha_mass"
          @close="showSellModal = false"
          @listed="handleSellComplete"
        />
      </div>

      <!-- Token detail -->
      <div v-else-if="tokenData" class="drawer__content">
        <card-token v-bind="tokenData" :alpha_mass="alpha_mass" />

        <!-- Trading section -->
        <div v-if="!isBurned" class="drawer__trade">
          <!-- Buy: not own token + has listing -->
          <template v-if="!isOwnToken && tokenListing">
            <button
              class="drawer__trade-btn drawer__trade-btn--buy"
              :disabled="buying"
              @click="handleDrawerBuy"
            >
              {{ buying ? 'Buying...' : `Buy for ${listingPriceDisplay} ETH` }}
            </button>
            <span class="drawer__trade-fee">+{{ buyerFeeDisplay }} ETH platform fee (1%)</span>
          </template>

          <!-- Buy success -->
          <div v-if="buySuccess" class="drawer__trade-success">
            Purchase complete!
          </div>

          <!-- Sell: own token -->
          <template v-if="isOwnToken">
            <div v-if="tokenListing" class="drawer__listing-active">
              Listed at {{ listingPriceDisplay }} ETH
            </div>
            <button
              class="drawer__trade-btn drawer__trade-btn--sell"
              @click="showSellModal = true"
            >
              {{ tokenListing ? 'Update Listing' : 'Sell this token' }}
            </button>
          </template>

          <!-- Trade error -->
          <div v-if="tradeError" class="drawer__trade-error">
            {{ tradeError }}
          </div>
        </div>

        <card-activity
          :id="+tokenData.id"
          :loading="loading"
          :merged="tokenData.merged"
          :merged_to="tokenData.merged_to"
          :merged_on="tokenData.merged_on"
          :alpha_mass="alpha_mass"
          :transfers="transfers"
          :merge-timeline="mergeTimeline"
          :initial-mass="initialMass"
        />

        <div v-if="matterForToken.length" class="drawer__matter">
          <div class="drawer__matter-title">matter*</div>
          <div class="drawer__matter-grid">
            <div
              v-for="m in matterForToken"
              :key="m.id"
              class="drawer__matter-item"
            >
              <img :src="m.image_cdn || m.image" :alt="m.name" class="drawer__matter-img" width="512" height="512" />
              <span class="drawer__matter-name">{{ m.name }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style lang="postcss" scoped>
.drawer__backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 50;
}
.drawer__panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  max-width: 30rem;
  background: #0a0a0a;
  border-left: 1px solid #1a1a1a;
  z-index: 51;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  @apply p-4 lg:p-6;
}
.drawer__close {
  @apply mb-4 lg:mb-6 text-white;
}
.drawer__content {
  @apply flex flex-col gap-8 lg:gap-10;
}
.drawer__loading {
  @apply flex justify-center py-12;
}

/* trade section */
.drawer__trade {
  @apply flex flex-col gap-2;
}
.drawer__trade-btn {
  @apply w-full py-3 text-sm text-white text-center;
  font-family: 'HND', sans-serif;
  border: 1px solid #333;
  transition: background 0.2s, border-color 0.2s;
}
.drawer__trade-btn:hover:not(:disabled) {
  border-color: #555;
  background: #1a1a1a;
}
.drawer__trade-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.drawer__trade-btn--buy {
  background: #1a1a1a;
}
.drawer__trade-btn--sell {
  background: transparent;
}
.drawer__listing-active {
  @apply text-sm text-center py-2;
  color: #4ade80;
  font-family: 'HND', sans-serif;
}
.drawer__trade-fee {
  @apply text-xs text-center;
  color: #555;
}
.drawer__trade-error {
  @apply text-xs text-center;
  color: #f87171;
}
.drawer__trade-success {
  @apply text-xs text-center;
  color: #4ade80;
}

/* matter section */
.drawer__matter-title {
  @apply text-2xl lg:text-6xl text-white mb-4 lg:mb-6;
}
.drawer__matter {
  @apply flex flex-col;
}
.drawer__matter-grid {
  @apply grid grid-cols-2 gap-3;
}
.drawer__matter-item {
  @apply flex flex-col items-center gap-1.5;
}
.drawer__matter-img {
  @apply w-full h-auto block rounded;
  aspect-ratio: 1;
  object-fit: cover;
}
.drawer__matter-name {
  @apply text-xs text-white truncate w-full text-center;
}

/* transitions */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
.slide-enter-active, .slide-leave-active {
  transition: transform 0.3s ease;
}
.slide-enter-from, .slide-leave-to {
  transform: translateX(100%);
}

/* scrollbar */
::-webkit-scrollbar {
  @apply w-1;
}
::-webkit-scrollbar-track {
  background: #0a0a0a;
}
::-webkit-scrollbar-thumb {
  background: #333;
  border-radius: 4px;
}
</style>
