<script setup>
const props = defineProps({
  mass: Number,
  merged: Boolean,
  merged_to: Number,
  merged_on: String,
  sale_price: Number,
})

const life_span = computed(() => {
  let diff = Date.parse(props.merged_on) - Date.parse("2021-12-2 18:00:00 EST")
  var msec = diff
  var dd = Math.floor(msec / 1000 / 60 / 60 / 24)
  msec -= dd * 1000 * 60 * 60 * 24
  var hh = Math.floor(msec / 1000 / 60 / 60)
  msec -= hh * 1000 * 60 * 60

  return { days: dd, hours: hh }
})

function formatDate(merged_on) {
  if (!merged_on) return ""
  return new Date(merged_on).toDateString()
}
</script>

<template>
  <div v-if="merged" class="card__container">
    <div class="section__title">Merged</div>
    <div class="card__content">
      <div v-if="merged_to" class="stat__row">
        <span class="card__content__label">merged into</span>
        <span class="card__content__value">
          <NuxtLink tag="a" class="link" :to="`/${+merged_to}`">{{+merged_to}}</NuxtLink>
        </span>
      </div>
      <div v-if="sale_price" class="stat__row">
        <span class="card__content__label">sold for</span>
        <span class="card__content__value">
          {{+parseFloat(((sale_price)).toFixed(4))}} ETH
          <span v-if="mass > 1" class="card__content__label ml-2">
            {{+parseFloat(((sale_price/mass)).toFixed(4))}} per mass
          </span>
        </span>
      </div>
      <div v-if="merged_on" class="stat__row">
        <span class="card__content__label">merged on</span>
        <span class="card__content__value">{{formatDate(merged_on)}}</span>
      </div>
      <div v-if="merged_on" class="stat__row">
        <span class="card__content__label">lifespan</span>
        <span class="card__content__value">{{life_span.days}}d {{life_span.hours}}h</span>
      </div>
    </div>
  </div>
</template>

<style lang="postcss" scoped>
.section__title {
  @apply text-4xl md:text-6xl text-white mb-6;
}
.card__content {
  @apply flex flex-col;
}
.stat__row {
  @apply flex justify-between items-center;
  @apply py-3;
  border-bottom: 1px solid #1a1a1a;
}
</style>
