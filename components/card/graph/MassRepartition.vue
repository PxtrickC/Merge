<script setup>
const mass_repartition = await useAPI("/mass_repartition")

const sorted_data = computed(() => {
  if (!mass_repartition.value) return []
  const sorted = [...mass_repartition.value].sort((a, b) => b.count - a.count).filter(d => d.count > 0)
  const max = sorted[0]?.count ?? 1
  return sorted.map(item => ({
    label: item.label ?? `m(${item.mass})`,
    count: item.count,
    pct: (item.count / max) * 100,
  }))
})
</script>

<template>
  <div class="card__container">
    <div class="card__title">Token per mass</div>
    <div class="card__content">
      <div v-for="item in sorted_data" :key="item.label" class="bar__row">
        <span class="bar__label">{{item.label}}</span>
        <div class="bar__track">
          <div class="bar__fill" :style="{ width: item.pct + '%' }"></div>
        </div>
        <span class="bar__count">{{item.count}}</span>
      </div>
    </div>
  </div>
</template>

<style lang="postcss" scoped>
.card__content {
  @apply flex flex-col;
  max-height: 40vh;
  @apply overflow-y-auto pr-2;
}
.bar__row {
  @apply flex items-center gap-3;
  @apply py-1.5;
  border-bottom: 1px solid #0a0a0a;
}
.bar__label {
  @apply text-xs;
  color: #555;
  min-width: 4rem;
}
.bar__track {
  @apply flex-grow;
  height: 4px;
  background: #111;
}
.bar__fill {
  height: 100%;
  background: #fff;
}
.bar__count {
  @apply text-xs text-white;
  min-width: 2.5rem;
  text-align: right;
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
</style>
