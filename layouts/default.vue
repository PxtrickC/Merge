<template>
  <div class="layout__container">
    <div class="layout__wallet">
      <trade-wallet-button />
    </div>
    <slot />
  </div>
</template>

<style lang="postcss">
.layout__container {
  @apply min-h-screen;
  @apply flex flex-col;
  @apply relative;
}

.layout__wallet {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 40;
}

.pill {
  @apply px-5 py-2;
  @apply text-sm text-white text-opacity-80 tracking-wider;
}
</style>
