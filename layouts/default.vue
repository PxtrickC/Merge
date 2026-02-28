<template>
  <div class="layout__container">
    <NavBar />
    <slot />
    <AppFooter />
  </div>
</template>

<style lang="postcss">
.layout__container {
  @apply min-h-screen;
  @apply flex flex-col;
  padding-top: calc(3rem + env(safe-area-inset-top));
  @apply md:pt-16 pb-16 md:pb-0;
}

/* First section on each page */
.layout__container > div:not(.mobile-header) > :first-child {
  border-top: none !important;
}

.pill {
  @apply px-5 py-2;
  @apply text-sm text-white text-opacity-80 tracking-wider;
}
</style>
