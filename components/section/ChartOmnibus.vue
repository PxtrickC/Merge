<script setup>
import { TOOLTIP, DATA_ZOOM, AXIS_STYLE, MASS_BLACK_AREA, MASS_BLACK_LINES } from '~/composables/useChart'

const { dates, omnibusOverTime, omnibusMassOverTime } = useSupplyHistory()
const { stats } = useDB()
const chartEl = ref(null)
const { setOption } = useChart(chartEl)
const viewMode = ref('count')
const TOTAL_MINTED = 28990

watch([dates, omnibusOverTime, omnibusMassOverTime, viewMode, stats], () => {
  const d = dates.value
  const omnibus = omnibusOverTime.value
  const mass = omnibusMassOverTime.value
  if (!d.length) return

  const totalMass = stats.value?.total_mass ?? 0
  const isMass = viewMode.value === 'mass'
  const values = isMass ? mass : omnibus

  const filtered = d.map((date, i) => ({ date, val: values[i], mass: mass[i] })).filter(r => r.date >= '2021-12-14')

  setOption({
    animation: false,
    backgroundColor: 'transparent',
    tooltip: {
      ...TOOLTIP,
      trigger: 'axis',
      formatter: (params) => {
        const date = params[0]?.value[0]
        const lines = params.map(p => {
          const val = p.value[1]
          let text = `<span style="color:${p.color}">\u25CF</span> ${p.seriesName}: ${val?.toLocaleString()}`
          if (isMass && totalMass > 0) {
            text += ` (${((val / totalMass) * 100).toFixed(1)}%)`
          }
          return text
        })
        return `<span style="color:#555">${date}</span><br/>${lines.join('<br/>')}`
      },
    },
    grid: { left: 55, right: 16, top: 24, bottom: 44 },
    xAxis: {
      type: 'time',
      ...AXIS_STYLE,
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      ...AXIS_STYLE,
      max: isMass ? totalMass : TOTAL_MINTED,
      axisLabel: {
        ...AXIS_STYLE.axisLabel,
        formatter: (v) => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v,
      },
    },
    dataZoom: DATA_ZOOM,
    series: [
      {
        name: isMass ? 'Omnibus Mass' : 'Tokens',
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
          data: [{
            xAxis: '2026-01-24',
            label: {
              formatter: 'NG shutdown',
              color: '#888',
              fontFamily: "'HND', sans-serif",
              fontSize: 10,
              position: 'end',
            },
            lineStyle: { color: '#333', type: 'dashed', width: 1 },
          }, ...MASS_BLACK_LINES],
        },
        markArea: MASS_BLACK_AREA,
        data: filtered.map(r => [r.date, r.val]),
      },
      ...(isMass ? [{
        name: 'Total Mass',
        type: 'line',
        showSymbol: false,
        tooltip: { show: false },
        lineStyle: { color: '#333', width: 1, type: 'dashed' },
        data: [[filtered[0].date, totalMass], [filtered[filtered.length - 1].date, totalMass]],
      }] : []),
    ],
  }, { notMerge: true })
}, { immediate: true })
</script>

<template>
  <section class="cs">
    <div class="cs__header">
      <h2 class="cs__title">NG Omnibus</h2>
      <p class="cs__toggle">
        <span v-for="(mode, i) in [['count', 'count'], ['mass', 'Total mass']]" :key="mode[0]"
          >{{ i > 0 ? ' ' : '' }}[<span
            class="cs__mode"
            :class="{ 'cs__mode--active': viewMode === mode[0] }"
            @click="viewMode = mode[0]"
          >{{ mode[1] }}</span>]</span>
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
