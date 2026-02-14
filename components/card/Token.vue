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
        <div class="token-card__left">
          <span class="token-card__mass">m({{ mass }})</span>
          <div class="token-card__sub">
            <span class="token-card__id">#{{ +id }}</span>
            <template v-if="owner">
              <span class="token-card__own-by">own by</span>
              <a class="token-card__id token-card__owner" :href="`https://etherscan.io/address/${owner}`" target="_blank">
                {{ ownerName || shortAddr(owner) }}
              </a>
            </template>
          </div>
        </div>
        <div class="token-card__extlinks">
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

      <div class="token-card__links">
        <span v-if="mass === alpha_mass && alpha_mass > 0" class="token-card__badge token-card__badge--alpha">ALPHA</span>
        <span v-if="merged" class="token-card__badge token-card__badge--merged">MERGED</span>
        <span class="token-card__badge token-card__badge--tier" :data-tier="tier">TIER {{ tier }}</span>
        <span class="token-card__badge">MERGES {{ merges || 0 }}</span>
        <span class="token-card__badge">CLASS {{ String(id).slice(-2) }}</span>
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
  @apply w-full mt-6 flex flex-col gap-4;
}
.token-card__header {
  @apply flex justify-between items-start;
}
.token-card__left {
  @apply flex flex-col gap-3;
}
.token-card__mass {
  @apply text-3xl md:text-6xl font-semibold text-white;
}
.token-card__id {
  @apply text-lg md:text-xl text-white;
}
.token-card__sub {
  @apply flex items-baseline gap-1.5;
}
.token-card__own-by {
  @apply text-lg md:text-xl text-white;
}
.token-card__owner {
  @apply no-underline text-white;
}
.token-card__owner:hover {
  @apply underline;
}
.token-card__links {
  @apply flex items-center gap-2;
}
.token-card__badge {
  @apply px-2 py-1.5 text-xs font-normal;
  background: #fff;
  color: #000;
}
.token-card__badge--tier[data-tier="4"] {
  background: #f87171;
}
.token-card__badge--tier[data-tier="3"] {
  background: #60a5fa;
}
.token-card__badge--tier[data-tier="2"] {
  background: #facc15;
}
.token-card__badge--tier[data-tier="1"] {
  background: #e5e5e5;
}
.token-card__badge--alpha {
  background: #000;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.5);
}
.token-card__badge--merged {
  color: #f87171;
  border: 1px solid #f87171;
  background:
    linear-gradient(to top right, transparent calc(50% - 0.5px), #f87171 50%, transparent calc(50% + 0.5px)),
    linear-gradient(to bottom right, transparent calc(50% - 0.5px), #f87171 50%, transparent calc(50% + 0.5px)),
    #000;
}
.token-card__extlinks {
  @apply flex items-center gap-2;
}
.token-card__extlink {
  @apply h-7 w-7 flex justify-center items-center text-white;
}
.token-card__extlink img {
  @apply w-full h-full;
}
</style>
