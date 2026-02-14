<template>
  <div class="loading" :class="{ 'loading--fullscreen': fullscreen }">
    <div class="loading__dots">
      <span class="loading__dot loading__dot--left" />
      <span class="loading__dot loading__dot--right" />
    </div>
  </div>
</template>

<script setup>
defineProps({
  fullscreen: { type: Boolean, default: true },
})
</script>

<style scoped>
.loading {
  display: flex;
  justify-content: center;
  align-items: center;
}
.loading--fullscreen {
  position: fixed;
  inset: 0;
  background: #000;
  z-index: 9999;
}
.loading__dots {
  position: relative;
  width: 60px;
  height: 12px;
}
.loading__dot {
  position: absolute;
  top: 0;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
}
.loading__dot--left {
  animation: merge-left 2s ease-in-out infinite;
}
.loading__dot--right {
  animation: merge-right 2s ease-in-out infinite;
}

/* Left dot: move right → fade out at center → reappear → move back */
@keyframes merge-left {
  0% {
    left: 0;
    opacity: 1;
    transform: scale(1);
  }
  40% {
    left: 24px;
    opacity: 1;
    transform: scale(1);
  }
  50% {
    left: 24px;
    opacity: 0;
    transform: scale(0.5);
  }
  60% {
    left: 24px;
    opacity: 0;
    transform: scale(0.5);
  }
  70% {
    left: 24px;
    opacity: 1;
    transform: scale(1);
  }
  100% {
    left: 0;
    opacity: 1;
    transform: scale(1);
  }
}

/* Right dot: move left → scale up at center → scale back → move right */
@keyframes merge-right {
  0% {
    right: 0;
    opacity: 1;
    transform: scale(1);
  }
  40% {
    right: 24px;
    opacity: 1;
    transform: scale(1);
  }
  50% {
    right: 24px;
    opacity: 1;
    transform: scale(1.3);
  }
  60% {
    right: 24px;
    opacity: 1;
    transform: scale(1);
  }
  70% {
    right: 24px;
    opacity: 1;
    transform: scale(1);
  }
  100% {
    right: 0;
    opacity: 1;
    transform: scale(1);
  }
}
</style>
