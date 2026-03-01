<script setup>
const { aliveTokens, stats } = useDB()

const TIER_COLORS = { 1: 'rgba(255,255,255,0.8)', 2: '#FC3', 3: '#55F', 4: '#F44' }

const viewMode = ref('rank')

const totalMass = computed(() => {
  const s = stats.value
  return s ? s.total_mass : 0
})

const segments = computed(() => {
  const alive = aliveTokens.value
  const s = stats.value
  if (!alive.length || !s) return []

  const total = s.total_mass

  if (viewMode.value === 'rank') {
    const sorted = [...alive].sort((a, b) => b.mass - a.mass)
    const top10 = sorted.slice(0, 10).reduce((s, t) => s + t.mass, 0)
    const top50 = sorted.slice(10, 50).reduce((s, t) => s + t.mass, 0)
    const top100 = sorted.slice(50, 100).reduce((s, t) => s + t.mass, 0)
    const rest = total - top10 - top50 - top100
    return [
      { label: 'Top 10', mass: top10, pct: +(top10 / total * 100).toFixed(1), color: 'rgba(255,255,255,0.85)' },
      { label: 'Top 11–50', mass: top50, pct: +(top50 / total * 100).toFixed(1), color: 'rgba(255,255,255,0.4)' },
      { label: 'Top 51–100', mass: top100, pct: +(top100 / total * 100).toFixed(1), color: 'rgba(255,255,255,0.2)' },
      { label: 'Others', mass: rest, pct: +(rest / total * 100).toFixed(1), color: 'rgba(255,255,255,0.08)' },
    ]
  }

  const tierMass = { 1: 0, 2: 0, 3: 0, 4: 0 }
  for (const t of alive) {
    tierMass[t.tier] = (tierMass[t.tier] || 0) + t.mass
  }
  return [4, 3, 2, 1].map(t => ({
    label: `Tier ${t}`,
    mass: tierMass[t],
    pct: +(tierMass[t] / total * 100).toFixed(1),
    color: TIER_COLORS[t],
  }))
})

// SVG donut arc segments
const R = 90
const STROKE = 24
const CIRC = 2 * Math.PI * R
const arcs = computed(() => {
  const data = segments.value
  if (!data.length) return []
  const GAP = 4
  const totalGap = GAP * data.length
  const usable = CIRC - totalGap
  let offset = 0
  return data.map(d => {
    const len = (d.pct / 100) * usable
    const arc = { ...d, dasharray: `${len} ${CIRC - len}`, dashoffset: -offset }
    offset += len + GAP
    return arc
  })
})
</script>

<template>
  <section class="cs">
    <div class="cs__header">
      <h2 class="cs__title">Mass Concentration</h2>
      <p class="cs__toggle">
        <span v-for="(mode, i) in ['rank', 'tier']" :key="mode"
          >{{ i > 0 ? ' ' : '' }}[<span
            class="cs__mode"
            :class="{ 'cs__mode--active': viewMode === mode }"
            @click="viewMode = mode"
          >{{ mode }}</span>]</span>
      </p>
    </div>

    <div class="cs__viz">
      <svg viewBox="0 0 220 220" class="cs__donut">
        <circle
          v-for="(a, i) in arcs" :key="i"
          cx="110" cy="110" :r="R"
          fill="none"
          :stroke="a.color"
          :stroke-width="STROKE"
          :stroke-dasharray="a.dasharray"
          :stroke-dashoffset="a.dashoffset"
          stroke-linecap="butt"
          transform="rotate(-90 110 110)"
        />
        <text x="110" y="106" text-anchor="middle" dominant-baseline="middle" class="cs__center-num">
          {{ totalMass.toLocaleString() }}
        </text>
        <text x="110" y="126" text-anchor="middle" dominant-baseline="middle" class="cs__center-label">
          total mass
        </text>
      </svg>
      <div class="cs__labels">
        <div v-for="d in segments" :key="d.label" class="cs__row">
          <span class="cs__dot" :style="{ backgroundColor: d.color }" />
          <span class="cs__label">{{ d.label }}</span>
          <span class="cs__pct">{{ d.pct }}%</span>
          <span class="cs__mass">{{ d.mass.toLocaleString() }}</span>
        </div>
      </div>
    </div>
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

.cs__viz {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
}
@media (min-width: 768px) {
  .cs__viz {
    flex-direction: row;
    align-items: center;
    gap: 4rem;
  }
}
.cs__donut {
  width: 180px;
  height: 180px;
  flex-shrink: 0;
}
@media (min-width: 768px) {
  .cs__donut { width: 240px; height: 240px; }
}
.cs__donut circle {
  transition: stroke-dasharray 0.5s ease, stroke-dashoffset 0.5s ease, stroke 0.5s ease;
}
.cs__center-num {
  fill: #fff;
  font-family: 'HND', sans-serif;
  font-size: 18px;
}
.cs__center-label {
  fill: #555;
  font-family: 'HND', sans-serif;
  font-size: 10px;
}
.cs__labels {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.cs__row {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
}
.cs__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  align-self: center;
  transition: background-color 0.5s ease;
}
.cs__label {
  color: #555;
  font-family: 'HND', sans-serif;
  font-size: 0.95rem;
  min-width: 5.5rem;
}
@media (min-width: 768px) {
  .cs__label { font-size: 1.1rem; }
}
.cs__pct {
  color: #fff;
  font-family: 'HND', sans-serif;
  font-size: 1.5rem;
  letter-spacing: -0.02em;
  min-width: 4.5rem;
}
@media (min-width: 768px) {
  .cs__pct { font-size: 2rem; }
}
.cs__mass {
  color: #333;
  font-family: 'HND', sans-serif;
  font-size: 0.8rem;
}
@media (min-width: 768px) {
  .cs__mass { font-size: 0.9rem; }
}
</style>
