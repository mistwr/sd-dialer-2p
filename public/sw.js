/**
 * SD Dialer Service Worker
 *
 * Regra principal: páginas e pedidos dinâmicos do Next.js são sempre
 * network-first. Só assets estáticos com URL versionada ficam cache-first.
 * Isto evita servir versões antigas do dashboard depois de um deploy.
 */

const CACHE_NAME = 'sd-dialer-v3'
const ASSETS_TO_CACHE = [
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(ASSETS_TO_CACHE).catch(() => undefined)
    )
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return

  const isApi = url.pathname.startsWith('/api/')
  const isNavigation = event.request.mode === 'navigate'
  const isRsc =
    url.searchParams.has('_rsc') ||
    event.request.headers.get('RSC') === '1' ||
    event.request.headers.get('Next-Router-Prefetch') === '1'
  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    /\.(?:png|jpg|jpeg|webp|svg|gif|ico|woff2?|ttf|otf)$/i.test(url.pathname)

  // Nunca servir dados de API a partir de uma versão antiga em cache.
  if (isApi) {
    event.respondWith(fetch(event.request))
    return
  }

  // Navegação e React Server Components: rede primeiro e sem guardar resposta.
  // Estes pedidos contêm a versão atual das páginas do Next.js.
  if (isNavigation || isRsc) {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = await caches.match(event.request)
        return cached || new Response('Offline - página não disponível', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      })
    )
    return
  }

  // Assets estáticos versionados podem ficar em cache.
  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached
        return fetch(event.request).then((response) => {
          if (response && response.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()))
          }
          return response
        })
      })
    )
    return
  }

  // Tudo o resto: network-first para evitar interface obsoleta.
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match(event.request)
      return cached || new Response('Offline - recurso não disponível', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    })
  )
})

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'SD Dialer', {
      body: data.message,
      badge: '/icons/icon-192.png',
      icon: '/icons/icon-512.png',
      tag: data.tag || 'sd-dialer-notification',
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus()
      }
      return clients.openWindow ? clients.openWindow('/') : undefined
    })
  )
})
