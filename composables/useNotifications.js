function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function useNotifications() {
  const isSupported = useState('notifSupported', () => false)
  const isSubscribed = useState('notifSubscribed', () => false)
  const permission = useState('notifPermission', () => 'default')
  const loading = useState('notifLoading', () => false)
  const initialized = useState('notifInitialized', () => false)

  if (import.meta.client && !initialized.value) {
    initialized.value = true
    isSupported.value = ('serviceWorker' in navigator) && ('PushManager' in window)

    if (isSupported.value) {
      permission.value = Notification.permission
      checkExistingSubscription()
    }
  }

  async function checkExistingSubscription() {
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js')
      if (!reg) return
      const sub = await reg.pushManager.getSubscription()
      isSubscribed.value = !!sub
    } catch {
      // SW not registered yet
    }
  }

  async function registerServiceWorker() {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js')
    if (reg) return reg
    return navigator.serviceWorker.register('/sw.js', { scope: '/' })
  }

  async function subscribe() {
    if (!isSupported.value || loading.value) return

    loading.value = true
    try {
      const perm = await Notification.requestPermission()
      permission.value = perm
      if (perm !== 'granted') return

      const reg = await registerServiceWorker()
      await navigator.serviceWorker.ready

      const config = useRuntimeConfig()
      const applicationServerKey = urlBase64ToUint8Array(config.public.VAPID_PUBLIC_KEY)

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      })

      await $fetch('/api/push/subscribe', {
        method: 'POST',
        body: subscription.toJSON(),
      })

      isSubscribed.value = true
    } catch (err) {
      console.error('[Notifications] subscribe failed:', err)
    } finally {
      loading.value = false
    }
  }

  async function unsubscribe() {
    if (loading.value) return

    loading.value = true
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js')
      if (!reg) return

      const subscription = await reg.pushManager.getSubscription()
      if (!subscription) return

      await $fetch('/api/push/unsubscribe', {
        method: 'POST',
        body: { endpoint: subscription.endpoint },
      })

      await subscription.unsubscribe()
      isSubscribed.value = false
    } catch (err) {
      console.error('[Notifications] unsubscribe failed:', err)
    } finally {
      loading.value = false
    }
  }

  return { isSupported, isSubscribed, permission, loading, subscribe, unsubscribe }
}
