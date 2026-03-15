<script setup>
const { aliveTokens, stats } = useDB()

const TIER_COLORS = { 1: '#e5e5e5', 2: '#FC3', 3: '#55F', 4: '#F44' }
const TIER_BG = {
  1: 'rgba(255,255,255,0.10)',
  2: 'rgba(255,204,51,0.15)',
  3: 'rgba(85,85,255,0.15)',
  4: 'rgba(255,68,68,0.15)',
}

const viewMode = ref('rank')
const hovered = ref(null)
const totalMass = computed(() => stats.value?.total_mass || 0)

const items = computed(() => {
  const alive = aliveTokens.value
  if (!alive.length || !totalMass.value) return []
  const total = totalMass.value
  const sorted = [...alive].sort((a, b) => b.mass - a.mass)

  if (viewMode.value === 'rank') {
    const groups = [
      { label: 'Top 10', from: 0, to: 10 },
      { label: 'Top 11–50', from: 10, to: 50 },
      { label: 'Top 51–100', from: 50, to: 100 },
      { label: 'Top 101–500', from: 100, to: 500 },
      { label: 'Top 501–2k', from: 500, to: 2000 },
      { label: '2k+', from: 2000, to: sorted.length },
    ]
    return groups
      .map(g => {
        const slice = sorted.slice(g.from, Math.min(g.to, sorted.length))
        const mass = slice.reduce((s, t) => s + t.mass, 0)
        return {
          label: g.label,
          detail: `${slice.length.toLocaleString()} tokens`,
          mass,
          value: mass,
          pct: +(mass / total * 100).toFixed(1),
          color: 'rgba(255,255,255,0.5)',
          bg: 'rgba(255,255,255,0.06)',
        }
      })
      .filter(d => d.mass > 0)
  }

  const td = {}
  for (const t of alive) {
    if (!td[t.tier]) td[t.tier] = { mass: 0, count: 0 }
    td[t.tier].mass += t.mass
    td[t.tier].count++
  }
  return Object.keys(td)
    .map(Number)
    .filter(t => td[t].mass > 0)
    .sort((a, b) => td[b].mass - td[a].mass)
    .map(t => ({
      label: `Tier ${t}`,
      detail: `${td[t].count.toLocaleString()} tokens`,
      mass: td[t].mass,
      value: td[t].mass,
      pct: +(td[t].mass / total * 100).toFixed(1),
      color: TIER_COLORS[t],
      bg: TIER_BG[t],
    }))
})

// Squarified treemap layout
const TH = 45

function worstRatio(row, rowVal, side, remVal, area) {
  if (rowVal <= 0 || side <= 0 || remVal <= 0) return Infinity
  const rArea = (rowVal / remVal) * area
  const rSide = rArea / side
  let w = 0
  for (const d of row) {
    const iArea = (d.value / remVal) * area
    const iSide = iArea / rSide
    w = Math.max(w, Math.max(rSide / iSide, iSide / rSide))
  }
  return w
}

function squarify(data, x, y, w, h) {
  if (!data.length) return []
  if (data.length === 1) return [{ ...data[0], x, y, w, h }]
  const sorted = [...data].sort((a, b) => b.value - a.value)
  const res = []
  let rem = sorted, cx = x, cy = y, cw = w, ch = h
  let rv = sorted.reduce((s, d) => s + d.value, 0)

  while (rem.length) {
    if (rem.length === 1) { res.push({ ...rem[0], x: cx, y: cy, w: cw, h: ch }); break }
    const side = Math.min(cw, ch)
    let row = [rem[0]], rowVal = rem[0].value
    for (let i = 1; i < rem.length; i++) {
      const nr = [...row, rem[i]], nv = rowVal + rem[i].value
      if (worstRatio(nr, nv, side, rv, cw * ch) <= worstRatio(row, rowVal, side, rv, cw * ch)) {
        row = nr; rowVal = nv
      } else break
    }
    const frac = rowVal / rv
    const isH = cw >= ch
    const rLen = isH ? cw * frac : ch * frac
    let pos = isH ? cy : cx
    for (const item of row) {
      const iLen = (isH ? ch : cw) * (item.value / rowVal)
      if (isH) { res.push({ ...item, x: cx, y: pos, w: rLen, h: iLen }); pos += iLen }
      else { res.push({ ...item, x: pos, y: cy, w: iLen, h: rLen }); pos += iLen }
    }
    if (isH) { cx += rLen; cw -= rLen } else { cy += rLen; ch -= rLen }
    rem = rem.slice(row.length); rv -= rowVal
  }
  return res
}

