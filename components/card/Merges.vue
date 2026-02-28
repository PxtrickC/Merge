<script setup>
import { decodeValue } from '~/utils/contract.mjs'

const props = defineProps({ id: Number })
const { db, mergedIntoIndex } = useDB()

const merges = computed(() => {
  const burnedIds = mergedIntoIndex.value?.get(props.id) ?? []
  if (!burnedIds.length || !db.value?.tokens) return []
  return burnedIds.map(bid => {
    const entry = db.value.tokens[bid]
    if (!entry) return { id: bid, tier: 0, mass: 0 }
    const { class: tier, mass } = decodeValue(entry[0])
    return { id: bid, tier, mass }
  })
})
</script>

<template>
  <div class="card__container">
    <div class="section__title">Tokens Merged</div>
    <div class="card__content">
      <span class="flex items-center gap-3" v-for="token in merges" :key="token.id">
        <merge-icon v-bind="token" dark />
        <NuxtLink tag="a" :to="`/${+token.id}`" class="link xl:text-xl">
          {{+token.id}}
        </NuxtLink>
      </span>
    </div>
  </div>
</template>

<style lang="postcss" scoped>
.section__title {
  @apply text-4xl lg:text-6xl text-white mb-6;
}
.card__content {
  @apply pt-0 mt-8 pr-4;
  @apply overflow-y-auto;
  @apply flex flex-wrap gap-x-6 gap-y-3;
  max-height: 24rem;
}

::-webkit-scrollbar {
  @apply w-1;
}
::-webkit-scrollbar-track {
  background: #111;
}
::-webkit-scrollbar-thumb {
  background: #333;
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>
