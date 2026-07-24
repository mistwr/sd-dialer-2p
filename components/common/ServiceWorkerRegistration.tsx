'use client'

import { useEffect } from 'react'

/**
 * Service Worker Registration Component
 * Registers the Service Worker for PWA functionality
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    // Only register on client side and in production
    if (typeof window === 'undefined') return

    // Registrar Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        })
        .then((registration) => {
          // Check for updates periodically
          setInterval(() => {
            registration.update()
          }, 3600000) // Check every hour
        })
        .catch(() => {
          // SW registration failed silently in development
        })
    }

    // Handle Service Worker messages
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const messageHandler = (_event: MessageEvent) => {
        // handle SW messages if needed
      }

      navigator.serviceWorker.addEventListener('message', messageHandler)

      return () => {
        navigator.serviceWorker.removeEventListener('message', messageHandler)
      }
    }
  }, [])

  return null
}
