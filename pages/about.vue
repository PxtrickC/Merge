<template>
  <div class="about">
    <img src="/images/about-merge.webp" alt="About Merge" width="2336" height="7202" class="about__img" />
  </div>
</template>

<style lang="postcss" scoped>
.about {
  @apply min-h-screen bg-black;
  display: flex;
  justify-content: center;
  overflow-x: auto;
}
.about__img {
  @apply block;
  width: 1168px;
  height: auto;
  max-width: none;
}
@media (min-width: 768px) {
  .about {
    overflow-x: hidden;
  }
  .about__img {
    width: 100%;
    max-width: 1920px;
  }
}
</style>
