<script setup>
import { TOOLTIP, AXIS_STYLE, MASS_BLACK_AREA, MASS_BLACK_LINES } from '~/composables/useChart'

const { dates, aliveOverTime, mergeCountOverTime } = useSupplyHistory()
const chartEl = ref(null)
const { setOption } = useChart(chartEl)

const ORIGINAL_SUPPLY = 28990
const RANGES_ROW1 = [
  { label: '2W', days: 14 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
]
const RANGES_ROW2 = [
  { label: 'All', days: null },
  { label: 'mass.black', startDate: '2022-03-31', endDate: '2022-05-01' },
]
const RANGES = [...RANGES_ROW1, ...RANGES_ROW2]
const rangeMode = ref('3M')

const currentAliveCount = computed(() => {
  const a = aliveOverTime.value
  return a.length ? a[a.length - 1] : 0
})
const deflationPct = computed(() => {
  const a = aliveOverTime.value
  if (!a.length) return 0
  return ((1 - a[a.length - 1] / ORIGINAL_SUPPLY) * 100).toFixed(1)
})
const mergedCount = computed(() => {
  const a = aliveOverTime.value
  return a.length ? ORIGINAL_SUPPLY - a[a.length - 1] : 0
})

watch([dates, aliveOverTime, rangeMode], () => {
  const d = dates.value
  const alive = aliveOverTime.value
  const merges = mergeCountOverTime.value
  if (!d.length) return

  // Slice data to selected range
  const range = RANGES.find(r => r.label === rangeMode.value)
  const days = range?.days
  let sliceStart = 0
  let sliceEnd = d.length
  if (range?.startDate) {
    sliceStart = Math.max(0, d.findIndex(dd => dd >= range.startDate))
    const ei = d.findIndex(dd => dd > range.endDate)
    sliceEnd = ei === -1 ? d.length : ei
  } else if (days) {
    sliceStart = Math.max(0, d.length - days)
  }
  const dSliced = d.slice(sliceStart, sliceEnd)
  const aliveSliced = alive.slice(sliceStart, sliceEnd)
  const mergesSliced = merges.slice(sliceStart, sliceEnd)

  // Future projection: average daily merge rate over last 90 days (always from full data)
  const last90 = merges.slice(-90)
  const avgRate = last90.length ? last90.reduce((s, v) => s + v, 0) / last90.length : 0
  const currentAlive = alive[alive.length - 1] || 0
  const lastDate = new Date(d[d.length - 1] + 'T00:00:00Z')

  const projDates = []
  const projValues = []
  let projected = currentAlive

  if (avgRate > 0 && currentAlive > 1 && rangeMode.value === 'All') {
    for (let i = 1; i <= 500; i++) {
      const pd = new Date(lastDate)
      pd.setUTCDate(pd.getUTCDate() + i)
      projDates.push(pd.toISOString().slice(0, 10))
      projected = Math.max(1, Math.round(currentAlive - avgRate * i))
      projValues.push(projected)
    }
  }

  setOption({
    animation: false,
    animationDuration: 0,
    animationDurationUpdate: 0,
    backgroundColor: 'transparent',
    tooltip: {
      ...TOOLTIP,
      trigger: 'axis',
      formatter: (params) => {
        const date = params[0]?.value[0]
        const header = date ? `<div style="color:#888;margin-bottom:4px">${date}</div>` : ''
        const lines = params.map(p => {
          const val = p.value[1]
          if (p.seriesName === 'Merges') {
            return `<span style="color:${p.color}">\u25CF</span> ${p.seriesName}: ${val?.toLocaleString()}`
          }
          const pct = (-(1 - val / ORIGINAL_SUPPLY) * 100).toFixed(1)
          return `<span style="color:${p.color}">\u25CF</span> ${p.seriesName}: ${val?.toLocaleString()} (${pct}%)`
        }).join('<br/>')
        return header + lines
      },
    },
    grid: { left: 50, right: 40, top: 16, bottom: 16 },
    xAxis: {
      type: 'time',
      ...AXIS_STYLE,
      splitLine: { show: false },
    },
    yAxis: [
      {
        type: 'value',
        ...AXIS_STYLE,
        scale: true,
        axisLabel: {
          ...AXIS_STYLE.axisLabel,
          formatter: (v) => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v,
        },
      },
      {
        type: 'value',
        ...AXIS_STYLE,
        splitLine: { show: false },
        axisLabel: { ...AXIS_STYLE.axisLabel },
      },
    ],
    series: [
      {
        name: 'Alive',
        type: 'line',
        showSymbol: false,
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
        markArea: MASS_BLACK_AREA,
        markLine: { silent: true, symbol: 'none', data: [...MASS_BLACK_LINES, {
          xAxis: '2026-01-23',
          label: { formatter: 'NG shutdown', color: '#888', fontFamily: "'HND', sans-serif", fontSize: 10, position: 'end' },
          lineStyle: { color: '#333', type: 'dashed', width: 1 },
        }] },
        data: dSliced.map((date, i) => [date, aliveSliced[i]]),
      },
      {
        name: 'Merges',
        type: 'bar',
        yAxisIndex: 1,
        barMaxWidth: 6,
        itemStyle: { color: 'rgba(255,255,255,0.2)' },
        emphasis: { itemStyle: { color: 'rgba(255,255,255,0.4)' } },
        data: dSliced.map((date, i) => [date, mergesSliced[i]]),
      },
      {
        name: 'Projected',
        type: 'line',
        showSymbol: false,
        lineStyle: { color: '#444', width: 1.5, type: 'dashed' },
        data: projDates.map((date, i) => [date, projValues[i]]),
      },
    ],
  }, { notMerge: true })
}, { immediate: true })
</script>

<template>
  <section class="cs">
    <h2 class="cs__title">Supply Deflation</h2>
    <ClientOnly>
      <div class="cs__header">
        <p v-if="currentAliveCount" class="cs__stat">
          {{ currentAliveCount.toLocaleString() }}/{{ ORIGINAL_SUPPLY.toLocaleString() }} remaining <span class="cs__pct">(-{{ deflationPct }}%)</span>
        </p>
        <p class="cs__toggle">
          <span v-for="(r, i) in RANGES_ROW1" :key="r.label"
            >{{ i > 0 ? ' ' : '' }}[<span
              class="cs__mode"
              :class="{ 'cs__mode--active': rangeMode === r.label }"
              @click="rangeMode = r.label"
            >{{ r.label }}</span>]</span>
          <br/>
          <span v-for="(r, i) in RANGES_ROW2" :key="r.label"
            >{{ i > 0 ? ' ' : '' }}[<span
              class="cs__mode"
              :class="{ 'cs__mode--active': rangeMode === r.label }"
              @click="rangeMode = r.label"
            >{{ r.label }}</span>]</span>
        </p>
      </div>
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
.cs__header {
  @apply flex flex-col mb-6 gap-2;
}
.cs__stat {
  @apply text-white text-base lg:text-3xl;
  font-family: 'HND', sans-serif;
}
.cs__pct {
  color: #888;
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
  height: 360px;
}
@media (min-width: 768px) {
  .cs__canvas { height: 420px; }
}
</style>
