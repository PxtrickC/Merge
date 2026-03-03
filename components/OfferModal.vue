<script setup>
import { ethers } from 'ethers'
import { WETH_ADDRESS, OPENSEA_CONDUIT_ADDRESS } from '~/utils/trading.mjs'

const props = defineProps({
  tokenId: { type: Number, required: true },
  tier: { type: Number, default: 0 },
  mass: { type: Number, default: 0 },
  alpha_mass: { type: Number, default: 0 },
})

const emit = defineEmits(['close', 'offered'])

const { makeOffer, makingOffer, error: tradeError } = useTrading()
const { isConnected, getSigner, address } = useWallet()

const priceInput = ref('')
const duration = ref(7)
const offerSuccess = ref(false)
const wethBalance = ref(null)
const loadingBalance = ref(false)
const wrapping = ref(false)
const wrapAmount = ref('')
const showWrapPanel = ref(false)

const durationOptions = [
  { label: '1D', value: 1 },
  { label: '7D', value: 7 },
  { label: '30D', value: 30 },
]

const price = computed(() => {
  const n = Number(priceInput.value)
  return isNaN(n) || n <= 0 ? 0 : n
})

const hasEnoughWeth = computed(() => {
  if (!wethBalance.value || !price.value) return true
  return wethBalance.value >= price.value
})

// Fetch WETH balance on mount and when connected
async function fetchWethBalance() {
  if (!isConnected.value || !address.value) return
  loadingBalance.value = true
  try {
    const signer = await getSigner()
    const weth = new ethers.Contract(
      WETH_ADDRESS,
      ['function balanceOf(address) view returns (uint256)'],
      signer
    )
    const bal = await weth.balanceOf(address.value)
    wethBalance.value = Number(ethers.formatEther(bal))
  } catch {
    // best-effort
  } finally {
    loadingBalance.value = false
  }
}

onMounted(fetchWethBalance)

async function handleWrap() {
  const amount = Number(wrapAmount.value)
  if (!amount || amount <= 0) return
  wrapping.value = true
  try {
    const signer = await getSigner()
    const weth = new ethers.Contract(
      WETH_ADDRESS,
      ['function deposit() payable'],
      signer
    )
    const tx = await weth.deposit({ value: ethers.parseEther(String(amount)) })
    await tx.wait()
    wrapAmount.value = ''
    showWrapPanel.value = false
    await fetchWethBalance()
  } catch (err) {
    if (err.code !== 'ACTION_REJECTED') {
      tradeError.value = 'Wrap failed'
    }
  } finally {
    wrapping.value = false
  }
}

