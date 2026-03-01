<script setup>
import { TOOLTIP, DATA_ZOOM, AXIS_STYLE, MASS_BLACK_AREA } from '~/composables/useChart'

const { dates, omnibusOverTime } = useSupplyHistory()
const chartEl = ref(null)
const { setOption } = useChart(chartEl)

watch([dates, omnibusOverTime], () => {
  const d = dates.value
  const omnibus = omnibusOverTime.value
  if (!d.length) return

  setOption({
    backgroundColor: 'transparent',
    tooltip: {
      ...TOOLTIP,
      trigger: 'axis',
      formatter: (params) => {
        const p = params[0]
        return `<span style="color:#555">${p.value[0]}</span><br/>Tokens: ${p.value[1]?.toLocaleString()}`
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
        }],
      },
      markArea: MASS_BLACK_AREA,
      data: d.map((date, i) => [date, omnibus[i]]).filter(([date]) => date >= '2021-12-15'),
    }],
  })
}, { immediate: true })
</script>

<template>
  <section class="cs">
    <h2 class="cs__title">Tokens in NG Omnibus</h2>
    <div ref="chartEl" class="cs__canvas"></div>
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
.cs__canvas {
  width: 100%;
  height: 320px;
}
@media (min-width: 768px) {
  .cs__canvas { height: 380px; }
}
</style>
