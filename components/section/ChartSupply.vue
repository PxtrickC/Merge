<script setup>
import { TOOLTIP, DATA_ZOOM, AXIS_STYLE, MASS_BLACK_AREA } from '~/composables/useChart'

const { dates, aliveOverTime, mergeCountOverTime } = useSupplyHistory()
const chartEl = ref(null)
const { setOption } = useChart(chartEl)

const ORIGINAL_SUPPLY = 28990

const currentAliveCount = computed(() => {
  const a = aliveOverTime.value
  return a.length ? a[a.length - 1] : 0
})
const deflationPct = computed(() => {
  const a = aliveOverTime.value
  if (!a.length) return 0
  return ((1 - a[a.length - 1] / ORIGINAL_SUPPLY) * 100).toFixed(1)
})

watch([dates, aliveOverTime], () => {
  const d = dates.value
  const alive = aliveOverTime.value
  const merges = mergeCountOverTime.value
  if (!d.length) return

  // Future projection: average daily merge rate over last 90 days
  const last90 = merges.slice(-90)
  const avgRate = last90.reduce((s, v) => s + v, 0) / last90.length
  const currentAlive = alive[alive.length - 1]
  const lastDate = new Date(d[d.length - 1] + 'T00:00:00Z')

  const projDates = []
  const projValues = []
  let projected = currentAlive
  for (let i = 1; i <= 365 * 3 && projected > 1; i++) {
    const pd = new Date(lastDate)
    pd.setUTCDate(pd.getUTCDate() + i)
    projDates.push(pd.toISOString().slice(0, 10))
    projected = Math.max(1, Math.round(currentAlive - avgRate * i))
    projValues.push(projected)
  }

  setOption({
    backgroundColor: 'transparent',
    tooltip: {
      ...TOOLTIP,
      trigger: 'axis',
      formatter: (params) => {
        return params.map(p => {
          const val = p.value[1]
          const pct = (-(1 - val / ORIGINAL_SUPPLY) * 100).toFixed(1)
          return `<span style="color:${p.color}">\u25CF</span> ${p.seriesName}: ${val?.toLocaleString()} (${pct}%)`
        }).join('<br/>')
      },
    },
    grid: { left: 50, right: 16, top: 16, bottom: 44 },
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
        data: d.map((date, i) => [date, alive[i]]),
      },
      {
        name: 'Projected',
        type: 'line',
        showSymbol: false,
        lineStyle: { color: '#444', width: 1.5, type: 'dashed' },
        data: projDates.map((date, i) => [date, projValues[i]]),
      },
    ],
  })
}, { immediate: true })
</script>

<template>
  <section class="cs">
    <h2 class="cs__title">Supply Deflation</h2>
    <p v-if="currentAliveCount" class="cs__stat">
      {{ currentAliveCount.toLocaleString() }} remaining <span class="cs__pct">(-{{ deflationPct }}%)</span>
    </p>
    <div ref="chartEl" class="cs__canvas"></div>
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
.cs__stat {
  @apply text-white mb-4 text-base lg:text-3xl;
  font-family: 'HND', sans-serif;
}
.cs__pct {
  color: #888;
}
.cs__canvas {
  width: 100%;
  height: 360px;
}
@media (min-width: 768px) {
  .cs__canvas { height: 420px; }
}
</style>
