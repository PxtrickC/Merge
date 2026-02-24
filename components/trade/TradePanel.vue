<script setup>
const props = defineProps({
  tokenId: { type: Number, required: true },
  owner: { type: String, default: null },
})

const emit = defineEmits(["buy-success", "list-success"])

const { isConnected, address, openModal } = useWallet()
const { fetchTokenMarket } = useReservoir()

const market = ref(null)
const loadingMarket = ref(true)
const showBuyModal = ref(false)
const showListModal = ref(false)

const isOwner = computed(() => {
  if (!address.value || !props.owner) return false
  return address.value.toLowerCase() === props.owner.toLowerCase()
})

const feeBps = useRuntimeConfig().public.PLATFORM_FEE_BPS || "50"
const feePercent = computed(() => (Number(feeBps) / 100).toFixed(1))

// Reload market data whenever tokenId changes
watch(
  () => props.tokenId,
  async (id) => {
    loadingMarket.value = true
    market.value = null
    try {
      market.value = await fetchTokenMarket(id)
    } catch (e) {
      console.error("[TradePanel] fetchTokenMarket", e)
    } finally {
      loadingMarket.value = false
    }
  },
  { immediate: true }
)

function onBuySuccess() {
  showBuyModal.value = false
  emit("buy-success")
  // Refresh market after short delay
  setTimeout(async () => {
    market.value = await fetchTokenMarket(props.tokenId).catch(() => null)
  }, 3000)
}

function onListSuccess() {
  showListModal.value = false
  emit("list-success")
  setTimeout(async () => {
    market.value = await fetchTokenMarket(props.tokenId).catch(() => null)
  }, 3000)
}
</script>

<template>
  <div class="trade-panel">
    <div class="trade-panel__title">TRADE</div>

    <!-- Market data loading -->
    <div v-if="loadingMarket" class="trade-panel__loading">
      <span class="trade-panel__loading-dot" />
    </div>

    <!-- Market data loaded -->
    <template v-else>
      <!-- Floor ask price -->
      <div class="trade-panel__price-row">
        <div class="trade-panel__label">FLOOR ASK</div>
        <div v-if="market?.floorAsk" class="trade-panel__price">
          <span class="trade-panel__eth">{{ market.floorAsk.price.toFixed(4) }} ETH</span>
          <span v-if="market.floorAsk.priceUsd" class="trade-panel__usd">${{ Math.round(market.floorAsk.priceUsd).toLocaleString() }}</span>
          <span v-if="market.floorAsk.source" class="trade-panel__source">{{ market.floorAsk.source }}</span>
        </div>
        <div v-else class="trade-panel__none">No listings</div>
      </div>

      <!-- Top bid -->
      <div v-if="market?.topBid" class="trade-panel__price-row">
        <div class="trade-panel__label">TOP BID</div>
        <div class="trade-panel__price">
          <span class="trade-panel__eth">{{ market.topBid.price.toFixed(4) }} ETH</span>
          <span v-if="market.topBid.priceUsd" class="trade-panel__usd">${{ Math.round(market.topBid.priceUsd).toLocaleString() }}</span>
        </div>
      </div>

      <!-- Action buttons -->
      <div class="trade-panel__actions">
        <!-- Buy button -->
        <template v-if="!isOwner">
          <button
            v-if="market?.floorAsk && isConnected"
            class="trade-panel__btn trade-panel__btn--buy"
            @click="showBuyModal = true"
          >
            BUY {{ market.floorAsk.price.toFixed(4) }} ETH
            <span class="trade-panel__fee-hint">+{{ feePercent }}% fee</span>
          </button>
          <button
            v-else-if="market?.floorAsk && !isConnected"
            class="trade-panel__btn trade-panel__btn--connect"
            @click="openModal"
          >
            CONNECT WALLET TO BUY
          </button>
        </template>

        <!-- Sell / List button (only if user owns the token) -->
        <template v-if="isOwner">
          <button
            class="trade-panel__btn trade-panel__btn--list"
            @click="showListModal = true"
          >
            LIST FOR SALE
          </button>
        </template>
      </div>
    </template>

    <!-- Buy modal -->
    <trade-buy-modal
      v-if="showBuyModal"
      :token-id="tokenId"
      :market="market"
      @close="showBuyModal = false"
      @success="onBuySuccess"
    />

    <!-- List modal -->
    <trade-list-modal
      v-if="showListModal"
      :token-id="tokenId"
      @close="showListModal = false"
      @success="onListSuccess"
    />
  </div>
</template>

<style lang="postcss" scoped>
.trade-panel {
  @apply flex flex-col gap-3;
}

.trade-panel__title {
  @apply text-xs font-bold tracking-widest text-white text-opacity-40;
}

.trade-panel__loading {
  @apply py-3 flex items-center gap-2;
}

.trade-panel__loading-dot {
  @apply inline-block w-1.5 h-1.5 rounded-full bg-white bg-opacity-30;
  animation: pulse 1.2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

.trade-panel__price-row {
  @apply flex items-center justify-between gap-4;
}

.trade-panel__label {
  @apply text-2xs font-bold tracking-widest text-white text-opacity-30 shrink-0;
}

.trade-panel__price {
  @apply flex items-center gap-2 flex-wrap justify-end;
}

.trade-panel__eth {
  @apply text-sm font-bold text-white;
}

.trade-panel__usd {
  @apply text-2xs text-white text-opacity-40;
}

.trade-panel__source {
  @apply text-2xs text-white text-opacity-30 italic;
}

.trade-panel__none {
  @apply text-2xs text-white text-opacity-20 italic;
}

.trade-panel__actions {
  @apply flex flex-col gap-2 pt-1;
}

.trade-panel__btn {
  @apply w-full py-2 px-4;
  @apply text-xs font-bold tracking-widest;
  @apply border transition-all duration-150;
  font-family: "HND", monospace;
  @apply flex items-center justify-center gap-2;
}

.trade-panel__btn--buy {
  @apply border-white text-black bg-white;
  @apply hover:bg-opacity-90;
}

.trade-panel__btn--list {
  @apply border-white border-opacity-40 text-white text-opacity-70;
  @apply hover:border-opacity-80 hover:text-opacity-100;
}

.trade-panel__btn--connect {
  @apply border-white border-opacity-20 text-white text-opacity-40;
  @apply hover:border-opacity-50 hover:text-opacity-70;
}

.trade-panel__fee-hint {
  @apply text-2xs font-normal text-black text-opacity-50;
}
</style>
