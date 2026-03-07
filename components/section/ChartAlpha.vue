<script setup>
import { TOOLTIP, DATA_ZOOM, AXIS_STYLE } from '~/composables/useChart'

const { dates, alphaMassOverTime, alphaChanges, alphaTokenHistory } = useSupplyHistory()
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

watch([dates, alphaMassOverTime, alphaChanges, alphaTokenHistory, rangeMode], () => {
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

  // Build chart data and markLines based on range mode
  let chartData
  let markLineData
  let mergesByDate = null // for tooltip in alpha mode
  const history = alphaTokenHistory.value

  if (rangeMode.value === 'alpha' && history) {
    // Expand sparse merge events into continuous daily data
    // Each event is [date, massAfterMerge]; carry forward between events
    const events = history.events
    if (events.length) {
      chartData = []
      // Build per-date merge list for tooltip: [burnedMass, newMass, burnedId]
      mergesByDate = new Map()
      let prev = events[0][1] // mint mass as baseline
      for (const e of events) {
        if (!mergesByDate.has(e[0])) mergesByDate.set(e[0], [])
        const gained = e[1] - prev
        mergesByDate.get(e[0]).push({ newMass: e[1], burnedId: e[2], gained })
        prev = e[1]
      }
      let ei = 0
      // First event mass = mint mass (initial state before further merges)
      let mass = events[0][1]
      const start = new Date(events[0][0] + 'T00:00:00Z')
      const today = new Date()
      today.setUTCHours(0, 0, 0, 0)
      for (let cur = new Date(start); cur <= today; cur.setUTCDate(cur.getUTCDate() + 1)) {
        const ds = cur.toISOString().slice(0, 10)
        // Push start-of-day mass first (preserves initial m(4) etc.)
        chartData.push([ds, mass])
        // Then apply all merge events on this date
        while (ei < events.length && events[ei][0] <= ds) {
          mass = events[ei][1]
          ei++
        }
        // If mass changed during this day, push end-of-day value too
        if (mass !== chartData[chartData.length - 1][1]) {
          chartData.push([ds, mass])
        }
      }
    } else {
      chartData = []
    }
    // Mark when token became alpha
    markLineData = currentAlphaStartDate.value ? [{
      xAxis: currentAlphaStartDate.value,
      label: {
        formatter: 'became alpha',
        color: '#fff',
        fontFamily: "'HND', sans-serif",
        fontSize: 10,
        position: 'end',
      },
      lineStyle: { color: '#333', type: 'dashed', width: 1 },
    }] : []
  } else {
    // All mode: global alpha mass daily
    chartData = d.map((date, i) => [date, alpha[i]])
    markLineData = [{
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
        if (rangeMode.value === 'alpha') {
          const dayMerges = mergesByDate?.get(date)
          const tokenId = history.tokenId
          if (dayMerges && dayMerges.length) {
            const first = dayMerges[0]
            const last = dayMerges[dayMerges.length - 1]
            let html = `<span style="color:#555">${date}</span>`
            html += `<br/>${dayMerges.length} merge${dayMerges.length > 1 ? 's' : ''}`
            html += `<br/>Mass: ${(first.newMass - first.gained).toLocaleString()}→${last.newMass.toLocaleString()}`
            html += '<br/>'
            for (const m of dayMerges) {
              const before = m.newMass - m.gained
              html += `<br/>m(${m.gained.toLocaleString()})#${m.burnedId} → m(${m.newMass.toLocaleString()})#${tokenId} ↑${m.gained.toLocaleString()}`
            }
            return html
          }
          return `<span style="color:#555">${date}</span><br/>Mass: ${mass?.toLocaleString()}`
        }
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
      type: rangeMode.value === 'alpha' ? 'log' : 'value',
      ...AXIS_STYLE,
      ...(rangeMode.value !== 'alpha' ? { min: Math.max(0, Math.min(...chartData.map(d => d[1])) - 100) } : {}),
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
      data: chartData,
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
