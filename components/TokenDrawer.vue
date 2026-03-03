<script setup>
import { ethers } from 'ethers'
import { PLATFORM_FEE_BPS } from '~/utils/trading.mjs'
import { MERGE_CONTRACT_ADDRESS } from '~/utils/contract.mjs'

const { tokenId, isOpen, listing: drawerListing, close } = useTokenDrawer()

const { alphaMass, aliveTokens, db, mergedIntoIndex } = useDB()
const alpha_mass = computed(() => alphaMass.value || 0)
const _etherscanApiKey = useRuntimeConfig().public.ETHERSCAN_API_KEY

const { data: matterTokens } = useLazyFetch('/data/matter_tokens.json')
const matterForToken = computed(() => {
  if (!Array.isArray(matterTokens.value) || !tokenData.value) return []
  return matterTokens.value.filter(m => m.parent === tokenData.value.id)
})

const { address: walletAddress, isConnected, openModal } = useWallet()
const { buyToken, sellToken, transferToken, selling, buying, transferring, error: tradeError } = useTrading()

const tokenData = ref(null)
const transfers = ref([])
const mergeTimeline = ref([])
const initialMass = ref(null)
const loading = ref(false)
const tokenListing = ref(null)
const showSellModal = ref(false)
const buySuccess = ref(false)
const transferSuccess = ref(false)

// Offers
const tokenOffer = ref(null)   // { price, currency, expiry }
const collectionOffer = ref(null)

// Send panel
const showSendPanel = ref(false)
const sendAddress = ref('')
const sendError = ref('')
const sendSuccess = ref(false)

// ETH/USD price
const ethUsd = ref(null)

const drawerTierItems = computed(() => {
  if (!tokenData.value || !aliveTokens.value?.length) return []
  return aliveTokens.value.filter(x => x.tier === tokenData.value.tier)
})

const isOwnToken = computed(() => {
  if (!tokenData.value?.owner || !walletAddress.value) return false
  return tokenData.value.owner.toLowerCase() === walletAddress.value.toLowerCase()
})

const isBurned = computed(() => !!tokenData.value?.merged_to)

// ── ETH number formatting ─────────────────────────────────────────────────────
// 最多4位小數，自動去掉尾隨零；15.0000 → "15"，1.5900 → "1.59"，0.0159 → "0.0159"
function formatEth(val) {
  if (!val && val !== 0) return ''
  return parseFloat(Number(val).toFixed(4)).toString()
}

// ── Listing ──────────────────────────────────────────────────────────────────
const listingPrice = computed(() => tokenListing.value?.price ?? null)
const listingPriceDisplay = computed(() =>
  listingPrice.value ? formatEth(listingPrice.value) : ''
)
const buyerFeeDisplay = computed(() =>
  listingPrice.value
    ? formatEth(Number(listingPrice.value) * PLATFORM_FEE_BPS / 10000)
    : ''
)
const listingExpiry = computed(() => formatExpiry(tokenListing.value?.expirationTime))

// ── Offers ────────────────────────────────────────────────────────────────────
const bestOffer = computed(() => tokenOffer.value || collectionOffer.value || null)
const displayOfferPrice = computed(() => {
  if (!bestOffer.value) return ''
  return formatEth(bestOffer.value.price)
})
const displayOfferCurrency = computed(() => bestOffer.value?.currency || 'WETH')
const displayOfferUsd = computed(() => formatUsd(bestOffer.value?.price, ethUsd.value))
const offerExpiry = computed(() => formatExpiry(bestOffer.value?.expirationTime))

// ── USD Formatting ────────────────────────────────────────────────────────────
const listingUsdDisplay = computed(() => formatUsd(listingPrice.value, ethUsd.value))

