<script setup>
import { TOOLTIP, DATA_ZOOM, AXIS_STYLE } from '~/composables/useChart'

const { dates, mergeCountOverTime } = useSupplyHistory()
const chartEl = ref(null)
const { setOption } = useChart(chartEl)
const granularity = ref('week')

function aggregate(dates, values, mode) {
  if (mode === 'day') {
    return { labels: dates, data: values }
  }

  const map = new Map()
  for (let i = 0; i < dates.length; i++) {
    let key
    if (mode === 'week') {
      const d = new Date(dates[i] + 'T00:00:00Z')
      const day = d.getUTCDay() || 7
      d.setUTCDate(d.getUTCDate() - day + 1)
      key = d.toISOString().slice(0, 10)
    } else {
      key = dates[i].slice(0, 7)
    }
    map.set(key, (map.get(key) || 0) + values[i])
  }
  return { labels: [...map.keys()], data: [...map.values()] }
}

watch([dates, mergeCountOverTime, granularity], () => {
  const d = dates.value
  const merges = mergeCountOverTime.value
  if (!d.length) return

  const { labels, data } = aggregate(d, merges, granularity.value)

  setOption({
    backgroundColor: 'transparent',
    tooltip: {
      ...TOOLTIP,
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(255,255,255,0.03)' } },
      formatter: (params) => {
        const p = params[0]
        return `${p.name}<br/>Merges: ${p.value.toLocaleString()}`
      },
    },
    grid: { left: 40, right: 16, top: 16, bottom: 44 },
    xAxis: {
      type: 'category',
      data: labels,
      ...AXIS_STYLE,
      splitLine: { show: false },
      axisLabel: {
        ...AXIS_STYLE.axisLabel,
        rotate: 0,
        interval: Math.max(0, Math.floor(labels.length / 12) - 1),
      },
    },
    yAxis: { type: 'value', ...AXIS_STYLE },
    dataZoom: DATA_ZOOM.map(dz => ({
      ...dz,
      ...(dz.type === 'slider' ? { start: Math.max(0, (1 - 365 / d.length) * 100), end: 100 } : {}),
    })),
    series: [{
      type: 'bar',
      data,
      itemStyle: { color: 'rgba(255,255,255,0.7)' },
      emphasis: { itemStyle: { color: '#fff' } },
      barMaxWidth: 16,
      markArea: {
        silent: true,
        data: (() => {
          const start = labels.find(l => l >= '2022-04-01')
          const end = [...labels].reverse().find(l => l <= '2022-04-30')
          if (!start || !end) return []
          return [[
            { xAxis: start, itemStyle: { color: 'rgba(255,255,255,0.08)' } },
            { xAxis: end },
          ]]
        })(),
      },
      markLine: {
        silent: true,
        symbol: 'none',
        data: (() => {
          const start = labels.find(l => l >= '2022-04-01')
          const mid = labels.find(l => l >= '2022-04-15') || start
          const end = [...labels].reverse().find(l => l <= '2022-04-30')
          if (!start || !end) return []
          return [
            { xAxis: start, label: { show: false }, lineStyle: { color: '#333', type: 'dashed', width: 1 } },
            { xAxis: mid, label: { formatter: 'mass.black', color: '#fff', fontFamily: "'HND', sans-serif", fontSize: 10, position: 'end' }, lineStyle: { color: 'transparent' } },
            { xAxis: end, label: { show: false }, lineStyle: { color: '#333', type: 'dashed', width: 1 } },
          ]
        })(),
      },
    }],
  })
}, { immediate: true })
</script>

<template>
  <section class="cs">
    <div class="cs__header">
      <h2 class="cs__title">Merge Rate</h2>
      <p class="cs__toggle">
        <span v-for="(mode, i) in ['day', 'week', 'month']" :key="mode"
          >{{ i > 0 ? ' ' : '' }}[<span
            class="cs__mode"
            :class="{ 'cs__mode--active': granularity === mode }"
            @click="granularity = mode"
          >{{ mode }}</span>]</span>
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
