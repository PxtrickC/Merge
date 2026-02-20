<script setup>
import { useTimeAgo } from "@vueuse/core"
const latest_merges = await useAPI("/latest_merges")
const { alphaMass } = useDB()
const { open: openDrawer } = useTokenDrawer()

const alpha_mass = computed(() => alphaMass.value || 1)
const scrollEl = useDragScroll()

const frameSizeValue = computed(() => {
  const ratio = Math.pow(alpha_mass.value / alpha_mass.value, 1 / 3)
  return Math.max(40, ratio * 100) + 'px'
})

function formatDate(merged_on) {
  if (!merged_on) return ""
  const d = new Date(merged_on)
  const yr = d.getFullYear()
  const mon = d.toLocaleString('en-US', { month: 'short' })
  const day = d.getDate()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${yr} ${mon} ${day} ${hh}:${mm}`
}
</script>

<template>
  <section class="latest">
    <div class="latest__header">
      <span class="latest__title">Latest Merges</span>
      <div class="latest__timer">last merge {{ useTimeAgo(new Date(latest_merges?.[0]?.merged_on)) }}</div>
    </div>

    <div ref="scrollEl" class="latest__scroll">
      <div v-for="merge in latest_merges" :key="merge.id" class="latest__card">
        <div class="latest__spheres">
          <div class="latest__col">
            <div class="latest__frame opacity-50 cursor-pointer" :style="{ width: frameSizeValue, height: frameSizeValue }" @click="openDrawer(merge.id)">
              <merge-svg :tier="merge.tier" :mass="merge.mass" :alpha_mass="alpha_mass" />
            </div>
            <span class="latest__mass">m({{ merge.mass }})</span>
            <span class="latest__id">#{{ merge.id }}</span>
          </div>
          <span class="latest__arrow" style="color: #fff">&rarr;</span>
          <div class="latest__col">
            <div class="latest__frame cursor-pointer" :style="{ width: frameSizeValue, height: frameSizeValue }" @click="openDrawer(merge.merged_to.id)">
              <merge-svg :tier="merge.merged_to.tier" :mass="merge.merged_to.mass" :alpha_mass="alpha_mass" />
            </div>
            <span class="latest__mass">m({{ merge.merged_to.mass }})</span>
            <span class="latest__id">#{{ merge.merged_to.id }}</span>
          </div>
        </div>
        <span class="latest__date">{{ formatDate(merge.merged_on) }}</span>
      </div>
    </div>
  </section>
</template>

<style lang="postcss" scoped>
.latest {
  @apply py-8 md:py-12 px-4 md:px-8;
  border-top: 1px solid #1a1a1a;
}
.latest__header {
  @apply flex justify-between items-center mb-6;
}
.latest__title {
  @apply text-white;
  font-family: 'HND', sans-serif;
  font-size: 2em;
}
@media (min-width: 768px) {
  .latest__title {
    @apply text-6xl;
  }
}
.latest__timer {
  @apply text-xs;
  color: #555;
}
.latest__scroll {
  @apply flex items-end gap-4 sm:gap-6 md:gap-8;
  @apply overflow-x-auto pb-4;
  scrollbar-width: none;
}
.latest__scroll::-webkit-scrollbar {
  display: none;
}
.latest__card {
  @apply flex flex-col items-center;
  @apply flex-shrink-0;
  min-width: 100px;
  border-right: 1px solid #1a1a1a;
  @apply pr-4 sm:pr-6 md:pr-8;
}
@media (min-width: 1024px) {
  .latest__card {
    min-width: 120px;
  }
}
.latest__card:last-child {
  border-right: none;
  @apply pr-0;
}
.latest__spheres {
  @apply flex items-start gap-2;
}
.latest__col {
  @apply flex flex-col items-center;
}
.latest__frame {
  @apply flex-shrink-0;
  @apply cursor-pointer transition-opacity;
  @apply rounded-full overflow-hidden;
  border: 1px solid #333;
}
.latest__frame:hover {
  opacity: 0.7;
}
.latest__arrow {
  @apply text-base font-bold;
  color: #fff !important;
  height: v-bind(frameSizeValue);
  line-height: v-bind(frameSizeValue);
}
.latest__mass {
  @apply text-xs md:text-sm text-white mt-2;
}
.latest__id {
  @apply text-2xs md:text-xs;
  color: #555;
}
.latest__date {
  @apply text-2xs mt-2 text-white;
}
</style>