function formatUsd(ethAmt, rate) {
  if (!ethAmt || !rate) return null
  const val = ethAmt * rate
  if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`
  return `$${val.toFixed(2)}`
}

// ── Expiry Formatting ─────────────────────────────────────────────────────────
function formatExpiry(unixTs) {
  if (!unixTs) return null
  const diff = Math.max(0, Number(unixTs) - Math.floor(Date.now() / 1000))
  if (diff <= 0) return 'EXPIRED'
  const days = Math.floor(diff / 86400)
  if (days >= 7) return `${Math.floor(days / 7)}W`
  if (days >= 1) return `${days}D`
  const hrs = Math.floor(diff / 3600)
  if (hrs >= 1) return `${hrs}H`
  return `${Math.ceil(diff / 60)}M`
}

// ── Collection Floor ──────────────────────────────────────────────────────────
const collectionFloor = ref(null)

// ── Rankings (local, from aliveTokens) ───────────────────────────────────────
const tokenMassRank = computed(() => {
  if (!tokenData.value || !aliveTokens.value?.length) return null
  const sorted = [...aliveTokens.value].sort((a, b) => b.mass - a.mass || b.id - a.id)
  const idx = sorted.findIndex(t => t.id === tokenData.value.id)
  return idx >= 0 ? idx + 1 : null
})
const tokenMergesRank = computed(() => {
  if (!tokenData.value || !aliveTokens.value?.length) return null
  const sorted = [...aliveTokens.value].sort((a, b) => (b.merges ?? 0) - (a.merges ?? 0) || b.id - a.id)
  const idx = sorted.findIndex(t => t.id === tokenData.value.id)
  return idx >= 0 ? idx + 1 : null
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
  tokenOffer.value = null
  collectionOffer.value = null
  showSellModal.value = false
  buySuccess.value = false
  showSendPanel.value = false
  sendAddress.value = ''
  sendError.value = ''
  sendSuccess.value = false
  transferSuccess.value = false

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
      useTokenMergeTimeline(id, { dbRef: db, mergedIntoIndexRef: mergedIntoIndex, etherscanApiKey: _etherscanApiKey }),
    ])
    transfers.value = transferResult.transfers.value
    mergeTimeline.value = timelineResult.timeline.value
    initialMass.value = timelineResult.initialMass.value

    // Fetch market data in parallel
    Promise.all([
      tokenListing.value ? null : fetchListing(id),
      fetchOffers(id),
      fetchCollectionData(),
      fetchEthPrice(),
    ])
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
        expirationTime: order.expiration_time,
      }
    }
  } catch {
    // best-effort
  }
}

async function fetchOffers(id) {
  try {
    const [tokenData, collData] = await Promise.all([
      $fetch('/api/opensea/nft-offers', { params: { tokenId: id } }).catch(() => null),
      $fetch('/api/opensea/collection-offers').catch(() => null),
    ])

    const tOffer = tokenData?.orders?.[0]
    if (tOffer) {
      const priceWei = tOffer.current_price
      tokenOffer.value = {
        price: Number(ethers.formatEther(priceWei)),
        currency: tOffer.taker_asset_bundle?.assets?.[0]?.asset_contract?.symbol || 'WETH',
        expirationTime: tOffer.expiration_time,
        orderHash: tOffer.order_hash,
        protocolAddress: tOffer.protocol_address,
      }
    }

    const cOffer = collData?.offers?.[0]
    if (!tOffer && cOffer) {
      const priceWei = cOffer.price?.value
      const decimals = cOffer.price?.decimals ?? 18
      if (priceWei) {
        collectionOffer.value = {
          price: Number(priceWei) / Math.pow(10, decimals),
          currency: 'WETH',
          expirationTime: cOffer.expiration_time,
        }
      }
    }
  } catch {
    // best-effort
  }
}

async function fetchCollectionData() {
  try {
    const data = await $fetch('/api/opensea/listings', { params: { limit: 1 } })
    const listing = data?.listings?.[0]
    if (listing) {
      const priceWei = listing.price?.current?.value
      const decimals = listing.price?.current?.decimals ?? 18
      if (priceWei) collectionFloor.value = Number(priceWei) / Math.pow(10, decimals)
    }
  } catch {
    // best-effort
  }
}

async function fetchEthPrice() {
  try {
    const data = await $fetch('/api/ethprice')
    if (data?.usd) ethUsd.value = data.usd
  } catch {
    // best-effort
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

function handleMakeOffer() {
  const id = tokenData.value?.id
  window.open(`https://opensea.io/assets/ethereum/${MERGE_CONTRACT_ADDRESS}/${id}`, '_blank')
}

