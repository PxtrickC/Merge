<script setup>
const props = defineProps({
  id: Number,
  tier: Number,
  mass: Number,
  merges: Number,
  merged: Boolean,
  owner: { type: String, default: null },
  ownerName: { type: String, default: null },
  alpha_mass: { type: Number, default: 0 },
})

function shortAddr(addr) {
  if (!addr) return ''
  return addr.slice(0, 6) + '…' + addr.slice(-4)
}
</script>

<template>
  <div class="token-card">
    <merge-svg class="token-card__sphere" :tier="tier" :mass="mass" :alpha_mass="alpha_mass" />

    <div class="token-card__info">
      <div class="token-card__header">
        <span class="token-card__mass">m({{ mass }})</span>
        <span class="token-card__id">#{{ +id }}</span>
      </div>


      <div class="stat__row">
        <span class="stat__label">TIER</span>
        <span class="stat__value">{{ tier }}</span>
      </div>
      <div class="stat__row">
        <span class="stat__label">MERGES</span>
        <span class="stat__value">{{ merges || 0 }}</span>
      </div>
      <div v-if="owner" class="stat__row">
        <span class="stat__label">OWNER</span>
        <a class="stat__value stat__addr" :href="`https://etherscan.io/address/${owner}`" target="_blank">
          {{ ownerName || shortAddr(owner) }}
        </a>
      </div>

      <div class="token-card__links">
        <span v-if="merged" class="token-card__badge">MERGED</span>
        <a
          class="token-card__extlink"
          :href="`https://opensea.io/assets/ethereum/0xc3f8a0f5841abff777d3eefa5047e8d413a1c9ab/${+id}`"
          target="_blank"
        >
          <img src="~/assets/svgs/opensea.svg" alt="OpenSea" />
        </a>
        <a
          class="token-card__extlink"
          :href="`https://etherscan.io/nft/0xc3f8a0f5841abff777d3eefa5047e8d413a1c9ab/${+id}`"
          target="_blank"
        >
          <img src="~/assets/svgs/etherscan.svg" alt="Etherscan" />
        </a>
      </div>
    </div>
  </div>
</template>

<style lang="postcss" scoped>
.token-card {
  @apply flex flex-col items-center;
}
.token-card__sphere {
  @apply w-full rounded-lg;
}
.token-card__info {
  @apply w-full mt-6;
}
.token-card__header {
  @apply flex items-baseline gap-2 pb-4;
  border-bottom: 1px solid #1a1a1a;
}
.token-card__mass {
  @apply text-4xl md:text-6xl font-semibold text-white;
}
.token-card__id {
  @apply text-4xl md:text-6xl text-white;
}
.stat__row {
  @apply flex justify-between items-center py-3;
  border-bottom: 1px solid #1a1a1a;
}
.stat__label {
  @apply text-sm tracking-widest uppercase;
  color: #555;
}
.stat__value {
  @apply text-lg text-white;
}
.stat__addr {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: #999;
  transition: color 0.15s;
}
.stat__addr:hover {
  color: #fff;
}
.token-card__links {
  @apply flex items-center gap-2 mt-4;
}
.token-card__badge {
  @apply px-2 py-1.5 text-xs font-normal;
  background: #fff;
  color: #000;
}
.token-card__extlink {
  @apply h-7 w-7 flex justify-center items-center;
  color: rgba(255, 255, 255, 0.4);
  transition: color 0.15s;
}
.token-card__extlink:first-of-type {
  @apply ml-auto;
}
.token-card__extlink:hover {
  color: rgba(255, 255, 255, 0.7);
}
.token-card__extlink img {
  @apply w-full h-full;
}
</style>
