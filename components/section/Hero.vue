<template>
  <section class="hero">
    <h1 class="hero__title">merge.</h1>
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
  @apply text-white;
  font-size: clamp(4rem, 15vw, 10rem);
  line-height: 1;
  letter-spacing: -0.03em;
}
</style>
