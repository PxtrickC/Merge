<script setup>
const route = useRoute()

const tabs = [
  { to: '/', label: 'Dashboard', match: p => p === '/' },
  { to: '/leaderboard', label: 'Leaderboard', match: p => p === '/leaderboard' },
  { to: '/market', label: 'Market', match: p => p === '/market' },
  { to: '/about', label: 'About', match: p => p === '/about' },
]
</script>

<template>
  <!-- Desktop: top bar -->
  <nav class="navbar navbar--desktop">
    <NuxtLink to="/" class="navbar__logo">
      <span class="logo-sphere" />
    </NuxtLink>
    <div class="navbar__links">
      <NuxtLink
        v-for="tab in tabs"
        :key="tab.to"
        :to="tab.to"
        class="navbar__link"
        :class="{ 'navbar__link--active': tab.match(route.path) }"
      >{{ tab.label }}</NuxtLink>
    </div>
    <div class="navbar__actions">
      <WalletButton />
      <NotificationBell />
    </div>
  </nav>

  <!-- Mobile: top header (logo + wallet) -->
  <div class="mobile-header">
    <NuxtLink to="/" class="navbar__logo">
      <span class="logo-sphere" />
    </NuxtLink>
    <div class="mobile-header__actions">
      <WalletButton />
      <NotificationBell />
    </div>
  </div>

  <!-- Mobile: bottom tab bar -->
  <nav class="mobile-tabbar">
    <NuxtLink
      v-for="tab in tabs"
      :key="tab.to"
      :to="tab.to"
      class="mobile-tabbar__tab"
      :class="{ 'mobile-tabbar__tab--active': tab.match(route.path) }"
    >
      <!-- Dashboard icon -->
      <svg v-if="tab.to === '/'" class="mobile-tabbar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
      <!-- Leaderboard icon -->
      <svg v-else-if="tab.to === '/leaderboard'" class="mobile-tabbar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M6 9H4.5a2.5 2.5 0 010-5H6" /><path d="M18 9h1.5a2.5 2.5 0 000-5H18" />
        <path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" />
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" />
        <path d="M18 2H6v7a6 6 0 1012 0V2z" />
      </svg>
      <!-- Market icon -->
      <svg v-else-if="tab.to === '/market'" class="mobile-tabbar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
      </svg>
      <!-- About icon -->
      <svg v-else class="mobile-tabbar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
      <span class="mobile-tabbar__label">{{ tab.label }}</span>
    </NuxtLink>
  </nav>
</template>

<style lang="postcss" scoped>
/* ---- Desktop top bar ---- */
.navbar--desktop {
  @apply hidden md:flex items-center justify-between;
  @apply fixed top-0 left-0 right-0;
  @apply px-8 py-4;
  background: #0a0a0a;
  z-index: 40;
}
.navbar__logo {
  @apply flex items-center;
}
.logo-sphere {
  display: block;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #fff;
  transition: background 0.15s, box-shadow 0.15s;
}
.navbar__logo:hover .logo-sphere {
  animation: sphere-colors 0.5s steps(1) infinite;
}
@keyframes sphere-colors {
  0%   { background: #e53935; }       /* red */
  25%  { background: #1e88e5; }       /* blue */
  50%  { background: #fdd835; }       /* yellow */
  75%  { background: #0a0a0a; box-shadow: inset 0 0 0 2px #fff; } /* black with white outline */
  100% { background: #e53935; }
}
.navbar__links {
  @apply flex items-center gap-6;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}
.navbar__link {
  @apply text-base text-white;
  font-family: 'HND', sans-serif;
  opacity: 0.4;
  transition: opacity 0.2s;
}
.navbar__link:hover {
  opacity: 0.7;
}
.navbar__link--active {
  opacity: 1;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.navbar__actions {
  @apply flex items-center gap-3;
}

/* ---- Mobile top header ---- */
.mobile-header {
  @apply fixed top-0 left-0 right-0;
  @apply flex md:hidden items-center justify-between;
  @apply px-4;
  padding-top: calc(8px + env(safe-area-inset-top));
  padding-bottom: 8px;
  background: #0a0a0a;
  z-index: 40;
}
.mobile-header__actions {
  @apply flex items-center gap-2;
}

/* ---- Mobile bottom tab bar ---- */
.mobile-tabbar {
  @apply fixed bottom-0 left-0 right-0;
  @apply flex md:hidden items-center justify-around;
  @apply px-2;
  padding-top: 8px;
  padding-bottom: calc(8px + env(safe-area-inset-bottom));
  background: #0a0a0a;
  border-top: 1px solid #1a1a1a;
  z-index: 40;
}
.mobile-tabbar__tab {
  @apply flex flex-col items-center justify-center gap-0.5;
  @apply py-2;
  flex: 1;
  text-decoration: none;
  min-height: 44px;
}
.mobile-tabbar__icon {
  @apply w-5 h-5 text-white;
  opacity: 0.4;
  transition: opacity 0.2s;
}
.mobile-tabbar__label {
  @apply text-xs text-white;
  font-family: 'HND', sans-serif;
  opacity: 0.4;
  transition: opacity 0.2s;
}
.mobile-tabbar__tab--active .mobile-tabbar__icon,
.mobile-tabbar__tab--active .mobile-tabbar__label {
  opacity: 1;
}
</style>
