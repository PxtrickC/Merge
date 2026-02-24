<script setup>
import { ethers } from "ethers"
import { MERGE_CONTRACT_ADDRESS, MERGE_ABI } from "~/utils/contract.mjs"

const props = defineProps({
  tokenId: { type: Number, required: true },
  market: { type: Object, required: true },  // { floorAsk: { price, priceUsd, source } }
})

const emit = defineEmits(["close", "success"])

const { getSigner, address, isConnected } = useWallet()
const { buyToken } = useReservoir()
const config = useRuntimeConfig()

// ── Merge risk check ──────────────────────────────────────────────────────
const existingTokenId = ref(null)
const checkingMergeRisk = ref(true)

onMounted(async () => {
  if (!address.value) { checkingMergeRisk.value = false; return }
  try {
    const apiKey = config.public.ALCHEMY_API_KEY
    const rpcUrl = `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`
    const provider = new ethers.JsonRpcProvider(rpcUrl)
    const contract = new ethers.Contract(MERGE_CONTRACT_ADDRESS, MERGE_ABI, provider)
    const balance = await contract.balanceOf(address.value)
    if (balance > 0n) {
      const ownedId = await contract.tokenOf(address.value)
      existingTokenId.value = Number(ownedId)
    }
  } catch (e) {
    console.error("[BuyModal] balanceOf check failed", e)
  } finally {
    checkingMergeRisk.value = false
  }
})

const hasMergeRisk = computed(() => existingTokenId.value !== null && existingTokenId.value !== props.tokenId)
const mergeConfirmed = ref(false)

const canBuy = computed(() => {
  if (checkingMergeRisk.value) return false
  if (hasMergeRisk.value && !mergeConfirmed.value) return false
  return true
})

// ── Fee calculation ───────────────────────────────────────────────────────
const feeBps = Number(config.public.PLATFORM_FEE_BPS || 50)
const feeMultiplier = 1 + feeBps / 10000
const totalEth = computed(() => props.market.floorAsk.price * feeMultiplier)
const platformFeeEth = computed(() => props.market.floorAsk.price * (feeBps / 10000))

// ── Transaction ───────────────────────────────────────────────────────────
const txSteps = ref([])
const txError = ref(null)
const txSuccess = ref(false)
const buying = ref(false)

async function confirmBuy() {
  if (!canBuy.value) return
  buying.value = true
  txError.value = null
  txSteps.value = []

  try {
    await buyToken(props.tokenId, {
      onProgress: (steps) => {
        txSteps.value = steps
      },
    })
    txSuccess.value = true
    setTimeout(() => emit("success"), 1500)
  } catch (err) {
    if (err?.code === "WALLET_NOT_CONNECTED") txError.value = "Wallet not connected."
    else if (err?.code === "WRONG_NETWORK") txError.value = "Please switch to Ethereum Mainnet."
    else txError.value = err?.message ?? "Transaction failed."
  } finally {
    buying.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="modal__backdrop" @click.self="!buying && emit('close')">
      <div class="modal__box">
        <!-- Header -->
        <div class="modal__header">
          <span class="modal__title">BUY #{{ tokenId }}</span>
          <button v-if="!buying" class="modal__close" @click="emit('close')">✕</button>
        </div>

        <!-- Merge risk warning -->
        <div v-if="!checkingMergeRisk && hasMergeRisk" class="modal__warning">
          <div class="modal__warning-title">⚠ MERGE RISK</div>
          <p class="modal__warning-text">
            Your wallet already holds token <strong>#{{ existingTokenId }}</strong>.
            Purchasing this token will trigger an automatic merge—the token with lower mass will be
            <strong>permanently destroyed</strong>. This action cannot be undone.
          </p>
          <label class="modal__warning-check">
            <input v-model="mergeConfirmed" type="checkbox" />
            <span>I understand and accept the merge risk</span>
          </label>
        </div>

        <!-- Price breakdown -->
        <div class="modal__breakdown">
          <div class="modal__row">
            <span class="modal__row-label">NFT Price</span>
            <span class="modal__row-value">{{ market.floorAsk.price.toFixed(4) }} ETH</span>
          </div>
          <div class="modal__row">
            <span class="modal__row-label">Platform fee ({{ (feeBps / 100).toFixed(1) }}%)</span>
            <span class="modal__row-value">{{ platformFeeEth.toFixed(6) }} ETH</span>
          </div>
          <div class="modal__row modal__row--total">
            <span class="modal__row-label">Total</span>
            <span class="modal__row-value">{{ totalEth.toFixed(4) }} ETH</span>
          </div>
          <div v-if="market.floorAsk.source" class="modal__source">
            via {{ market.floorAsk.source }}
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
          :disabled="!canBuy || buying || txSuccess"
          @click="confirmBuy"
        >
          <span v-if="checkingMergeRisk">Checking…</span>
          <span v-else-if="buying">Processing…</span>
          <span v-else-if="txSuccess">✓ Done</span>
          <span v-else>CONFIRM PURCHASE</span>
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

.modal__warning {
  @apply border border-yellow border-opacity-40 p-3 flex flex-col gap-2;
}

.modal__warning-title {
  @apply text-xs font-bold text-yellow tracking-widest;
}

.modal__warning-text {
  @apply text-xs text-white text-opacity-70 leading-relaxed;
}

.modal__warning-text strong {
  @apply text-white;
}

.modal__warning-check {
  @apply flex items-start gap-2 text-xs text-white text-opacity-70 cursor-pointer;
}

.modal__warning-check input {
  @apply mt-0.5 shrink-0 accent-yellow;
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
  @apply text-opacity-90 font-bold;
}

.modal__source {
  @apply text-2xs text-white text-opacity-25 text-right italic;
}

.modal__confirm {
  @apply w-full py-2.5 text-xs font-bold tracking-widest;
  @apply bg-white text-black;
  @apply hover:bg-opacity-90 transition-all duration-150;
  @apply disabled:opacity-40 disabled:cursor-not-allowed;
  font-family: "HND", monospace;
}
</style>
