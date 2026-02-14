<script setup>
const props = defineProps({
  id: Number,
  loading: { type: Boolean, default: false },
  merged: Boolean,
  merged_to: Number,
  merged_on: String,
  alpha_mass: { type: Number, default: 0 },
  transfers: { type: Array, default: () => [] },
  mergeTimeline: { type: Array, default: () => [] },
  initialMass: { type: Number, default: null },
})

const timeline = computed(() => {
  const events = []

  // Incoming merges from on-chain MassUpdate events (with calculated burned mass)
  for (const t of props.mergeTimeline) {
    events.push({
      type: 'merge_in',
      tokenId: t.tokenId,
      mass: t.mass,
      tierClass: t.tierClass,
      date: t.date,
    })
  }

  // Outgoing merge (this token was burned)
  if (props.merged && props.merged_to) {
    events.push({
      type: 'merge_out',
      tokenId: props.merged_to,
      date: props.merged_on,
    })
  }

  // Mint and transfer events (skip burn transfers — already shown as merge_out)
  const ZERO_ADDR = '0x' + '0'.repeat(40)
  for (const tx of props.transfers) {
    if (tx.isMint) {
      events.push({
        type: 'mint',
        to: tx.to,
        toName: tx.toName,
        date: tx.date,
      })
    } else if (tx.to === ZERO_ADDR) {
      // Burn transfer (to zero address) — skip, duplicate of merge_out
    } else {
      events.push({
        type: 'transfer',
        from: tx.from,
        to: tx.to,
        fromName: tx.fromName,
        toName: tx.toName,
        date: tx.date,
      })
    }
  }

  return events.sort((a, b) => new Date(b.date) - new Date(a.date))
})

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const yr = String(d.getFullYear()).slice(2)
  const mon = d.toLocaleString('en-US', { month: 'short' })
  const day = d.getDate()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${yr} ${mon} ${day} ${hh}:${mm}`
}

function tierColorClass(tierClass) {
  switch (tierClass) {
    case 4: return 'tier--red'
    case 3: return 'tier--blue'
    case 2: return 'tier--yellow'
    default: return 'tier--white'
  }
}

function shortAddr(addr) {
  if (!addr) return ''
  return addr.slice(0, 6) + '…' + addr.slice(-4)
}

const { open: openDrawer } = useTokenDrawer()
</script>

<template>
  <div class="card__container">
    <div class="section__title">Activity</div>
    <div v-if="loading" class="activity__loading">
      <Loading :fullscreen="false" />
    </div>
    <div v-else-if="timeline.length" class="activity__list">
      <div v-for="(event, i) in timeline" :key="i" class="activity__item">
        <div class="activity__left">
          <span v-if="event.type === 'merge_in'" class="activity__badge activity__badge--merge">merged in</span>
          <span v-else-if="event.type === 'merge_out'" class="activity__badge activity__badge--burn">merged into</span>
          <span v-else-if="event.type === 'mint'" class="activity__badge activity__badge--mint">minted</span>
          <span v-else-if="event.type === 'transfer'" class="activity__badge activity__badge--transfer">transfer</span>
          <span class="activity__date">{{ formatDate(event.date) }}</span>
        </div>

        <div v-if="event.type === 'merge_in'" class="activity__thumb" @click="openDrawer(event.tokenId)">
          <merge-svg :tier="event.tierClass" :mass="event.mass" :alpha_mass="alpha_mass" />
        </div>

        <span v-if="event.type === 'merge_in'" class="activity__detail cursor-pointer" @click="openDrawer(event.tokenId)">
          <span class="link" :class="tierColorClass(event.tierClass)">m({{ event.mass }})</span>
          <span class="card__content__label" :class="tierColorClass(event.tierClass)">#{{ +event.tokenId }}</span>
        </span>
        <span v-else-if="event.type === 'merge_out'" class="activity__detail">
          <span class="link cursor-pointer" @click="openDrawer(event.tokenId)">#{{ +event.tokenId }}</span>
        </span>
        <span v-else-if="event.type === 'mint'" class="activity__detail">
          <span v-if="initialMass" class="link">m({{ initialMass }})</span>
          <a class="activity__addr" :href="`https://etherscan.io/address/${event.to}`" target="_blank">{{ event.toName || shortAddr(event.to) }}</a>
        </span>
        <span v-else-if="event.type === 'transfer'" class="activity__detail">
          <a class="activity__addr" :href="`https://etherscan.io/address/${event.from}`" target="_blank">{{ event.fromName || shortAddr(event.from) }}</a>
          <span class="activity__arrow">→</span>
          <a class="activity__addr" :href="`https://etherscan.io/address/${event.to}`" target="_blank">{{ event.toName || shortAddr(event.to) }}</a>
        </span>
      </div>
    </div>
  </div>
</template>

<style lang="postcss" scoped>
.section__title {
  @apply text-2xl md:text-6xl text-white mb-4 md:mb-6;
}
.activity__loading {
  @apply flex justify-center py-12;
}
.activity__list {
  @apply mt-4 pr-2;
  @apply flex flex-col;
  max-height: 24rem;
  overflow-y: auto;
}
.activity__item {
  @apply flex items-center gap-2 sm:gap-3;
  @apply py-3;
  border-bottom: 1px solid #1a1a1a;
}
.activity__left {
  @apply flex flex-col flex-shrink-0;
  width: 5.5rem;
}
@media (min-width: 1024px) {
  .activity__left {
    width: 6.5rem;
  }
}
.activity__date {
  @apply text-xs whitespace-nowrap;
  color: #555;
}
.activity__thumb {
  @apply w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 rounded cursor-pointer overflow-hidden;
}
.activity__detail {
  @apply flex items-baseline gap-1.5 sm:gap-2 text-sm;
}
.activity__badge {
  @apply text-xs py-0.5;
  flex-shrink: 0;
}
.activity__badge--merge {
  color: #4ade80;
}
.activity__badge--burn {
  color: #f87171;
}
.activity__badge--mint {
  color: #60a5fa;
}
.activity__badge--transfer {
  color: #a78bfa;
}
.activity__arrow {
  @apply text-xs;
  color: #555;
}
.tier--red { color: #f87171; }
.tier--blue { color: #60a5fa; }
.tier--yellow { color: #facc15; }
.tier--white { color: #e5e5e5; }
.activity__addr {
  @apply text-xs;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: #777;
  transition: color 0.15s;
}
.activity__addr:hover {
  color: #fff;
}

::-webkit-scrollbar {
  @apply w-1;
}
::-webkit-scrollbar-track {
  background: #111;
}
::-webkit-scrollbar-thumb {
  background: #333;
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>
