/**
 * SD Dialer Service Worker
 * Responsável por:
 * - Cache de assets para offline
 * - Sincronização de background para chamadas
 * - Notificações push
 */

const CACHE_NAME = 'sd-dialer-v1'
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

// Instalar Service Worker e cachear assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {
        // Ignore errors for optional assets
      })
    })
  )
  self.skipWaiting()
})

// Ativar e limpar caches antigas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  self.clients.claim()
})

// Estratégia de cache: Network-first com fallback para cache
self.addEventListener('fetch', (event) => {
  // Não cachear POST, PUT, DELETE
  if (event.request.method !== 'GET') {
    return
  }

  // Para requisições de API, usar network-first
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cachear se bem-sucedido
          if (response.ok) {
            const cache = caches.open(CACHE_NAME)
            cache.then((c) => c.put(event.request, response.clone()))
          }
          return response
        })
        .catch(() => {
          // Fallback para cache se offline
          return caches.match(event.request)
        })
    )
    return
  }

  // Para assets estáticos, usar cache-first
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response
      }

      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200) {
            return response
          }

          const responseToCache = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache)
          })

          return response
        })
        .catch(() => {
          // Offline fallback
          return new Response('Offline - página não disponível', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/plain',
            }),
          })
        })
    })
  )
})

// Sincronização em background (para enviar dados quando voltar online)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-call-results') {
    event.waitUntil(syncCallResults())
  }
})

// Função para sincronizar resultados de chamadas
async function syncCallResults() {
  try {
    const results = localStorage.getItem('pending_call_results')
    if (!results) return

    const response = await fetch('/api/call-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: results,
    })

    if (response.ok) {
      localStorage.removeItem('pending_call_results')
      notifyClients('Resultados de chamadas sincronizados')
    }
  } catch (error) {
    console.error('Erro ao sincronizar resultados:', error)
  }
}

// Notificações push
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  const title = data.title || 'SD Dialer'
  const options = {
    body: data.message,
    badge: '/icons/icon-192.png',
    icon: '/icons/icon-512.png',
    tag: data.tag || 'sd-dialer-notification',
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// Click em notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Focar em janela existente se tiver
      for (let client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus()
        }
      }
      // Caso contrário, abrir nova janela
      if (clients.openWindow) {
        return clients.openWindow('/')
      }
    })
  )
})

// Mensagens de cliente
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CALL_TIMER_UPDATE') {
    // Atualizar badge com duração da chamada
    if ('setAppBadge' in self.registration) {
      self.registration.setAppBadge(event.data.duration)
    }
  }
})

// Função auxiliar para notificar clientes
function notifyClients(message) {
  clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: 'NOTIFICATION',
        message,
      })
    })
  })
}
