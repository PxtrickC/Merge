<script setup>
const { isConnected, isMainnet, shortAddress, openModal, disconnect } = useWallet()
const showMenu = ref(false)

function handleClick() {
  if (isConnected.value) {
    showMenu.value = !showMenu.value
  } else {
    openModal()
  }
}

// Close menu when clicking outside
onMounted(() => {
  document.addEventListener("click", onOutsideClick)
})
onUnmounted(() => {
  document.removeEventListener("click", onOutsideClick)
})
function onOutsideClick(e) {
  if (!e.target.closest(".wallet-btn__wrapper")) {
    showMenu.value = false
  }
}
</script>

<template>
  <div class="wallet-btn__wrapper">
    <button class="wallet-btn" :class="{ 'wallet-btn--connected': isConnected, 'wallet-btn--wrong': isConnected && !isMainnet }" @click="handleClick">
      <template v-if="!isConnected">CONNECT</template>
      <template v-else-if="!isMainnet">WRONG NETWORK</template>
      <template v-else>{{ shortAddress }}</template>
    </button>

    <div v-if="showMenu && isConnected" class="wallet-btn__menu">
      <button class="wallet-btn__menu-item" @click="disconnect(); showMenu = false">DISCONNECT</button>
    </div>
  </div>
</template>

<style lang="postcss" scoped>
.wallet-btn__wrapper {
  @apply relative;
}

.wallet-btn {
  @apply px-3 py-1;
  @apply text-xs font-bold tracking-widest;
  @apply border border-white border-opacity-30 text-white text-opacity-70;
  @apply hover:border-opacity-80 hover:text-opacity-100;
  @apply transition-all duration-150;
  font-family: "HND", monospace;
}

.wallet-btn--connected {
  @apply border-opacity-60 text-opacity-90;
}

.wallet-btn--wrong {
  @apply border-red text-red border-opacity-100;
}

.wallet-btn__menu {
  @apply absolute right-0 top-full mt-1 z-50;
  @apply bg-black border border-white border-opacity-20;
  @apply min-w-full;
}

.wallet-btn__menu-item {
  @apply block w-full px-4 py-2;
  @apply text-xs font-bold tracking-widest text-left;
  @apply text-white text-opacity-60 hover:text-opacity-100 hover:bg-white hover:bg-opacity-5;
  @apply transition-all duration-100;
  font-family: "HND", monospace;
}
</style>
