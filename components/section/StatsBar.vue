<script setup>
import { ethers } from 'ethers'
import { MERGE_CONTRACT_ADDRESS, MERGE_ABI, NIFTY_OMNIBUS_ADDRESS } from '~/utils/contract.mjs'

const { stats } = useDB()

const total_mass = computed(() => stats.value?.total_mass ?? 0)
const token_count = computed(() => stats.value?.token_count ?? 0)
const merged_count = computed(() => stats.value?.merged_count ?? 0)
const alpha_mass = computed(() => stats.value?.alpha_mass ?? 0)

// Omnibus count still requires a live RPC call (not in db.json)
const omnibus_count = ref(0)
try {
  const config = useRuntimeConfig()
  const rpcUrl = `https://eth-mainnet.g.alchemy.com/v2/${config.public.ALCHEMY_API_KEY}`
  const provider = new ethers.JsonRpcProvider(rpcUrl)
  const contract = new ethers.Contract(MERGE_CONTRACT_ADDRESS, MERGE_ABI, provider)
  const omniBal = await contract.balanceOf(NIFTY_OMNIBUS_ADDRESS)
  omnibus_count.value = Number(omniBal)
} catch {
  omnibus_count.value = 0
}

function useCountUp(target, duration = 3500, initialValue = 0) {
  const display = ref(initialValue)
  let raf = null

  watch(target, (val) => {
    if (!val) return
    const start = display.value
    const diff = val - start
    const startTime = performance.now()

    function tick(now) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = progress < 0.25
        ? Math.pow(progress / 0.25, 2) * 0.8
        : 0.8 + 0.2 * (1 - Math.pow(1 - (progress - 0.25) / 0.75, 7))
      display.value = Math.round(start + diff * eased)
      if (progress < 1) {
        raf = requestAnimationFrame(tick)
      }
    }

    if (raf) cancelAnimationFrame(raf)
    raf = requestAnimationFrame(tick)
  }, { immediate: true })

  return computed(() => String(display.value))
}

const animTokenCount = useCountUp(token_count, 1500)
const animTotalMass = computed(() => String(total_mass.value))
const animAlphaMass = useCountUp(alpha_mass, 2000)
const animMergedCount = useCountUp(merged_count, 2200)
const animOmnibusCount = useCountUp(omnibus_count, 2200)
</script>

<template>
  <section class="stats-bar">
    <div class="stats-bar__row">
      <div class="stats-bar__item">
        <span class="stats-bar__value">{{ animTotalMass }}</span>
        <span class="stats-bar__label">total mass</span>
      </div>
      <div class="stats-bar__sep" />
      <div class="stats-bar__item">
        <span class="stats-bar__value">{{ animTokenCount }}</span>
        <span class="stats-bar__label">tokens remain</span>
      </div>
      <div class="stats-bar__sep" />
      <div class="stats-bar__item">
        <span class="stats-bar__value">m({{ animAlphaMass }})</span>
        <span class="stats-bar__label">alpha</span>
      </div>
    </div>
    <div class="stats-bar__row">
      <div class="stats-bar__sep stats-bar__sep--between" />
      <div class="stats-bar__item">
        <span class="stats-bar__value">{{ animMergedCount }}</span>
        <span class="stats-bar__label">merged</span>
      </div>
      <div class="stats-bar__sep" />
      <div class="stats-bar__item">
        <span class="stats-bar__value">{{ animOmnibusCount }}</span>
        <span class="stats-bar__label">in NG omnibus</span>
      </div>
    </div>
  </section>
</template>

<style lang="postcss" scoped>
.stats-bar {
  @apply py-8 md:py-12 px-4 md:px-8;
  border-top: 1px solid #1a1a1a;
  border-bottom: 1px solid #1a1a1a;
}
/* Wide: single row */
@media (min-width: 1024px) {
  .stats-bar {
    @apply flex items-center justify-center gap-16;
  }
  .stats-bar__row {
    display: contents;
  }
}
/* Narrow: two rows, each centered */
@media (max-width: 1023px) {
  .stats-bar {
    @apply flex flex-col items-center gap-4;
  }
  .stats-bar__row {
    @apply flex items-center justify-center gap-4;
  }
}
.stats-bar__item {
  @apply flex flex-col items-center;
}
.stats-bar__sep {
  @apply w-px h-8 sm:h-12;
  background: #1a1a1a;
}
/* Hide the between-row sep on narrow screens (it's only for wide single-row) */
@media (max-width: 1023px) {
  .stats-bar__sep--between {
    @apply hidden;
  }
}
.stats-bar__value {
  @apply text-xl sm:text-2xl md:text-4xl lg:text-5xl font-medium text-white;
}
.stats-bar__label {
  @apply text-xs md:text-sm text-white mt-1 capitalize;
}
</style>
