<template>
  <div class="layout__container">
    <slot />

    <section-latest-merges />
    <section-leaderboard />
  </div>
</template>

<style lang="postcss">
.layout__container {
  @apply min-h-screen;
  @apply flex flex-col;
}

section {
  @apply p-4 md:p-8;
  border-bottom: 1px solid #222;
}
section li {
  @apply py-4;
  @apply flex justify-between items-center;
}
.pill {
  @apply px-5 py-2;
  @apply text-sm text-white text-opacity-80 tracking-wider;
}
</style>
