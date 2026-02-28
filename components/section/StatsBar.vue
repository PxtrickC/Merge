<script setup>
import { ethers } from 'ethers'
import { MERGE_CONTRACT_ADDRESS, MERGE_ABI, NIFTY_OMNIBUS_ADDRESS } from '~/utils/contract.mjs'

const { stats, alphaToken } = useDB()

const config = useRuntimeConfig()
const esKey = config.public.ETHERSCAN_API_KEY

const total_mass = computed(() => stats.value?.total_mass ?? 0)
const token_count = ref(stats.value?.token_count ?? 0)
const merged_count = computed(() => 28990 - token_count.value)
const alpha_mass = computed(() => stats.value?.alpha_mass ?? 0)
const omnibus_count = ref(0)

// Query totalSupply + omnibus balanceOf via Etherscan eth_call proxy
const iface = new ethers.Interface(MERGE_ABI)

async function etherscanCall(to, data) {
  const url = new URL('https://api.etherscan.io/v2/api')
  url.searchParams.set('chainid', '1')
  url.searchParams.set('module', 'proxy')
  url.searchParams.set('action', 'eth_call')
  url.searchParams.set('to', to)
  url.searchParams.set('data', data)
  url.searchParams.set('tag', 'latest')
  url.searchParams.set('apikey', esKey)
  const res = await fetch(url)
  const json = await res.json()
  return json.result
}

try {
  const [supplyHex, omnibusHex] = await Promise.all([
    etherscanCall(MERGE_CONTRACT_ADDRESS, iface.encodeFunctionData('totalSupply')),
    etherscanCall(MERGE_CONTRACT_ADDRESS, iface.encodeFunctionData('balanceOf', [NIFTY_OMNIBUS_ADDRESS])),
  ])
  token_count.value = Number(BigInt(supplyHex))
  omnibus_count.value = Number(BigInt(omnibusHex))
} catch {
  // fallback to db.json stats
  token_count.value = stats.value?.token_count ?? 0
  omnibus_count.value = 0
}

</script>

<template>
  <section class="stats-bar">
    <h2 class="stats-bar__title">Merge is a game of extinction.</h2>
    <div class="stats-bar__body">
      <p><NuxtLink to="/about" class="stats-bar__link"><span class="stats-bar__link-hl">Learn</span> how it works</NuxtLink></p>
      <br />
      <p>Total Mass: {{ total_mass }}</p>
      <p>Tokens Remain: {{ token_count }}</p>
      <p>Alpha: m({{ alpha_mass }}) #{{ alphaToken?.id ?? '' }}</p>
      <p>Merged: {{ merged_count }}</p>
      <p>In NG Omnibus: {{ omnibus_count }}</p>
    </div>
  </section>
</template>

<style lang="postcss" scoped>
.stats-bar {
  @apply py-8 lg:py-12 px-4 lg:px-8;
  border-top: 1px solid #1a1a1a;
}
.stats-bar__title {
  @apply text-white mb-2;
  font-family: 'HND', sans-serif;
  font-size: 2em;
}
@media (min-width: 768px) {
  .stats-bar__title {
    @apply text-6xl;
  }
}
.stats-bar__body {
  @apply text-base lg:text-3xl text-white;
  font-family: 'HND', sans-serif;
}
.stats-bar__link {
  @apply text-white no-underline;
}
.stats-bar__link-hl {
  text-decoration: underline;
  text-underline-offset: 3px;
  transition: background-color 0.15s, color 0.15s;
}
.stats-bar__link:hover .stats-bar__link-hl {
  background: #fff;
  color: #000;
}
</style>
