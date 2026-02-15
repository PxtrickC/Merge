<template>
  <div class="about">
    <NuxtLink to="/" class="about__back">
      <icon class="w-5" variant="return" />
    </NuxtLink>
    <img src="/images/about-merge.jpg" alt="About Merge" class="about__img" />
  </div>
</template>

<style lang="postcss" scoped>
.about {
  @apply min-h-screen bg-black;
}
.about__back {
  @apply fixed top-4 left-4 z-10 text-white p-2;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 50%;
}
.about__img {
  @apply block;
}
</style>
