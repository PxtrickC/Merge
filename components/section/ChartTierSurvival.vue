<script setup>
import { TOOLTIP, DATA_ZOOM, AXIS_STYLE } from '~/composables/useChart'

const { dates, tier1OverTime, tier2OverTime, tier3OverTime, tier4OverTime } = useSupplyHistory()
const chartEl = ref(null)
const { setOption } = useChart(chartEl)
const viewMode = ref('count')

const TIER_INITIAL = { 1: 28841, 2: 94, 3: 50, 4: 5 }
const TIER_COLORS = { 1: 'rgba(255,255,255,0.8)', 2: '#FC3', 3: '#55F', 4: '#F44' }
const TIER_NAMES = { 1: 'Tier 1', 2: 'Tier 2', 3: 'Tier 3', 4: 'Tier 4' }

watch([dates, tier1OverTime, viewMode], () => {
  const d = dates.value
  const tiers = {
    1: tier1OverTime.value,
    2: tier2OverTime.value,
    3: tier3OverTime.value,
    4: tier4OverTime.value,
  }
  if (!d.length) return

  const isPercent = viewMode.value === 'percent'

  function transform(tierData, tierNum) {
    return d.map((date, i) => {
      const val = tierData[i]
      const pct = +(val / TIER_INITIAL[tierNum] * 100).toFixed(1)
      return [date, isPercent ? pct : val, isPercent ? val : pct]
    })
  }

  setOption({
    backgroundColor: 'transparent',
    tooltip: {
      ...TOOLTIP,
      trigger: 'axis',
      formatter: (params) => {
        const date = params[0]?.value[0] || ''
        const lines = params.map(p => {
          const main = p.value[1]
          const alt = p.value[2]
          const text = isPercent
            ? `${main}% (${alt?.toLocaleString()})`
            : `${main?.toLocaleString()} (${alt}%)`
          return `<span style="color:${p.color}">\u25CF</span> ${p.seriesName}: ${text}`
        })
        return `<span style="color:#555">${date}</span><br/>${lines.join('<br/>')}`
      },
    },
    legend: {
      data: [TIER_NAMES[1], TIER_NAMES[2], TIER_NAMES[3], TIER_NAMES[4]],
      selected: { [TIER_NAMES[1]]: isPercent ? true : false },
      textStyle: { color: '#fff', fontFamily: "'HND', sans-serif", fontSize: 11 },
      inactiveColor: '#555',
      top: 0,
      itemWidth: 12,
      itemHeight: 8,
    },
    grid: { left: 50, right: 16, top: 32, bottom: 44 },
    xAxis: {
      type: 'time',
      ...AXIS_STYLE,
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      ...AXIS_STYLE,
      axisLabel: {
        ...AXIS_STYLE.axisLabel,
        formatter: isPercent ? '{value}%' : undefined,
      },
    },
    dataZoom: DATA_ZOOM,
    series: [1, 2, 3, 4].map(t => ({
      name: TIER_NAMES[t],
      type: 'line',
      showSymbol: false,
      lineStyle: { color: TIER_COLORS[t], width: 1.5 },
      itemStyle: { color: TIER_COLORS[t] },
      data: transform(tiers[t], t),
    })),
  })
}, { immediate: true })
</script>

<template>
  <section class="cs">
    <div class="cs__header">
      <h2 class="cs__title">Tier Survival</h2>
      <p class="cs__toggle">
        <span v-for="(mode, i) in ['count', 'percent']" :key="mode"
          >{{ i > 0 ? ' ' : '' }}[<span
            class="cs__mode"
            :class="{ 'cs__mode--active': viewMode === mode }"
            @click="viewMode = mode"
          >{{ mode === 'percent' ? 'percentage' : mode }}</span>]</span>
      </p>
    </div>
    <div ref="chartEl" class="cs__canvas"></div>
  </section>
</template>

<style lang="postcss" scoped>
.cs {
  @apply py-8 lg:py-12 px-4 lg:px-8;
  border-top: 1px solid #1a1a1a;
}
.cs__header {
  @apply flex flex-col mb-6 gap-2;
}
.cs__title {
  @apply text-white;
  font-family: 'HND', sans-serif;
  font-size: 2em;
}
@media (min-width: 768px) {
  .cs__title { @apply text-6xl; }
}
.cs__toggle {
  @apply text-base lg:text-3xl text-white;
  font-family: 'HND', sans-serif;
}
.cs__mode {
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}
.cs__mode:hover {
  background: #fff;
  color: #000;
}
.cs__mode--active {
  text-decoration: underline;
  text-underline-offset: 3px;
}
.cs__canvas {
  width: 100%;
  height: 320px;
}
@media (min-width: 768px) {
  .cs__canvas { height: 380px; }
}
</style>
