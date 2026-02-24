<script setup>
const props = defineProps({
  tokenId: { type: Number, required: true },
})

const emit = defineEmits(["close", "success"])

const { listToken } = useReservoir()
const config = useRuntimeConfig()

// ── Form state ────────────────────────────────────────────────────────────
const priceEth = ref("")
const expirationDays = ref(30)

const EXPIRY_OPTIONS = [
  { label: "7 days",  value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
]

// ── Fee calculation ───────────────────────────────────────────────────────
const feeBps = Number(config.public.PLATFORM_FEE_BPS || 50)
const platformFeeEth = computed(() => {
  const p = Number(priceEth.value)
  if (!p || p <= 0) return null
  return (p * feeBps) / 10000
})

// ── Transaction ───────────────────────────────────────────────────────────
const txSteps = ref([])
const txError = ref(null)
const txSuccess = ref(false)
const listing = ref(false)

const canList = computed(() => {
  const p = Number(priceEth.value)
  return p > 0 && !listing.value && !txSuccess.value
})

async function confirmList() {
  if (!canList.value) return
  listing.value = true
  txError.value = null
  txSteps.value = []

  try {
    await listToken(props.tokenId, {
      priceEth: Number(priceEth.value),
      expirationDays: expirationDays.value,
      onProgress: (steps) => {
        txSteps.value = steps
      },
    })
    txSuccess.value = true
    setTimeout(() => emit("success"), 1500)
  } catch (err) {
    if (err?.code === "WALLET_NOT_CONNECTED") txError.value = "Wallet not connected."
    else if (err?.code === "WRONG_NETWORK") txError.value = "Please switch to Ethereum Mainnet."
    else if (err?.code === "INVALID_PRICE") txError.value = "Please enter a valid price."
    else txError.value = err?.message ?? "Listing failed."
  } finally {
    listing.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="modal__backdrop" @click.self="!listing && emit('close')">
      <div class="modal__box">
        <!-- Header -->
        <div class="modal__header">
          <span class="modal__title">LIST #{{ tokenId }}</span>
          <button v-if="!listing" class="modal__close" @click="emit('close')">✕</button>
        </div>

        <!-- Price input -->
        <div class="modal__field">
          <label class="modal__field-label">PRICE (ETH)</label>
          <input
            v-model="priceEth"
            type="number"
            step="0.001"
            min="0"
            placeholder="0.00"
            class="modal__input"
            :disabled="listing || txSuccess"
          />
        </div>

        <!-- Expiration -->
        <div class="modal__field">
          <label class="modal__field-label">DURATION</label>
          <div class="modal__expiry-options">
            <button
              v-for="opt in EXPIRY_OPTIONS"
              :key="opt.value"
              class="modal__expiry-btn"
              :class="{ 'modal__expiry-btn--active': expirationDays === opt.value }"
              :disabled="listing || txSuccess"
              @click="expirationDays = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <!-- Fee breakdown -->
        <div v-if="platformFeeEth !== null" class="modal__breakdown">
          <div class="modal__row">
            <span class="modal__row-label">List price</span>
            <span class="modal__row-value">{{ Number(priceEth).toFixed(4) }} ETH</span>
          </div>
          <div class="modal__row">
            <span class="modal__row-label">Platform fee deducted ({{ (feeBps / 100).toFixed(1) }}%)</span>
            <span class="modal__row-value">−{{ platformFeeEth.toFixed(6) }} ETH</span>
          </div>
          <div class="modal__row modal__row--note">
            <span class="modal__row-label">Listed on OpenSea, Blur & more via Reservoir</span>
          </div>
        </div>

        <!-- TX progress -->
        <trade-tx-progress
          v-if="txSteps.length || txError || txSuccess"
          :steps="txSteps"
          :error="txError"
          :success="txSuccess"
        />

        <!-- Confirm button -->
        <button
          class="modal__confirm"
          :disabled="!canList"
          @click="confirmList"
        >
          <span v-if="listing">Processing…</span>
          <span v-else-if="txSuccess">✓ Listed</span>
          <span v-else>CONFIRM LISTING</span>
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style lang="postcss" scoped>
.modal__backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.modal__box {
  @apply w-full max-w-sm bg-black border border-white border-opacity-10;
  @apply flex flex-col gap-5 p-6;
}

.modal__header {
  @apply flex items-center justify-between;
}

.modal__title {
  @apply text-sm font-bold tracking-widest text-white;
  font-family: "HND", monospace;
}

.modal__close {
  @apply text-xs text-white text-opacity-40 hover:text-opacity-80;
}

.modal__field {
  @apply flex flex-col gap-1.5;
}

.modal__field-label {
  @apply text-2xs font-bold tracking-widest text-white text-opacity-40;
}

.modal__input {
  @apply w-full bg-transparent border border-white border-opacity-20;
  @apply px-3 py-2 text-sm text-white;
  @apply focus:outline-none focus:border-opacity-50;
  @apply disabled:opacity-40;
  font-family: "HND", monospace;
}

.modal__input::placeholder {
  @apply text-white text-opacity-20;
}

.modal__expiry-options {
  @apply flex gap-2;
}

.modal__expiry-btn {
  @apply flex-1 py-1.5 text-2xs font-bold tracking-widest;
  @apply border border-white border-opacity-20 text-white text-opacity-50;
  @apply hover:border-opacity-50 hover:text-opacity-80;
  @apply transition-all duration-100;
  @apply disabled:opacity-40 disabled:cursor-not-allowed;
  font-family: "HND", monospace;
}

.modal__expiry-btn--active {
  @apply border-white border-opacity-60 text-opacity-100 bg-white bg-opacity-5;
}

.modal__breakdown {
  @apply flex flex-col gap-2;
}

.modal__row {
  @apply flex items-center justify-between;
}

.modal__row-label {
  @apply text-xs text-white text-opacity-50;
}

.modal__row-value {
  @apply text-xs text-white;
}

.modal__row--total {
  @apply border-t border-white border-opacity-10 pt-2;
}

.modal__row--total .modal__row-label,
.modal__row--total .modal__row-value {
  @apply font-bold text-opacity-90;
}

.modal__row--note .modal__row-label {
  @apply text-2xs text-opacity-25 italic;
}

.modal__confirm {
  @apply w-full py-2.5 text-xs font-bold tracking-widest;
  @apply border border-white border-opacity-40 text-white text-opacity-80;
  @apply hover:border-opacity-70 hover:text-opacity-100;
  @apply transition-all duration-150;
  @apply disabled:opacity-30 disabled:cursor-not-allowed;
  font-family: "HND", monospace;
}
</style>
