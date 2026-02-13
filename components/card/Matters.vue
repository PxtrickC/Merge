<script setup>
const matter = await useAPI("/matter")

const total_matter_tokens = 1395

const distribution = computed(() => {
  if (!matter.value?.masses) return []
  const total =
    matter.value.masses.positive + matter.value.masses.unidentified + Math.abs(matter.value.masses.negative)
  if (total === 0) return []
  return [
    { label: 'positive', value: Math.round(matter.value.masses.positive), pct: (matter.value.masses.positive / total) * 100, color: '#fff' },
    { label: 'unidentified', value: Math.round(matter.value.masses.unidentified), pct: (matter.value.masses.unidentified / total) * 100, color: '#666' },
    { label: 'negative', value: Math.round(matter.value.masses.negative), pct: (Math.abs(matter.value.masses.negative) / total) * 100, color: '#333' },
  ]
})
</script>

<template>
  <div class="card__container">
    <div class="card__title">Matter*</div>
    <div class="card__content">
      <div class="stat__row">
        <span class="card__content__label">total Matter* tokens</span>
        <span class="card__content__value">{{total_matter_tokens}}</span>
      </div>
      <div class="stat__row">
        <span class="card__content__label">unidentified Matter</span>
        <span class="card__content__value">{{matter?.unidentified_count}}</span>
      </div>
      <div class="stat__row">
        <span class="card__content__label">Antimatter</span>
        <span class="card__content__value">{{matter?.antimatter_count}}</span>
      </div>

      <div class="mt-6">
        <div class="card__content__label mb-3">mass distribution</div>
        <div v-for="item in distribution" :key="item.label" class="bar__row">
          <span class="bar__label">{{item.label}}</span>
          <div class="bar__track">
            <div class="bar__fill" :style="{ width: item.pct + '%', backgroundColor: item.color }"></div>
          </div>
          <span class="bar__value">{{item.value}}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="postcss" scoped>
.card__content {
  @apply flex flex-col;
}
.stat__row {
  @apply flex justify-between items-center;
  @apply py-3;
  border-bottom: 1px solid #1a1a1a;
}
.bar__row {
  @apply flex items-center gap-3;
  @apply py-2;
}
.bar__label {
  @apply text-xs;
  color: #555;
  min-width: 5rem;
}
.bar__track {
  @apply flex-grow;
  height: 6px;
  background: #111;
}
.bar__fill {
  height: 100%;
}
.bar__value {
  @apply text-sm text-white;
  min-width: 3rem;
  text-align: right;
}
</style>
