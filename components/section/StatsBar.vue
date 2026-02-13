<script setup>
const stats = await useAPI("/stats")
const matter = await useAPI("/matter")
const omnibus = await useAPI("/omnibus")

const merged_count = computed(() => stats.value?.merged_count ?? 0)
const total_matter_tokens = 1395
const omnibus_count = computed(() => omnibus.value?.count ?? 0)

const matter_distribution = computed(() => {
  if (!matter.value?.masses) return []
  const total =
    matter.value.masses.positive + matter.value.masses.unidentified + Math.abs(matter.value.masses.negative)
  if (total === 0) return []
  return [
    { label: 'positive', pct: (matter.value.masses.positive / total) * 100, color: '#fff' },
    { label: 'unidentified', pct: (matter.value.masses.unidentified / total) * 100, color: '#666' },
    { label: 'negative', pct: (Math.abs(matter.value.masses.negative) / total) * 100, color: '#333' },
  ]
})
</script>

<template>
  <section class="stats-bar">
    <div class="stats-bar__item">
      <span class="stats-bar__value">{{ merged_count.toLocaleString() }}</span>
      <span class="stats-bar__label">merged</span>
    </div>
    <div class="stats-bar__sep"></div>
    <div class="stats-bar__item">
      <span class="stats-bar__value">{{ total_matter_tokens.toLocaleString() }}</span>
      <span class="stats-bar__label">matter*</span>
    </div>
    <div class="stats-bar__sep"></div>
    <div class="stats-bar__item">
      <span class="stats-bar__value">{{ omnibus_count.toLocaleString() }}</span>
      <span class="stats-bar__label">in NG omnibus</span>
    </div>
    <div class="stats-bar__sep hidden md:block"></div>
    <div class="stats-bar__item stats-bar__matter">
      <span class="stats-bar__label mb-2">matter mass</span>
      <div class="stats-bar__bar">
        <div
          v-for="seg in matter_distribution"
          :key="seg.label"
          class="stats-bar__bar-seg"
          :style="{ width: seg.pct + '%', backgroundColor: seg.color }"
          :title="seg.label"
        ></div>
      </div>
      <div class="stats-bar__bar-legend">
        <span v-for="seg in matter_distribution" :key="seg.label">
          <span class="inline-block w-2 h-2 rounded-full mr-1" :style="{ backgroundColor: seg.color }"></span>
          <span>{{ seg.label }}</span>
        </span>
      </div>
    </div>
  </section>
</template>

<style lang="postcss" scoped>
.stats-bar {
  @apply grid grid-cols-2 md:flex md:items-center md:justify-around;
  @apply py-8 md:py-12 px-4 md:px-8;
  border-top: 1px solid #1a1a1a;
  border-bottom: 1px solid #1a1a1a;
}
.stats-bar__item {
  @apply flex flex-col items-center;
  @apply py-4 md:py-0;
}
.stats-bar__matter {
  @apply col-span-2;
}
.stats-bar__sep {
  @apply hidden md:block;
  @apply w-px h-12;
  background: #1a1a1a;
}
.stats-bar__value {
  @apply text-3xl md:text-5xl lg:text-6xl font-medium text-white;
}
.stats-bar__label {
  @apply text-xs uppercase tracking-[0.2em] mt-1;
  color: #555;
}
.stats-bar__bar {
  @apply flex w-48 md:w-64 h-2 rounded-full overflow-hidden;
  background: #111;
}
.stats-bar__bar-seg {
  @apply h-full;
}
.stats-bar__bar-legend {
  @apply flex gap-4 mt-2;
  @apply text-2xs;
  color: #555;
}
</style>
