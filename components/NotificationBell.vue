<script setup>
const { isSupported, isSubscribed, permission, loading, subscribe, unsubscribe } = useNotifications()

function handleClick() {
  if (!isSupported.value) return
  if (isSubscribed.value) {
    unsubscribe()
  } else {
    subscribe()
  }
}
</script>

<template>
  <button
    v-if="isSupported"
    class="notif-bell"
    :class="{
      'notif-bell--active': isSubscribed,
      'notif-bell--denied': permission === 'denied',
      'notif-bell--loading': loading,
    }"
    :disabled="permission === 'denied' || loading"
    :title="
      permission === 'denied' ? 'Notifications blocked in browser settings'
        : isSubscribed ? 'Disable merge notifications'
        : 'Enable merge notifications'
    "
    @click="handleClick"
  >
    <svg class="notif-bell__icon" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
    <span v-if="isSubscribed" class="notif-bell__dot"></span>
  </button>
</template>

<style lang="postcss" scoped>
.notif-bell {
  @apply relative flex items-center justify-center;
  width: 32px;
  height: 32px;
  background: none;
  border: none;
  padding: 0;
  opacity: 0.6;
  transition: opacity 0.2s;
  cursor: pointer;
}
.notif-bell:hover {
  opacity: 0.8;
}
.notif-bell--active {
  opacity: 1;
}
.notif-bell--denied {
  opacity: 0.15;
  cursor: not-allowed;
}
.notif-bell--loading {
  opacity: 0.3;
  pointer-events: none;
}
.notif-bell__icon {
  width: 18px;
  height: 18px;
}
.notif-bell__dot {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #4ade80;
}
</style>