async function handleOffer() {
  if (!price.value) return
  try {
    await makeOffer(props.tokenId, price.value, duration.value)
    offerSuccess.value = true
    setTimeout(() => emit('offered'), 1500)
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
      <h3 class="sell-modal__title">Make Offer</h3>
    </div>

    <div class="sell-modal__preview">
      <merge-svg :tier="tier" :mass="mass" :alpha_mass="alpha_mass" class="sell-modal__preview-svg" />
      <div class="sell-modal__preview-info">
        <div class="sell-modal__preview-mass">m({{ mass }})</div>
        <div class="sell-modal__preview-id">#{{ tokenId }}</div>
      </div>
    </div>

    <div class="sell-modal__form">
      <!-- WETH Balance -->
      <div class="offer-modal__balance">
        <span class="offer-modal__balance-label">WETH Balance</span>
        <span class="offer-modal__balance-value">
          <template v-if="loadingBalance">...</template>
          <template v-else-if="wethBalance !== null">{{ wethBalance.toFixed(4) }} WETH</template>
          <template v-else>--</template>
        </span>
      </div>

      <div class="sell-modal__field">
        <label class="sell-modal__label">Offer Price</label>
        <div class="sell-modal__input-wrap">
          <input
            v-model="priceInput"
            type="number"
            step="0.0001"
            min="0"
            placeholder="0.00"
            class="sell-modal__input"
          />
          <span class="sell-modal__input-unit">WETH</span>
        </div>
      </div>

      <!-- Insufficient WETH warning + wrap option -->
      <div v-if="price > 0 && !hasEnoughWeth" class="offer-modal__warning">
        <span>Insufficient WETH.</span>
        <button class="offer-modal__wrap-toggle" @click="showWrapPanel = !showWrapPanel">
          Wrap ETH
        </button>
      </div>

      <!-- Wrap ETH panel -->
      <div v-if="showWrapPanel" class="offer-modal__wrap">
        <div class="sell-modal__input-wrap">
          <input
            v-model="wrapAmount"
            type="number"
            step="0.01"
            min="0"
            placeholder="ETH amount"
            class="sell-modal__input"
            :disabled="wrapping"
          />
          <span class="sell-modal__input-unit">ETH</span>
        </div>
        <button
          class="offer-modal__wrap-btn"
          :disabled="wrapping || !Number(wrapAmount)"
          @click="handleWrap"
        >
          {{ wrapping ? 'Wrapping...' : 'Wrap to WETH' }}
        </button>
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

      <button
        class="sell-modal__submit"
        :disabled="!price || makingOffer || !hasEnoughWeth"
        @click="handleOffer"
      >
        {{ makingOffer ? 'Submitting Offer...' : 'Submit Offer' }}
      </button>

      <div v-if="tradeError" class="sell-modal__msg sell-modal__msg--error">
        {{ tradeError }}
      </div>
      <div v-if="offerSuccess" class="sell-modal__msg sell-modal__msg--success">
        Offer submitted!
      </div>
    </div>
  </div>
</template>

<style lang="postcss" scoped>
/* Reuse SellModal styles via same class names */
.sell-modal {
  @apply flex flex-col gap-5;
  background: #0d0d0d;
  border: 1px solid #1f1f1f;
  @apply rounded-lg p-4 lg:p-5;
}
.sell-modal__header { @apply flex items-center gap-3; }
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
.sell-modal__preview {
  @apply flex items-center gap-4;
  padding: 0.75rem 0;
  border-top: 1px solid #1a1a1a;
  border-bottom: 1px solid #1a1a1a;
}
.sell-modal__preview-svg { width: 52px; height: 52px; flex-shrink: 0; }
.sell-modal__preview-info { display: flex; flex-direction: column; gap: 0.125rem; }
.sell-modal__preview-mass { font-size: 1.125rem; color: #fff; font-family: 'HND', sans-serif; }
.sell-modal__preview-id { font-size: 0.8125rem; color: #555; font-family: 'HND', sans-serif; }
.sell-modal__form { @apply flex flex-col gap-4; }
.sell-modal__field { @apply flex flex-col gap-1.5; }
.sell-modal__label { font-size: 10px; letter-spacing: 0.07em; color: #555; font-family: 'HND', sans-serif; }
.sell-modal__input-wrap {
  display: flex; align-items: center;
  border: 1px solid #2a2a2a; border-radius: 6px;
  background: #0a0a0a; overflow: hidden; transition: border-color 0.15s;
}
.sell-modal__input-wrap:focus-within { border-color: #555; }
.sell-modal__input {
  flex: 1; padding: 0.625rem 0.875rem;
  font-size: 1.375rem; color: #fff;
  background: transparent; outline: none;
  font-family: 'HND', sans-serif; border: none;
}
.sell-modal__input::placeholder { color: #2a2a2a; }
.sell-modal__input-unit {
  padding: 0 0.875rem; font-size: 0.875rem;
  color: #555; font-family: 'HND', sans-serif;
  border-left: 1px solid #2a2a2a;
}
.sell-modal__durations { @apply flex gap-2; }
.sell-modal__dur {
  flex: 1; height: 36px; font-size: 0.8125rem;
  font-family: 'HND', sans-serif;
  background: transparent; border: 1px solid #2a2a2a;
  border-radius: 6px; color: #888;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.sell-modal__dur:hover { border-color: #444; color: #fff; }
.sell-modal__dur--active { background: #fff; border-color: #fff; color: #000; }
.sell-modal__submit {
  width: 100%; height: 44px; font-size: 0.9375rem;
  font-family: 'HND', sans-serif;
  background: #fff; color: #000;
  border: 1px solid transparent; border-radius: 6px;
  transition: background 0.15s;
}
.sell-modal__submit:hover:not(:disabled) { background: #e8e8e8; }
.sell-modal__submit:disabled { opacity: 0.4; cursor: not-allowed; }
.sell-modal__msg { font-size: 0.8125rem; text-align: center; font-family: 'HND', sans-serif; }
.sell-modal__msg--error { color: #f87171; }
.sell-modal__msg--success { color: #4ade80; }

/* Offer-specific styles */
.offer-modal__balance {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.75rem;
  background: #0a0a0a;
  border: 1px solid #1a1a1a;
  border-radius: 6px;
  font-family: 'HND', sans-serif;
}
.offer-modal__balance-label {
  font-size: 10px;
  letter-spacing: 0.07em;
  color: #555;
}
.offer-modal__balance-value {
  font-size: 0.8125rem;
  color: #fff;
}
.offer-modal__warning {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: #f87171;
  font-family: 'HND', sans-serif;
}
.offer-modal__wrap-toggle {
  color: #fff;
  text-decoration: underline;
  font-size: 0.8125rem;
  font-family: 'HND', sans-serif;
  background: none;
  border: none;
  cursor: pointer;
}
.offer-modal__wrap {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.offer-modal__wrap-btn {
  width: 100%;
  height: 36px;
  font-size: 0.8125rem;
  font-family: 'HND', sans-serif;
  background: transparent;
  color: #fff;
  border: 1px solid #2a2a2a;
  border-radius: 6px;
  transition: border-color 0.15s;
}
.offer-modal__wrap-btn:hover:not(:disabled) { border-color: #555; }
.offer-modal__wrap-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
