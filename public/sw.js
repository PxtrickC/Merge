self.addEventListener('push', (event) => {
  let data = {
    title: 'Merge Event',
    body: 'A new merge has occurred!',
    url: '/leaderboard',
  }

  if (event.data) {
    try {
      data = event.data.json()
    } catch {
      data.body = event.data.text()
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.image || '/apple-touch-icon-180x180.png',
      badge: '/apple-touch-icon-180x180.png',
      image: data.image || undefined,
      tag: data.tag || 'merge-event',
      renotify: true,
      data: { url: data.url || '/' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/leaderboard'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return clients.openWindow(url)
    })
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})
