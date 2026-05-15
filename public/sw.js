const CACHE_NAME = 'pink-day-v1'
const STATIC_ASSETS = ['/auth', '/manifest.webmanifest', '/icon.svg', '/icon-maskable.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/auth')))
    return
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached
      }

      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response
          }

          const responseClone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone))
          return response
        })
        .catch(() => caches.match('/'))
    }),
  )
})

self.addEventListener('push', (event) => {
  let payload = {
    body: 'Masz nową aktywność w aplikacji.',
    title: 'Pink Day',
    url: '/',
  }

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() }
    } catch {
      payload.body = event.data.text()
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Pink Day', {
      badge: '/icon-maskable.svg',
      body: payload.body,
      data: {
        url: payload.url || '/',
      },
      icon: '/icon.svg',
      tag: payload.tag || 'pink-day',
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((clients) => {
      const existingClient = clients.find((client) => client.url.includes(self.location.origin))

      if (existingClient) {
        existingClient.focus()
        return existingClient.navigate(url)
      }

      return self.clients.openWindow(url)
    }),
  )
})
