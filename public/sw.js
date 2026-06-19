// TakaSports Service Worker — push notifications + offline shell (v8)
// v8: arregla el bug "fotos gigantes" (FOUC). Cachea los estáticos de Next
//     (/_next/static, con hash) en cache-first, así un HTML cacheado SIEMPRE
//     encuentra su CSS y la página no se pinta sin estilos tras un deploy.
//     Bump de versión para purgar cachés viejas sin estáticos. Fallback offline
//     de navegación corregido de '/quiniela' (no precacheado) a '/'.
// v7: las notificaciones usan /icon-192.png (antes /icon.svg, inexistente →
//     salían con el icono genérico del navegador en vez del logo Taka).
// v6: alinea el shell con la PWA instalable (start_url '/', Predicciones):
// precache '/predicciones' y '/juegos'; bump de cache para aplicar el cambio.
const CACHE_NAME = 'takasports-v8'
const SHELL_URLS = ['/', '/predicciones', '/juegos', '/calendario', '/noticias']

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

  const url = new URL(request.url)

  // Estáticos de Next (CSS/JS/fuentes con hash de contenido = inmutables) →
  // CACHE-FIRST. Clave del arreglo: si servimos un HTML cacheado, su CSS también
  // está en caché y la página NUNCA se pinta sin estilos (bug "fotos gigantes").
  if (url.origin === self.location.origin && url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            if (res && res.status === 200) {
              const copy = res.clone()
              caches.open(CACHE_NAME).then((c) => c.put(request, copy)).catch(() => null)
            }
            return res
          })
      )
    )
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE_NAME).then((c) => c.put(request, copy)).catch(() => null)
          return res
        })
        .catch(() => caches.match(request).then((r) => r ?? caches.match('/')))
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
      icon: '/icon-192.png',
      badge: '/icon-192.png',
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
