export default defineNuxtPlugin(() => {
  const router = useRouter()
  router.afterEach((to) => {
    window.gtag?.('event', 'page_view', {
      page_path: to.fullPath,
      page_title: to.meta?.title || document.title,
    })
  })

  // Track PWA install
  window.addEventListener('appinstalled', () => {
    window.gtag?.('event', 'pwa_installed')
  })

  // Track if user is in standalone (PWA) mode
  if (window.matchMedia('(display-mode: standalone)').matches) {
    window.gtag?.('set', 'user_properties', { pwa_mode: 'standalone' })
  }
})
