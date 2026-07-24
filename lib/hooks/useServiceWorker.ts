import { useEffect } from 'react'

/**
 * Hook para registar e gerenciar Service Worker
 * Ativa caching offline, sincronização em background e notificações push
 */
export function useServiceWorker() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      console.log('[SD Dialer] Service Worker não suportado')
      return
    }

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        })

        console.log('[SD Dialer] Service Worker registado com sucesso', registration)

        // Verificar atualizações a cada hora
        setInterval(() => {
          registration.update()
        }, 3600000)

        // Pedir permissão para notificações
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission()
        }

        // Listener para mensagens do Service Worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data.type === 'NOTIFICATION') {
            console.log('[SD Dialer]', event.data.message)
          }
        })

        // Sincronização em background quando app voltar online
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
          window.addEventListener('online', () => {
            console.log('[SD Dialer] App online - sincronizando dados')
            registration.sync?.register('sync-call-results').catch(() => {
              // Ignorar erro se sync não for suportado
            })
          })
        }
      } catch (error) {
        console.error('[SD Dialer] Erro ao registar Service Worker:', error)
      }
    }

    // Registar com delay para evitar sobrecarga inicial
    setTimeout(registerServiceWorker, 1000)
  }, [])
}
