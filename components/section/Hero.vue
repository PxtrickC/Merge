<template>
  <section class="hero">
    <div class="hero__wrap">
      <h1 class="hero__title">&thinsp;merge.</h1>
      <span class="hero__subtitle">Leaderboard</span>
    </div>
    <!-- <NuxtLink to="/matters" class="hero__matters">Matters →</NuxtLink> -->
  </section>
</template>

<style lang="postcss" scoped>
.hero {
  @apply min-h-screen flex flex-col items-center justify-center;
  @apply p-4 md:p-8;
  @apply relative;
  background: url('/images/hero-bg.jpg') center center / cover no-repeat black;
}
.hero__wrap {
  @apply relative flex flex-col items-center;
}
.hero__subtitle {
  font-family: 'DM Sans', sans-serif;
  font-weight: 700;
  @apply text-white;
  font-size: clamp(1.5rem, 5vw, 3rem);
  line-height: 1;
  letter-spacing: -0.03em;
  position: absolute;
  top: 100%;
  margin-top: 1.5rem;
}
.hero__title {
  font-family: 'DM Sans', sans-serif;
  font-weight: 700;
  @apply text-white;
  font-size: clamp(4rem, 15vw, 10rem);
  line-height: 1;
  letter-spacing: -0.03em;
}
.hero__matters {
  position: absolute;
  bottom: 2rem;
  right: 2rem;
  color: rgba(255, 255, 255, 0.4);
  font-family: 'DM Sans', sans-serif;
  font-size: 0.875rem;
  transition: color 0.2s;
}
.hero__matters:hover {
  color: rgba(255, 255, 255, 0.8);
}
</style>
