<script setup>
const pullDistance = ref(0)
const pulling = ref(false)
const refreshing = ref(false)
let startY = 0
const threshold = 80

function onTouchStart(e) {
  if (window.scrollY === 0 && !refreshing.value) {
    startY = e.touches[0].clientY
    pulling.value = true
  }
}

function onTouchMove(e) {
  if (!pulling.value || refreshing.value) return
  const dy = e.touches[0].clientY - startY
  if (dy > 0 && window.scrollY === 0) {
    pullDistance.value = Math.min(dy * 0.4, 120)
    if (pullDistance.value > 10) e.preventDefault()
  } else {
    pullDistance.value = 0
  }
}

function onTouchEnd() {
  if (!pulling.value) return
  pulling.value = false
  if (pullDistance.value >= threshold) {
    refreshing.value = true
    pullDistance.value = 60
    setTimeout(() => {
      window.location.reload()
    }, 600)
  } else {
    pullDistance.value = 0
  }
}

onMounted(() => {
  nextTick(() => {
    const header = document.querySelector('.mobile-header')
    if (header) {
      document.documentElement.style.setProperty(
        '--header-h', header.offsetHeight + 'px'
      )
    }
  })
})
</script>

<template>
  <div
    class="layout__container"
    @touchstart.passive="onTouchStart"
    @touchmove="onTouchMove"
    @touchend.passive="onTouchEnd"
  >
    <!-- Pull-to-refresh indicator -->
    <div
      v-if="pullDistance > 0"
      class="ptr"
      :style="{ height: pullDistance + 'px' }"
    >
      <div class="ptr__dots" :class="{ 'ptr__dots--active': pullDistance >= threshold || refreshing }">
        <span class="ptr__dot ptr__dot--left" />
        <span class="ptr__dot ptr__dot--right" />
      </div>
    </div>

    <NavBar />
    <slot />
    <AppFooter />
  </div>
</template>

<style lang="postcss">
.layout__container {
  @apply min-h-screen;
  @apply flex flex-col;
  padding-top: var(--header-h, calc(3rem + env(safe-area-inset-top)));
  @apply md:pt-16 pb-16 md:pb-0;
}

/* First section on each page */
.layout__container > div:not(.mobile-header):not(.ptr) > :first-child {
  border-top: none !important;
  padding-top: 0.5rem !important;
}

/* Pull-to-refresh */
.ptr {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 39;
  pointer-events: none;
}
.ptr__dots {
  position: relative;
  width: 60px;
  height: 12px;
  opacity: 0.4;
  transition: opacity 0.2s;
}
.ptr__dots--active {
  opacity: 1;
}
.ptr__dots--active .ptr__dot--left {
  animation: ptr-merge-left 2s ease-in-out infinite;
}
.ptr__dots--active .ptr__dot--right {
  animation: ptr-merge-right 2s ease-in-out infinite;
}
.ptr__dot {
  position: absolute;
  top: 0;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
}
.ptr__dot--left {
  left: 0;
}
.ptr__dot--right {
  right: 0;
}

@keyframes ptr-merge-left {
  0%   { left: 0; opacity: 1; transform: scale(1); }
  40%  { left: 24px; opacity: 1; transform: scale(1); }
  50%  { left: 24px; opacity: 0; transform: scale(0.5); }
  60%  { left: 24px; opacity: 0; transform: scale(0.5); }
  70%  { left: 24px; opacity: 1; transform: scale(1); }
  100% { left: 0; opacity: 1; transform: scale(1); }
}
@keyframes ptr-merge-right {
  0%   { right: 0; opacity: 1; transform: scale(1); }
  40%  { right: 24px; opacity: 1; transform: scale(1); }
  50%  { right: 24px; opacity: 1; transform: scale(1.3); }
  60%  { right: 24px; opacity: 1; transform: scale(1); }
  70%  { right: 24px; opacity: 1; transform: scale(1); }
  100% { right: 0; opacity: 1; transform: scale(1); }
}

.pill {
  @apply px-5 py-2;
  @apply text-sm text-white text-opacity-80 tracking-wider;
}
</style>
