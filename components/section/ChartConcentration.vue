<script setup>
import { TOOLTIP } from '~/composables/useChart'

const { aliveTokens, stats } = useDB()
const chartEl = ref(null)
const tierChartEl = ref(null)
const { setOption } = useChart(chartEl)
const { setOption: setTierOption } = useChart(tierChartEl)

const TIER_COLORS = {
  1: 'rgba(255,255,255,0.8)',
  2: '#FC3',
  3: '#55F',
  4: '#F44',
}

const pieLabel = {
  color: '#666',
  fontFamily: "'HND', sans-serif",
  fontSize: 11,
  formatter: '{b}\n{d}%',
}
const pieLabelLine = { lineStyle: { color: '#333' } }
const pieEmphasis = {
  label: { color: '#ccc', fontSize: 13 },
  itemStyle: { shadowBlur: 0 },
}

watch([aliveTokens, stats], () => {
  const alive = aliveTokens.value
  const s = stats.value
  if (!alive.length || !s) return

  const sorted = [...alive].sort((a, b) => b.mass - a.mass)
  const totalMass = s.total_mass

  const top10 = sorted.slice(0, 10).reduce((s, t) => s + t.mass, 0)
  const top50 = sorted.slice(10, 50).reduce((s, t) => s + t.mass, 0)
  const top100 = sorted.slice(50, 100).reduce((s, t) => s + t.mass, 0)
  const rest = totalMass - top10 - top50 - top100

  setOption({
    backgroundColor: 'transparent',
    tooltip: {
      ...TOOLTIP,
      trigger: 'item',
      formatter: ({ name, value, percent }) =>
        `${name}<br/>Mass: ${value.toLocaleString()}<br/>${percent}%`,
    },
    series: [{
      type: 'pie',
      radius: ['42%', '68%'],
      center: ['50%', '55%'],
      avoidLabelOverlap: true,
      itemStyle: { borderColor: '#0a0a0a', borderWidth: 3 },
      label: pieLabel,
      labelLine: pieLabelLine,
      emphasis: pieEmphasis,
      data: [
        { value: top10, name: 'Top 10', itemStyle: { color: 'rgba(255,255,255,0.85)' } },
        { value: top50, name: 'Top 11-50', itemStyle: { color: 'rgba(255,255,255,0.4)' } },
        { value: top100, name: 'Top 51-100', itemStyle: { color: 'rgba(255,255,255,0.18)' } },
        { value: rest, name: 'Others', itemStyle: { color: 'rgba(255,255,255,0.12)' } },
      ],
    }],
  })

  // Tier mass distribution
  const tierMass = { 1: 0, 2: 0, 3: 0, 4: 0 }
  for (const t of alive) {
    tierMass[t.tier] = (tierMass[t.tier] || 0) + t.mass
  }

  setTierOption({
    backgroundColor: 'transparent',
    tooltip: {
      ...TOOLTIP,
      trigger: 'item',
      formatter: ({ name, value, percent }) =>
        `${name}<br/>Mass: ${value.toLocaleString()}<br/>${percent}%`,
    },
    series: [{
      type: 'pie',
      radius: ['42%', '68%'],
      center: ['50%', '55%'],
      avoidLabelOverlap: true,
      itemStyle: { borderColor: '#0a0a0a', borderWidth: 3 },
      label: pieLabel,
      labelLine: pieLabelLine,
      emphasis: pieEmphasis,
      data: [
        { value: tierMass[1], name: 'Tier 1', itemStyle: { color: TIER_COLORS[1] } },
        { value: tierMass[2], name: 'Tier 2', itemStyle: { color: TIER_COLORS[2] } },
        { value: tierMass[3], name: 'Tier 3', itemStyle: { color: TIER_COLORS[3] } },
        { value: tierMass[4], name: 'Tier 4', itemStyle: { color: TIER_COLORS[4] } },
      ],
    }],
  })
}, { immediate: true })
</script>

<template>
  <section class="cs">
    <h2 class="cs__title">Mass Concentration</h2>
    <div class="cs__grid">
      <div ref="chartEl" class="cs__canvas"></div>
      <div ref="tierChartEl" class="cs__canvas"></div>
    </div>
  </section>
</template>

<style lang="postcss" scoped>
.cs {
  @apply py-8 lg:py-12 px-4 lg:px-8;
  border-top: 1px solid #1a1a1a;
}
.cs__title {
  @apply text-white mb-6;
  font-family: 'HND', sans-serif;
  font-size: 2em;
}
@media (min-width: 768px) {
  .cs__title { @apply text-6xl; }
}
.cs__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0;
}
@media (min-width: 768px) {
  .cs__grid {
    grid-template-columns: 1fr 1fr;
  }
}
.cs__canvas {
  width: 100%;
  height: 340px;
}
@media (min-width: 768px) {
  .cs__canvas { height: 400px; }
}
</style>
