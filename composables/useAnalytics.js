export function useAnalytics() {
  function trackEvent(name, params = {}) {
    if (import.meta.client && window.gtag) {
      window.gtag('event', name, params)
    }
  }
  return { trackEvent }
}