function handleAcceptOffer() {
  const id = tokenData.value?.id
  window.open(`https://opensea.io/assets/ethereum/${MERGE_CONTRACT_ADDRESS}/${id}`, '_blank')
}

async function handleSend() {
  if (!isConnected.value) { openModal(); return }
  sendError.value = ''

  const addr = sendAddress.value.trim()
  if (!addr) { sendError.value = 'Please enter an address'; return }

  // Basic validation (ETH address or ENS)
  const isEns = addr.endsWith('.eth') || addr.endsWith('.xyz') || addr.endsWith('.id')
  const isAddr = /^0x[0-9a-fA-F]{40}$/.test(addr)
  if (!isEns && !isAddr) { sendError.value = 'Invalid ETH address or ENS name'; return }

  try {
    await transferToken(+tokenData.value.id, addr)
    sendSuccess.value = true
    showSendPanel.value = false
  } catch {
    sendError.value = tradeError.value || 'Transfer failed'
  }
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
onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
  // Clean up body styles if drawer was open during unmount (e.g. route change)
  if (isOpen.value) {
    document.body.style.position = ''
    document.body.style.top = ''
    document.body.style.left = ''
    document.body.style.right = ''
    document.body.style.overflow = ''
    window.scrollTo(0, savedScrollY)
  }
})
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen" class="drawer__backdrop" @click="close" @touchmove.prevent />
  </Transition>
  <Transition name="slide">
    <div v-if="isOpen" ref="panelRef" class="drawer__panel">
      <button class="drawer__close" @click="close">
        <icon class="w-5 h-5" variant="return" />
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

        <!-- Trading Panel -->
        <div v-if="!isBurned" class="trade-panel">

          <!-- Stats Row -->
          <div class="trade-panel__stats">
            <div class="trade-panel__stat">
              <div class="trade-panel__stat-label">TOP OFFER</div>
              <div class="trade-panel__stat-value">
                <template v-if="bestOffer">{{ displayOfferPrice }} <span class="trade-panel__stat-unit">{{ displayOfferCurrency }}</span></template>
                <span v-else class="trade-panel__stat-empty">--</span>
              </div>
            </div>
            <div class="trade-panel__stat">
              <div class="trade-panel__stat-label">COLL. FLOOR</div>
              <div class="trade-panel__stat-value">
                <template v-if="collectionFloor">{{ collectionFloor.toFixed(3) }} <span class="trade-panel__stat-unit">ETH</span></template>
                <span v-else class="trade-panel__stat-empty">--</span>
              </div>
            </div>
            <div class="trade-panel__stat">
              <div class="trade-panel__stat-label">MASS RANK</div>
              <div class="trade-panel__stat-value">
                <template v-if="tokenMassRank">#{{ tokenMassRank }}</template>
                <span v-else class="trade-panel__stat-empty">--</span>
              </div>
            </div>
            <div class="trade-panel__stat trade-panel__stat--last">
              <div class="trade-panel__stat-label">MERGES RANK</div>
              <div class="trade-panel__stat-value">
                <template v-if="tokenMergesRank">#{{ tokenMergesRank }}</template>
                <span v-else class="trade-panel__stat-empty">--</span>
              </div>
            </div>
          </div>

          <!-- Divider -->
          <div class="trade-panel__divider" />

          <!-- Main Section -->
          <div class="trade-panel__main">

            <!-- ── Buyer: listed ─────────────────────────────────── -->
            <template v-if="!isOwnToken && tokenListing">
              <div class="trade-panel__price-label">BUY FOR</div>
              <div class="trade-panel__price-row">
                <span class="trade-panel__price">{{ listingPriceDisplay }}</span>
                <span class="trade-panel__price-currency">ETH</span>
                <span v-if="listingUsdDisplay" class="trade-panel__price-usd">({{ listingUsdDisplay }})</span>
                <span v-if="listingExpiry" class="trade-panel__badge">ENDING IN {{ listingExpiry }}</span>
              </div>
              <div class="trade-panel__buttons">
                <button
                  class="trade-panel__btn trade-panel__btn--primary"
                  :disabled="buying"
                  @click="handleDrawerBuy"
                >
                  {{ buying ? 'Buying...' : 'Buy now' }}
                </button>
                <button class="trade-panel__btn trade-panel__btn--secondary" @click="handleMakeOffer">
                  Make offer
                </button>
              </div>
            </template>

            <!-- ── Buyer: not listed ─────────────────────────────── -->
            <template v-else-if="!isOwnToken && !tokenListing">
              <div class="trade-panel__buttons">
                <button class="trade-panel__btn trade-panel__btn--secondary trade-panel__btn--full" @click="handleMakeOffer">
                  Make offer
                </button>
              </div>
            </template>

            <!-- ── Owner: listed ─────────────────────────────────── -->
            <template v-else-if="isOwnToken && tokenListing">
              <div class="trade-panel__price-label">LISTED</div>
              <div class="trade-panel__price-row">
                <span class="trade-panel__price">{{ listingPriceDisplay }}</span>
                <span class="trade-panel__price-currency">ETH</span>
                <span v-if="listingUsdDisplay" class="trade-panel__price-usd">({{ listingUsdDisplay }})</span>
                <span v-if="listingExpiry" class="trade-panel__badge">ENDING IN {{ listingExpiry }}</span>
              </div>
              <div class="trade-panel__buttons">
                <button class="trade-panel__btn trade-panel__btn--primary" @click="showSellModal = true">
                  Edit listing
                </button>
                <button class="trade-panel__btn trade-panel__btn--secondary">
                  Cancel listing
                </button>
                <button class="trade-panel__btn trade-panel__btn--secondary trade-panel__btn--icon" @click="showSendPanel = !showSendPanel">
                  Send
                </button>
              </div>
            </template>

            <!-- ── Owner: not listed ─────────────────────────────── -->
            <template v-else-if="isOwnToken && !tokenListing">
              <div class="trade-panel__buttons">
                <button class="trade-panel__btn trade-panel__btn--primary" @click="showSellModal = true">
                  List for sale
                </button>
                <button class="trade-panel__btn trade-panel__btn--secondary trade-panel__btn--icon" @click="showSendPanel = !showSendPanel">
                  Send
                </button>
              </div>
            </template>

            <!-- Status Messages -->
            <div v-if="tradeError" class="trade-panel__msg trade-panel__msg--error">
              {{ tradeError }}
            </div>
            <div v-if="buySuccess" class="trade-panel__msg trade-panel__msg--success">
              Purchase complete! 🎉
            </div>
          </div>

          <!-- Send Panel (owner only) -->
          <Transition name="send-slide">
            <div v-if="isOwnToken && showSendPanel" class="trade-panel__send">
              <div class="trade-panel__divider" />
              <div class="trade-panel__price-label">SEND TO</div>
              <div class="trade-panel__send-row">
                <input
                  v-model="sendAddress"
                  class="trade-panel__send-input"
                  placeholder="0x... or ENS name"
                  :disabled="transferring"
                />
              </div>
              <div v-if="sendError" class="trade-panel__msg trade-panel__msg--error">{{ sendError }}</div>
              <div class="trade-panel__buttons">
                <button
                  class="trade-panel__btn trade-panel__btn--primary"
                  :disabled="transferring || !sendAddress.trim()"
                  @click="handleSend"
                >
                  {{ transferring ? 'Sending...' : 'Send NFT' }}
                </button>
                <button class="trade-panel__btn trade-panel__btn--secondary" @click="showSendPanel = false; sendAddress = ''; sendError = ''">
                  Cancel
                </button>
              </div>
            </div>
          </Transition>

          <!-- Top Offer acceptance row (owner) -->
          <template v-if="isOwnToken && bestOffer">
            <div class="trade-panel__divider" />
            <div class="trade-panel__offer-row">
              <div class="trade-panel__offer-info">
                <div class="trade-panel__price-label">TOP OFFER</div>
                <div class="trade-panel__offer-price">
                  {{ displayOfferPrice }} <span class="trade-panel__stat-unit">{{ displayOfferCurrency }}</span>
                  <span v-if="displayOfferUsd" class="trade-panel__price-usd">({{ displayOfferUsd }})</span>
                  <span v-if="offerExpiry" class="trade-panel__badge">ENDING IN {{ offerExpiry }}</span>
                </div>
              </div>
              <button class="trade-panel__btn trade-panel__btn--secondary" @click="handleAcceptOffer">
                Accept offer
              </button>
            </div>
          </template>

        </div>

        <!-- Rankings -->
        <template v-if="!isBurned && aliveTokens?.length">
          <h2 class="drawer-section-title">Leaderboard</h2>
          <div class="drawer__rankings">
          <section-ranking
            title="Mass Rank"
            :items="aliveTokens"
            :scope-items="drawerTierItems"
            :scope-label="`Tier${tokenData.tier}`"
            :alpha-mass="alpha_mass"
            :highlight-id="tokenData.id"
            sort-default="mass"
            compact
          />
          <section-ranking
            title="Merges Rank"
            :items="aliveTokens"
            :scope-items="drawerTierItems"
            :scope-label="`Tier${tokenData.tier}`"
            :alpha-mass="alpha_mass"
            :highlight-id="tokenData.id"
            sort-default="merges"
            compact
          />
          </div>
        </template>

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
              <img :src="m.image_cdn" :alt="m.name" class="drawer__matter-img" width="512" height="512" />
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
  padding: calc(1rem + env(safe-area-inset-top)) 1rem 1rem;
}
@media (min-width: 1024px) {
  .drawer__panel {
    padding: 1.5rem;
  }
}
.drawer__close {
  @apply mb-4 lg:mb-6 text-white text-opacity-100;
  @apply w-10 h-10 p-0 flex items-center justify-center;
  line-height: 0;
}

