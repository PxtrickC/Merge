<template>
  <div class="layout__container">
    <slot />
  </div>
</template>

<style lang="postcss">
.layout__container {
  @apply min-h-screen;
  @apply flex flex-col;
}

.pill {
  @apply px-5 py-2;
  @apply text-sm text-white text-opacity-80 tracking-wider;
}
</style>
