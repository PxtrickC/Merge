<script setup>
import { TOOLTIP, DATA_ZOOM, AXIS_STYLE } from '~/composables/useChart'

const { dates, alphaMassOverTime, alphaChanges } = useSupplyHistory()
const { stats, alphaToken } = useDB()
const alpha_mass = computed(() => stats.value?.alpha_mass ?? 0)
const chartEl = ref(null)
const { setOption } = useChart(chartEl)
const rangeMode = ref('all')

const alphaLabel = computed(() => {
  if (!alpha_mass.value || !alphaToken.value) return ''
  return `m(${alpha_mass.value}) #${alphaToken.value.id}`
})

// Find the date when current alpha token became alpha
const currentAlphaStartDate = computed(() => {
  const changes = alphaChanges.value
  const id = alphaToken.value?.id
  if (!id || !changes.length) return null
  for (let i = changes.length - 1; i >= 0; i--) {
    if (changes[i].tokenId === id) return changes[i].date
  }
  return null
})

watch([dates, alphaMassOverTime, alphaChanges, rangeMode], () => {
  const d = dates.value
  const alpha = alphaMassOverTime.value
  const changes = alphaChanges.value
  if (!d.length) return

  // Filter meaningful alpha changes (skip early same-day noise)
  // Keep only the last change per date, and changes where alpha reigned > 1 day
  const significantChanges = []
  for (let i = 0; i < changes.length; i++) {
    const next = changes[i + 1]
    // Keep if it's the last change or next change is on a different date
    if (!next || next.date !== changes[i].date) {
      significantChanges.push(changes[i])
    }
  }

  // Add initial alpha #1 at the start
  const markLineData = [{
    xAxis: d[0],
    label: {
      formatter: '#1',
      color: '#fff',
      fontFamily: "'HND', sans-serif",
      fontSize: 10,
      position: 'end',
    },
    lineStyle: { color: '#333', type: 'dashed', width: 1 },
  }, ...significantChanges.map(c => ({
    xAxis: c.date,
    label: {
      formatter: `#${c.tokenId}`,
      color: '#fff',
      fontFamily: "'HND', sans-serif",
      fontSize: 10,
      position: 'end',
    },
    lineStyle: { color: '#333', type: 'dashed', width: 1 },
  }))]

  // Slice data for alpha range mode
  let chartDates = d
  let chartAlpha = alpha
  if (rangeMode.value === 'alpha' && currentAlphaStartDate.value) {
    const startIdx = Math.max(0, d.findIndex(dd => dd >= currentAlphaStartDate.value))
    chartDates = d.slice(startIdx)
    chartAlpha = alpha.slice(startIdx)
  }

  setOption({
    animation: false,
    animationDuration: 0,
    backgroundColor: 'transparent',
    tooltip: {
      ...TOOLTIP,
      trigger: 'axis',
      formatter: (params) => {
        const p = params[0]
        const date = p.value[0]
        const mass = p.value[1]
        // Find which token was alpha on this date (default: #1)
        let tokenId = 1
        for (let i = changes.length - 1; i >= 0; i--) {
          if (changes[i].date <= date) { tokenId = changes[i].tokenId; break }
        }
        return `<span style="color:#555">${date}</span><br/>Alpha Mass: ${mass?.toLocaleString()}<br/>Token: #${tokenId}`
      },
    },
    grid: { left: 55, right: 16, top: 24, bottom: 48 },
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
        formatter: (v) => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v,
      },
    },
    dataZoom: DATA_ZOOM,
    series: [{
      type: 'line',
      showSymbol: false,
      step: 'end',
      lineStyle: { color: '#fff', width: 1.5 },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(255,255,255,0.08)' },
            { offset: 1, color: 'rgba(255,255,255,0)' },
          ],
        },
      },
      markLine: {
        silent: true,
        symbol: 'none',
        data: markLineData,
      },
      data: chartDates.map((date, i) => [date, chartAlpha[i]]),
    }],
  }, { notMerge: true })
}, { immediate: true })
</script>

<template>
  <section class="cs">
    <h2 class="cs__title">Alpha Mass Growth</h2>
    <ClientOnly>
      <p v-if="alpha_mass" class="cs__toggle">
        [<span class="cs__mode" :class="{ 'cs__mode--active': rangeMode === 'all' }" @click="rangeMode = 'all'">All</span>]
        [<span class="cs__mode" :class="{ 'cs__mode--active': rangeMode === 'alpha' }" @click="rangeMode = 'alpha'">{{ alphaLabel }}</span>]
      </p>
      <div ref="chartEl" class="cs__canvas"></div>
    </ClientOnly>
  </section>
</template>

<style lang="postcss" scoped>
.cs {
  @apply py-8 lg:py-12 px-4 lg:px-8;
  border-top: 1px solid #1a1a1a;
}
.cs__title {
  @apply text-white mb-2;
  font-family: 'HND', sans-serif;
  font-size: 2em;
}
@media (min-width: 768px) {
  .cs__title { @apply text-6xl; }
}
.cs__toggle {
  @apply text-white mb-4 text-base lg:text-3xl;
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
