<script setup>
import { ethers } from 'ethers'
import { MERGE_CONTRACT_ADDRESS, MERGE_ABI } from '~/utils/contract.mjs'

const stats = await useAPI("/stats")
const omnibus = await useAPI("/omnibus")

const total_mass = computed(() => stats.value?.total_mass ?? 0)
const alpha_mass = computed(() => stats.value?.alpha_mass ?? 0)
const merged_count = computed(() => stats.value?.merged_count ?? 0)
const omnibus_count = computed(() => omnibus.value?.count ?? 0)

// Query live totalSupply from chain
const token_count = ref(0)
try {
  const config = useRuntimeConfig()
  const rpcUrl = `https://eth-mainnet.g.alchemy.com/v2/${config.public.ALCHEMY_API_KEY}`
  const provider = new ethers.JsonRpcProvider(rpcUrl)
  const contract = new ethers.Contract(MERGE_CONTRACT_ADDRESS, MERGE_ABI, provider)
  token_count.value = Number(await contract.totalSupply())
} catch {
  token_count.value = stats.value?.token_count ?? 0
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
      // ease-in + extremely slow ease-out
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

const animTokenCount = useCountUp(token_count, 1500, 28990)
const animTotalMass = computed(() => String(total_mass.value))
const animAlphaMass = useCountUp(alpha_mass)
const animMergedCount = useCountUp(merged_count)
const animOmnibusCount = useCountUp(omnibus_count, 2200, 28990)
</script>

<template>
  <section class="hero">
    <h1 class="hero__title">merge.</h1>

    <div class="hero__stats">
      <div class="hero__stat">
        <span class="hero__stat__value">{{ animTokenCount }}</span>
        <span class="hero__stat__label">tokens remain</span>
      </div>
      <div class="hero__stat">
        <span class="hero__stat__value">{{ animTotalMass }}</span>
        <span class="hero__stat__label">total mass</span>
      </div>
      <div class="hero__stat">
        <span class="hero__stat__value">{{ animAlphaMass }}</span>
        <span class="hero__stat__label">alpha</span>
      </div>
    </div>

    <div class="hero__stats hero__stats--secondary">
      <div class="hero__stat">
        <span class="hero__stat__value hero__stat__value--secondary">{{ animMergedCount }}</span>
        <span class="hero__stat__label">merged</span>
      </div>
      <div class="hero__stat">
        <span class="hero__stat__value hero__stat__value--secondary">{{ animOmnibusCount }}</span>
        <span class="hero__stat__label">in NG omnibus</span>
      </div>
    </div>
  </section>
</template>

<style lang="postcss" scoped>
.hero {
  @apply min-h-screen flex flex-col items-center justify-center;
  @apply p-4 md:p-8;
  @apply relative;
}
.hero__title {
  font-family: 'DM Sans', sans-serif;
  font-weight: 700;
  @apply text-white mb-16;
  font-size: clamp(4rem, 15vw, 10rem);
  line-height: 1;
  letter-spacing: -0.03em;
}
.hero__stats {
  @apply flex gap-12 md:gap-24;
}
.hero__stats--secondary {
  @apply mt-8;
}
.hero__stat__value--secondary {
  @apply text-3xl md:text-5xl lg:text-6xl;
}
.hero__stat {
  @apply flex flex-col items-center;
}
.hero__stat__value {
  @apply text-4xl md:text-7xl lg:text-8xl font-medium;
  @apply text-white;
  font-variant-numeric: tabular-nums;
  min-width: 6ch;
  text-align: center;
}
.hero__stat__label {
  @apply text-xs uppercase tracking-[0.2em] mt-2;
  color: #555;
}
</style>
