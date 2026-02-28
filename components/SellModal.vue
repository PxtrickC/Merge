<script setup>
const props = defineProps({
  tokenId: { type: Number, required: true },
  tier: { type: Number, default: 0 },
  mass: { type: Number, default: 0 },
  alpha_mass: { type: Number, default: 0 },
})

const emit = defineEmits(['close', 'listed'])

const { sellToken, selling, error: tradeError } = useTrading()

const priceInput = ref('')
const duration = ref(30)
const listingSuccess = ref(false)

const durationOptions = [
  { label: '1 day', value: 1 },
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
]

const price = computed(() => {
  const n = Number(priceInput.value)
  return isNaN(n) || n <= 0 ? 0 : n
})

// Fetch real fees from OpenSea (includes marketplace fee + creator royalty)
const { data: collectionData } = useLazyFetch('/api/opensea/collection-fees')
const feeItems = computed(() => {
  const fees = collectionData.value?.fees || []
  // Only show required fees (OpenSea marketplace fee); creator royalty is set to 0
  return fees.filter(f => f.required).map(f => ({
    label: `OpenSea fee (${f.fee}%)`,
    pct: f.fee,
  }))
})
const totalFeePct = computed(() => feeItems.value.reduce((sum, f) => sum + f.pct, 0))
const totalFee = computed(() => price.value * totalFeePct.value / 100)
const sellerReceives = computed(() => Math.max(0, price.value - totalFee.value))

async function handleSell() {
  if (!price.value) return
  try {
    await sellToken(props.tokenId, price.value, duration.value)
    listingSuccess.value = true
    setTimeout(() => emit('listed'), 1500)
  } catch {
    // error handled in useTrading
  }
}
</script>

<template>
  <div class="sell-modal">
    <div class="sell-modal__header">
      <h3 class="sell-modal__title">Sell Token #{{ tokenId }}</h3>
      <button class="sell-modal__close" @click="$emit('close')">×</button>
    </div>

    <div class="sell-modal__preview">
      <merge-svg :tier="tier" :mass="mass" :alpha_mass="alpha_mass" />
      <span class="sell-modal__meta">m({{ mass }})</span>
    </div>

    <div class="sell-modal__form">
      <label class="sell-modal__label">Price (ETH)</label>
      <input
        v-model="priceInput"
        type="number"
        step="0.0001"
        min="0"
        placeholder="0.00"
        class="sell-modal__input"
      />

      <label class="sell-modal__label">Duration</label>
      <div class="sell-modal__durations">
        <button
          v-for="opt in durationOptions"
          :key="opt.value"
          class="sell-modal__dur"
          :class="{ 'sell-modal__dur--active': duration === opt.value }"
          @click="duration = opt.value"
        >
          {{ opt.label }}
        </button>
      </div>

      <div v-if="price > 0" class="sell-modal__fees">
        <div v-for="f in feeItems" :key="f.label" class="sell-modal__fee-row">
          <span>{{ f.label }}</span>
          <span>{{ (price * f.pct / 100).toFixed(4) }} ETH</span>
        </div>
        <div class="sell-modal__fee-row sell-modal__fee-row--total">
          <span>You receive</span>
          <span>{{ sellerReceives.toFixed(4) }} ETH</span>
        </div>
      </div>

      <button
        class="sell-modal__submit"
        :disabled="!price || selling"
        @click="handleSell"
      >
        {{ selling ? 'Creating Listing...' : 'Create Listing' }}
      </button>

      <div v-if="tradeError" class="sell-modal__error">
        {{ tradeError }}
      </div>
      <div v-if="listingSuccess" class="sell-modal__success">
        Listed successfully!
      </div>
    </div>
  </div>
</template>

<style lang="postcss" scoped>
.sell-modal {
  @apply flex flex-col gap-4;
  background: #111;
  border: 1px solid #333;
  @apply rounded-lg p-4 lg:p-6;
}
.sell-modal__header {
  @apply flex items-center justify-between;
}
.sell-modal__title {
  @apply text-base text-white;
  font-family: 'HND', sans-serif;
}
.sell-modal__close {
  @apply text-xl text-white;
  line-height: 1;
  opacity: 0.5;
  transition: opacity 0.2s;
}
.sell-modal__close:hover {
  opacity: 1;
}
.sell-modal__preview {
  @apply flex items-center gap-3;
}
.sell-modal__preview svg {
  width: 48px;
  height: 48px;
}
.sell-modal__meta {
  @apply text-sm text-white;
}
.sell-modal__form {
  @apply flex flex-col gap-3;
}
.sell-modal__label {
  @apply text-xs;
  color: #888;
  font-family: 'HND', sans-serif;
}
.sell-modal__input {
  @apply w-full px-3 py-2 text-sm text-white;
  background: #0a0a0a;
  border: 1px solid #333;
  outline: none;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  transition: border-color 0.2s;
}
.sell-modal__input:focus {
  border-color: #555;
}
.sell-modal__input::placeholder {
  color: #333;
}
.sell-modal__durations {
  @apply flex gap-2;
}
.sell-modal__dur {
  @apply px-3 py-1.5 text-xs text-white;
  font-family: 'HND', sans-serif;
  background: transparent;
  border: 1px solid #333;
  transition: background 0.2s, border-color 0.2s;
}
.sell-modal__dur:hover {
  border-color: #555;
}
.sell-modal__dur--active {
  background: #1a1a1a;
  border-color: #555;
}
.sell-modal__fees {
  @apply flex flex-col gap-1 py-2;
  border-top: 1px solid #1a1a1a;
}
.sell-modal__fee-row {
  @apply flex justify-between text-xs;
  color: #555;
}
.sell-modal__fee-row--total {
  @apply text-white pt-1;
  border-top: 1px solid #1a1a1a;
}
.sell-modal__submit {
  @apply w-full py-3 text-sm text-white text-center;
  font-family: 'HND', sans-serif;
  background: #1a1a1a;
  border: 1px solid #333;
  transition: background 0.2s, border-color 0.2s;
}
.sell-modal__submit:hover:not(:disabled) {
  background: #222;
  border-color: #555;
}
.sell-modal__submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.sell-modal__error {
  @apply text-xs text-center;
  color: #f87171;
}
.sell-modal__success {
  @apply text-xs text-center;
  color: #4ade80;
}
</style>
