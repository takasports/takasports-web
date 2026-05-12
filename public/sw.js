// TakaSports Service Worker — push notifications + offline shell (v4)
const CACHE_NAME = 'takasports-v4'
const SHELL_URLS = ['/', '/quiniela', '/calendario', '/noticias']

// Install: pre-cache app shell (best-effort)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(SHELL_URLS).catch(() => null))
  )
  self.skipWaiting()
})

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch: network-first para navegaciones, cache fallback
self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  if (request.url.includes('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE_NAME).then((c) => c.put(request, copy)).catch(() => null)
          return res
        })
        .catch(() =>
          caches.match(request).then((r) => r ?? caches.match('/quiniela'))
        )
    )
  }
})

// Push notifications — soporta quiniela-reminder con acción rápida
self.addEventListener('push', (event) => {
  if (!event.data) return
  let data
  try { data = event.data.json() } catch { data = { title: 'TakaSports', body: event.data.text() } }

  const isQuiniela = (data.tag ?? '').includes('quiniela')
  const actions = isQuiniela
    ? [{ action: 'open', title: '⚽ Ir a Quiniela' }]
    : []

  event.waitUntil(
    self.registration.showNotification(data.title ?? 'TakaSports', {
      body: data.body ?? '',
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: data.tag ?? 'takasports',
      data: { url: data.url ?? '/quiniela' },
      vibrate: [100, 50, 100],
      actions,
      // Mantiene visible la notificación más tiempo en Android
      requireInteraction: isQuiniela,
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/quiniela'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // Reutilizar pestaña existente si ya está abierta
      const existing = list.find((c) => {
        try { return new URL(c.url).pathname === new URL(url, self.location.origin).pathname } catch { return false }
      })
      if (existing && 'focus' in existing) return existing.focus()
      return clients.openWindow(url)
    })
  )
})

// Mensaje del cliente para skip-waiting desde la UI de actualización
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})
