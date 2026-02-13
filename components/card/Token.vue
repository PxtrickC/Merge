<script setup>
defineProps({
  id: Number,
  tier: Number,
  mass: Number,
  token_class: Number,
  merges: Number,
  merged: Boolean,
  alpha_mass: { type: Number, default: 0 },
})

function formatDate(merged_on) {
  if (!merged_on) return ""
  return new Date(merged_on).toDateString()
}
</script>

<template>
  <div class="card__container">
    <merge-svg class="md:w-56 lg:w-80 xl:w-96 rounded-lg" :tier="tier" :mass="mass" :alpha_mass="alpha_mass" />
    <div class="flex-grow flex flex-col justify-start py-3 pr-2">
      <div class="flex gap-1.5">
        <span class="text-xl lg:text-2xl xl:text-3xl font-semibold">m({{mass}})</span>
        <span class="self-end text-white text-opacity-50">#{{+id}}</span>
      </div>
      <p class="mt-2">Tier {{tier}}</p>
      <p>Class {{token_class}}</p>
      <p>Merges {{merges || 0}}</p>

      <p class="mt-auto flex items-end gap-1">
        <span v-if="merged" class="h-fit w-fit px-2 py-1.5 bg-white text-black text-xs font-normal">
          MERGED
        </span>
        <a
          class="h-7 w-7 ml-auto flex justify-center items-center text-white text-opacity-40 transition-opacity hover:opacity-70"
          :href="`https://opensea.io/assets/ethereum/0xc3f8a0f5841abff777d3eefa5047e8d413a1c9ab/${+id}`"
          target="_blank"
        >
          <img src="~/assets/svgs/opensea.svg" alt="OpenSea" />
        </a>
        <a
          class="h-7 w-7 flex justify-center items-center text-white text-opacity-40 transition-opacity hover:opacity-70"
          :href="`https://etherscan.io/nft/0xc3f8a0f5841abff777d3eefa5047e8d413a1c9ab/${+id}`"
          target="_blank"
        >
          <img src="~/assets/svgs/etherscan.svg" alt="Etherscan" />
        </a>
      </p>
    </div>
  </div>
</template>

<style lang="postcss" scoped>
.card__container {
  @apply relative;
  @apply w-full flex-grow;
  @apply p-2;
  border: 1px solid #222;
  @apply flex gap-4;
  @apply text-white lg:text-lg xl:text-xl;
}
</style>
