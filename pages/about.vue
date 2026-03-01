<template>
  <div class="about">
    <div class="about__img-wrapper">
      <img src="/images/about-merge.webp" alt="About Merge" width="2336" height="7202" class="about__img" />
    </div>
  </div>
</template>

<style lang="postcss" scoped>
.about {
  @apply min-h-screen bg-black;
  display: flex;
  justify-content: center;
  overflow-x: hidden;
}
.about__img-wrapper {
  width: 100%;
  overflow: hidden;
  display: flex;
  justify-content: center;
}
.about__img {
  @apply block;
  width: 100%;
  min-width: 1168px;
  height: auto;
}
</style>
