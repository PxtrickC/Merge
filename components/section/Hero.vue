<script setup>
const stats = await useAPI("/stats")

const token_count = computed(() => stats.value?.token_count ?? 0)
const total_mass = computed(() => stats.value?.total_mass ?? 0)
const alpha_mass = computed(() => stats.value?.alpha_mass ?? 0)
</script>

<template>
  <section class="hero">
    <h1 class="hero__title">merge.</h1>

    <div class="hero__stats">
      <div class="hero__stat">
        <span class="hero__stat__value">{{ token_count.toLocaleString() }}</span>
        <span class="hero__stat__label">tokens</span>
      </div>
      <div class="hero__stat">
        <span class="hero__stat__value">{{ total_mass.toLocaleString() }}</span>
        <span class="hero__stat__label">total mass</span>
      </div>
      <div class="hero__stat">
        <span class="hero__stat__value">{{ alpha_mass.toLocaleString() }}</span>
        <span class="hero__stat__label">alpha</span>
      </div>
    </div>
  </section>
</template>

<style lang="postcss" scoped>
.hero {
  @apply min-h-screen flex flex-col items-center justify-center;
  @apply p-4 md:p-8;
  @apply relative;
}
.hero__title {
  font-family: 'DM Sans', sans-serif;
  font-weight: 700;
  @apply text-white mb-16;
  font-size: clamp(4rem, 15vw, 10rem);
  line-height: 1;
  letter-spacing: -0.03em;
}
.hero__stats {
  @apply flex gap-12 md:gap-24;
}
.hero__stat {
  @apply flex flex-col items-center;
}
.hero__stat__value {
  @apply text-4xl md:text-7xl lg:text-8xl font-medium;
  @apply text-white;
}
.hero__stat__label {
  @apply text-xs uppercase tracking-[0.2em] mt-2;
  color: #555;
}
</style>
