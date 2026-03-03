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
  { label: '1D', value: 1 },
  { label: '7D', value: 7 },
  { label: '30D', value: 30 },
  { label: '90D', value: 90 },
]

const price = computed(() => {
  const n = Number(priceInput.value)
  return isNaN(n) || n <= 0 ? 0 : n
})

// Fetch real fees from OpenSea (includes marketplace fee + creator royalty)
const { data: collectionData } = useLazyFetch('/api/opensea/collection-fees')
const feeItems = computed(() => {
  const fees = collectionData.value?.fees || []
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
    const result = await sellToken(props.tokenId, price.value, duration.value)
    listingSuccess.value = true
    setTimeout(() => emit('listed', {
      price: price.value,
      duration: duration.value,
      order: result?.order,
    }), 1500)
  } catch {
    // error handled in useTrading
  }
}
</script>

<template>
  <div class="sell-modal">
    <div class="sell-modal__header">
      <button class="sell-modal__close" @click="$emit('close')">
        <icon class="w-5 h-5" variant="return" />
      </button>
      <h3 class="sell-modal__title">List for Sale</h3>
    </div>

    <div class="sell-modal__preview">
      <merge-svg :tier="tier" :mass="mass" :alpha_mass="alpha_mass" class="sell-modal__preview-svg" />
      <div class="sell-modal__preview-info">
        <div class="sell-modal__preview-mass">m({{ mass }})</div>
        <div class="sell-modal__preview-id">#{{ tokenId }}</div>
      </div>
    </div>

    <div class="sell-modal__form">
      <div class="sell-modal__field">
        <label class="sell-modal__label">Price</label>
        <div class="sell-modal__input-wrap">
          <input
            v-model="priceInput"
            type="number"
            step="0.0001"
            min="0"
            placeholder="0.00"
            class="sell-modal__input"
          />
          <span class="sell-modal__input-unit">ETH</span>
        </div>
      </div>

      <div class="sell-modal__field">
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

      <div v-if="tradeError" class="sell-modal__msg sell-modal__msg--error">
        {{ tradeError }}
      </div>
      <div v-if="listingSuccess" class="sell-modal__msg sell-modal__msg--success">
        Listed successfully! ✓
      </div>
    </div>
  </div>
</template>

<style lang="postcss" scoped>
.sell-modal {
  @apply flex flex-col gap-5;
  background: #0d0d0d;
  border: 1px solid #1f1f1f;
  @apply rounded-lg p-4 lg:p-5;
}

/* Header */
.sell-modal__header {
  @apply flex items-center gap-3;
}
.sell-modal__close {
  @apply w-8 h-8 p-0 flex items-center justify-center;
  background: transparent;
  color: #888;
  transition: color 0.15s;
}
.sell-modal__close:hover { color: #fff; }
.sell-modal__title {
  font-size: 0.9375rem;
  color: #fff;
  font-family: 'HND', sans-serif;
}

/* Preview */
.sell-modal__preview {
  @apply flex items-center gap-4;
  padding: 0.75rem 0;
  border-top: 1px solid #1a1a1a;
  border-bottom: 1px solid #1a1a1a;
}
.sell-modal__preview-svg {
  width: 52px;
  height: 52px;
  flex-shrink: 0;
}
.sell-modal__preview-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}
.sell-modal__preview-mass {
  font-size: 1.125rem;
  color: #fff;
  font-family: 'HND', sans-serif;
}
.sell-modal__preview-id {
  font-size: 0.8125rem;
  color: #555;
  font-family: 'HND', sans-serif;
}

/* Form */
.sell-modal__form {
  @apply flex flex-col gap-4;
}
.sell-modal__field {
  @apply flex flex-col gap-1.5;
}
.sell-modal__label {
  font-size: 10px;
  letter-spacing: 0.07em;
  color: #555;
  font-family: 'HND', sans-serif;
}

/* Price input */
.sell-modal__input-wrap {
  display: flex;
  align-items: center;
  border: 1px solid #2a2a2a;
  border-radius: 6px;
  background: #0a0a0a;
  overflow: hidden;
  transition: border-color 0.15s;
}
.sell-modal__input-wrap:focus-within {
  border-color: #555;
}
.sell-modal__input {
  flex: 1;
  padding: 0.625rem 0.875rem;
  font-size: 1.375rem;
  color: #fff;
  background: transparent;
  outline: none;
  font-family: 'HND', sans-serif;
  border: none;
}
.sell-modal__input::placeholder {
  color: #2a2a2a;
}
.sell-modal__input-unit {
  padding: 0 0.875rem;
  font-size: 0.875rem;
  color: #555;
  font-family: 'HND', sans-serif;
  border-left: 1px solid #2a2a2a;
}

/* Duration pills */
.sell-modal__durations {
  @apply flex gap-2;
}
.sell-modal__dur {
  flex: 1;
  height: 36px;
  font-size: 0.8125rem;
  font-family: 'HND', sans-serif;
  background: transparent;
  border: 1px solid #2a2a2a;
  border-radius: 6px;
  color: #888;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.sell-modal__dur:hover {
  border-color: #444;
  color: #fff;
}
.sell-modal__dur--active {
  background: #fff;
  border-color: #fff;
  color: #000;
}

/* Fee breakdown */
.sell-modal__fees {
  @apply flex flex-col gap-1.5;
  padding: 0.75rem;
  background: #0a0a0a;
  border: 1px solid #1a1a1a;
  border-radius: 6px;
}
.sell-modal__fee-row {
  @apply flex justify-between;
  font-size: 0.8125rem;
  color: #555;
  font-family: 'HND', sans-serif;
}
.sell-modal__fee-row--total {
  color: #fff;
  padding-top: 0.5rem;
  border-top: 1px solid #1a1a1a;
  margin-top: 0.25rem;
}

/* Submit */
.sell-modal__submit {
  width: 100%;
  height: 44px;
  font-size: 0.9375rem;
  font-family: 'HND', sans-serif;
  background: #fff;
  color: #000;
  border: 1px solid transparent;
  border-radius: 6px;
  transition: background 0.15s;
}
.sell-modal__submit:hover:not(:disabled) {
  background: #e8e8e8;
}
.sell-modal__submit:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Messages */
.sell-modal__msg {
  font-size: 0.8125rem;
  text-align: center;
  font-family: 'HND', sans-serif;
}
.sell-modal__msg--error { color: #f87171; }
.sell-modal__msg--success { color: #4ade80; }
</style>
