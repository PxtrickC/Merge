<script setup>
const stats = await useAPI("/stats")
const { token: alpha_token } = await useToken(1)
const omnibus = await useAPI("/omnibus")
</script>

<template>
  <div class="card__container">
    <div class="card__title">Stats</div>
    <div class="card__content">
      <div class="stat__row">
        <span class="card__content__label">tokens</span>
        <span class="card__content__value">{{stats?.token_count}}</span>
      </div>
      <div class="stat__row">
        <span class="card__content__label">merged</span>
        <span class="card__content__value">{{stats?.merged_count}}</span>
      </div>
      <div class="stat__row">
        <span class="card__content__label">alpha mass</span>
        <span class="card__content__value">{{stats?.alpha_mass}}</span>
      </div>
      <div class="stat__row">
        <span class="card__content__label">global mass</span>
        <span class="card__content__value">{{stats?.total_mass}}</span>
      </div>
      <div class="stat__row">
        <span class="card__content__label">eth floor</span>
        <span class="card__content__value">—</span>
      </div>
      <div class="stat__row">
        <span class="card__content__label">NiftyGateway</span>
        <span class="card__content__value">{{omnibus?.count}}</span>
      </div>
    </div>
  </div>
</template>

<style lang="postcss" scoped>
.card__content {
  @apply flex flex-col;
}
.stat__row {
  @apply flex justify-between items-center;
  @apply py-3;
  border-bottom: 1px solid #1a1a1a;
}
</style>