const rects = computed(() => squarify(items.value, 0, 0, 100, TH))

function cellStyle(r) {
  return {
    left: r.x + '%',
    top: (r.y / TH * 100) + '%',
    width: r.w + '%',
    height: (r.h / TH * 100) + '%',
  }
}

function showMass(r) {
  return r.w > 14 && (r.h / TH * 100) > 25
}
</script>

<template>
  <section class="cs">
    <div class="cs__header">
      <h2 class="cs__title">Mass Concentration</h2>
      <p v-if="totalMass" class="cs__stat">{{ totalMass.toLocaleString() }} total mass</p>
      <p class="cs__toggle">
        <span v-for="(mode, i) in ['rank', 'tier']" :key="mode"
          >{{ i > 0 ? ' ' : '' }}[<span
            class="cs__mode"
            :class="{ 'cs__mode--active': viewMode === mode }"
            @click="viewMode = mode"
          >{{ mode }}</span>]</span>
      </p>
    </div>

    <div class="cs__map">
      <div
        v-for="(r, i) in rects"
        :key="r.label"
        class="cs__cell"
        :class="{ 'cs__cell--hover': hovered === i }"
        :style="cellStyle(r)"
        @mouseenter="hovered = i"
        @mouseleave="hovered = null"
      >
        <div class="cs__inner" :style="{ backgroundColor: r.bg, borderColor: r.color }">
          <span class="cs__clabel" :style="{ color: r.color }">{{ r.label }}</span>
          <span class="cs__cpct" :style="{ color: r.color }">{{ r.pct }}%</span>
          <span v-if="showMass(r)" class="cs__cmass">{{ r.mass.toLocaleString() }}</span>
        </div>
      </div>
    </div>

    <div class="cs__info" v-if="hovered != null && rects[hovered]">
      <span class="cs__info-label">{{ rects[hovered].label }}</span>
      <span class="cs__info-sep">&middot;</span>
      <span class="cs__info-detail">{{ rects[hovered].detail }}</span>
      <span class="cs__info-sep">&middot;</span>
      <span class="cs__info-mass">{{ rects[hovered].mass.toLocaleString() }} mass ({{ rects[hovered].pct }}%)</span>
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
.cs__stat {
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

.cs__map {
  position: relative;
  width: 100%;
  padding-bottom: 80%;
}
@media (min-width: 768px) {
  .cs__map { padding-bottom: 45%; }
}

.cs__cell {
  position: absolute;
  padding: 1.5px;
  cursor: default;
}

.cs__inner {
  width: 100%;
  height: 100%;
  border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.06);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 2px;
  overflow: hidden;
  transition: background-color 0.3s ease, border-color 0.3s ease;
}

.cs__cell--hover .cs__inner {
  border-color: rgba(255,255,255,0.25);
}

.cs__clabel {
  font-family: 'HND', sans-serif;
  font-size: 0.75rem;
  letter-spacing: -0.01em;
  white-space: nowrap;
}
@media (min-width: 768px) {
  .cs__clabel { font-size: 0.95rem; }
}

.cs__cpct {
  font-family: 'HND', sans-serif;
  font-size: 1.1rem;
  letter-spacing: -0.02em;
  opacity: 0.9;
}
@media (min-width: 768px) {
  .cs__cpct { font-size: 1.6rem; }
}

.cs__cmass {
  font-family: 'HND', sans-serif;
  font-size: 0.65rem;
  color: #555;
  white-space: nowrap;
}
@media (min-width: 768px) {
  .cs__cmass { font-size: 0.75rem; }
}

.cs__info {
  @apply mt-4;
  font-family: 'HND', sans-serif;
  font-size: 0.85rem;
  color: rgba(255,255,255,0.5);
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}
@media (min-width: 768px) {
  .cs__info { font-size: 1rem; }
}
.cs__info-label {
  color: #fff;
}
.cs__info-sep {
  color: #333;
}
.cs__info-mass {
  color: rgba(255,255,255,0.35);
}
</style>