.drawer__content {
  @apply flex flex-col gap-8 lg:gap-10;
}
.drawer__loading {
  @apply flex justify-center py-12;
}

/* ── Trade Panel ─────────────────────────────────────────────────────────── */
.trade-panel {
  border: 1px solid #1f1f1f;
  border-radius: 8px;
  background: #0d0d0d;
  overflow: hidden;
}

/* Stats row */
.trade-panel__stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
}
.trade-panel__stat {
  padding: 0.75rem 0.875rem;
  border-right: 1px solid #1a1a1a;
}
.trade-panel__stat--last {
  border-right: none;
}
.trade-panel__stat-label {
  font-size: 9px;
  letter-spacing: 0.06em;
  color: #555;
  font-family: 'HND', sans-serif;
  margin-bottom: 0.25rem;
  white-space: nowrap;
}
.trade-panel__stat-value {
  font-size: 13px;
  color: #fff;
  font-family: 'HND', sans-serif;
  white-space: nowrap;
}
.trade-panel__stat-unit {
  font-size: 10px;
  color: #888;
}
.trade-panel__stat-empty {
  color: #333;
}

/* Divider */
.trade-panel__divider {
  border-top: 1px solid #1a1a1a;
}

/* Main body */
.trade-panel__main {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
@media (min-width: 1024px) {
  .trade-panel__main {
    padding: 1.125rem 1.25rem;
  }
}

/* Price label */
.trade-panel__price-label {
  font-size: 10px;
  letter-spacing: 0.07em;
  color: #555;
  font-family: 'HND', sans-serif;
  margin-bottom: -0.5rem;
}

/* Price row */
.trade-panel__price-row {
  display: flex;
  align-items: baseline;
  gap: 0.375rem;
  flex-wrap: wrap;
}
.trade-panel__price {
  font-size: 2rem;
  font-family: 'HND', sans-serif;
  color: #fff;
  line-height: 1;
}
@media (min-width: 1024px) {
  .trade-panel__price {
    font-size: 2.25rem;
  }
}
.trade-panel__price-currency {
  font-size: 1.125rem;
  color: #fff;
  font-family: 'HND', sans-serif;
}
.trade-panel__price-usd {
  font-size: 0.875rem;
  color: #888;
  font-family: 'HND', sans-serif;
}

/* Leaderboard section title */
.drawer-section-title {
  @apply text-3xl lg:text-6xl text-white mb-0;
  font-family: 'HND', sans-serif;
}

/* Expiry badge */
.trade-panel__badge {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.5rem;
  font-size: 9px;
  letter-spacing: 0.06em;
  border: 1px solid #2a2a2a;
  border-radius: 4px;
  background: #111;
  color: #aaa;
  font-family: 'HND', sans-serif;
  white-space: nowrap;
}

/* Buttons */
.trade-panel__buttons {
  display: flex;
  gap: 0.5rem;
  align-items: stretch;
}
.trade-panel__btn {
  height: 44px;
  padding: 0 1rem;
  font-size: 0.875rem;
  font-family: 'HND', sans-serif;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, opacity 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
}
.trade-panel__btn--primary {
  flex: 1;
  background: #fff;
  color: #000;
  border: 1px solid transparent;
}
.trade-panel__btn--primary:hover:not(:disabled) {
  background: #e8e8e8;
}
.trade-panel__btn--primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.trade-panel__btn--secondary {
  background: transparent;
  color: #fff;
  border: 1px solid #2a2a2a;
}
.trade-panel__btn--secondary:hover:not(:disabled) {
  border-color: #444;
}
.trade-panel__btn--secondary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.trade-panel__btn--full {
  flex: 1;
}
.trade-panel__btn--icon {
  padding: 0 0.875rem;
}

/* Status messages */
.trade-panel__msg {
  font-size: 0.75rem;
  text-align: center;
  font-family: 'HND', sans-serif;
}
.trade-panel__msg--error { color: #f87171; }
.trade-panel__msg--success { color: #4ade80; }

/* Send panel */
.trade-panel__send {
  padding: 0 1rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}
@media (min-width: 1024px) {
  .trade-panel__send {
    padding: 0 1.25rem 1.125rem;
  }
}
.trade-panel__send-row {
  display: flex;
  gap: 0.5rem;
}
.trade-panel__send-input {
  flex: 1;
  height: 40px;
  padding: 0 0.75rem;
  font-size: 0.8125rem;
  font-family: 'HND', sans-serif;
  color: #fff;
  background: #0a0a0a;
  border: 1px solid #2a2a2a;
  border-radius: 6px;
  outline: none;
  transition: border-color 0.15s;
}
.trade-panel__send-input:focus {
  border-color: #555;
}
.trade-panel__send-input::placeholder {
  color: #333;
}
.trade-panel__send-input:disabled {
  opacity: 0.5;
}

/* Offer row (owner) */
.trade-panel__offer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
}
@media (min-width: 1024px) {
  .trade-panel__offer-row {
    padding: 0.875rem 1.25rem;
  }
}
.trade-panel__offer-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.trade-panel__offer-price {
  display: flex;
  align-items: baseline;
  gap: 0.3rem;
  flex-wrap: wrap;
  font-size: 0.9375rem;
  color: #fff;
  font-family: 'HND', sans-serif;
}

/* Send slide transition */
.send-slide-enter-active, .send-slide-leave-active {
  transition: max-height 0.25s ease, opacity 0.25s ease;
  overflow: hidden;
  max-height: 200px;
}
.send-slide-enter-from, .send-slide-leave-to {
  max-height: 0;
  opacity: 0;
}

/* matter section */
.drawer__matter-title {
  @apply text-3xl lg:text-6xl text-white mb-2 lg:mb-6;
  font-family: 'HND', sans-serif;
}
.drawer__rankings {
  display: flex;
  flex-direction: column;
  gap: 32px;
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
