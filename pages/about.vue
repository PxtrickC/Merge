<template>
  <div class="about">
    <NuxtLink to="/" class="about__back">
      <icon class="w-5" variant="return" />
    </NuxtLink>
    <img src="/images/about-merge.jpg" alt="About Merge" width="2400" height="7200" class="about__img" />
  </div>
</template>

<style lang="postcss" scoped>
.about {
  @apply min-h-screen bg-black overflow-hidden;
}
.about__back {
  @apply fixed top-4 left-4 z-10 text-white p-2;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 50%;
}
.about__img {
  @apply block;
  width: 960px;
  height: 2880px;
  max-width: none;
  position: relative;
  left: 50%;
  transform: translateX(-50%);
}
@media (min-width: 768px) {
  .about__img {
    width: 1920px;
    height: 5760px;
  }
}
</style>
