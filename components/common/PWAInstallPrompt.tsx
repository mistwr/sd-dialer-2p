'use client'

import { useEffect, useState } from 'react'
import { Download, Share2, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isAndroid, setIsAndroid] = useState(false)
  const [isSamsungBrowser, setIsSamsungBrowser] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    const userAgent = navigator.userAgent
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    const ios = /iPad|iPhone|iPod/.test(userAgent) && !(window as Window & { MSStream?: unknown }).MSStream
    const android = /Android/i.test(userAgent)

    setIsStandalone(standalone)
    setIsIOS(ios)
    setIsAndroid(android)
    setIsSamsungBrowser(/SamsungBrowser/i.test(userAgent))

    if (standalone) return

    try {
      const dismissedAt = Number(localStorage.getItem('sd-dialer-pwa-install-dismissed') || 0)
      if (dismissedAt && Date.now() - dismissedAt < 3 * 24 * 60 * 60 * 1000) return
    } catch {
      // Keep the prompt available when browser storage is disabled.
    }

    const supportsInstallUi = ios || android || /Chrome|Chromium|CriOS|Edg\//i.test(userAgent)
    const timer = supportsInstallUi ? window.setTimeout(() => setShowPrompt(true), 3500) : undefined

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
      setShowPrompt(true)
    }

    const handleInstalled = () => {
      setShowPrompt(false)
      setDeferredPrompt(null)
      setShowInstructions(false)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)

    return () => {
      if (timer) window.clearTimeout(timer)
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) {
      setShowInstructions(true)
      return
    }

    const installPrompt = deferredPrompt
    setDeferredPrompt(null)
    setShowInstructions(false)

    try {
      await installPrompt.prompt()
      const { outcome } = await installPrompt.userChoice
      if (outcome === 'accepted') {
        setShowPrompt(false)
      } else {
        localStorage.setItem('sd-dialer-pwa-install-dismissed', Date.now().toString())
        setShowPrompt(false)
      }
    } catch {
      setShowInstructions(true)
    }
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    try {
      localStorage.setItem('sd-dialer-pwa-install-dismissed', Date.now().toString())
    } catch {
      // Dismiss the card for this visit if storage is unavailable.
    }
  }

  if (isStandalone || !showPrompt) return null

  return (
    <aside
      role="complementary"
      aria-label="Instalar SD Dialer"
      className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[100] mx-auto w-auto max-w-sm animate-in slide-in-from-bottom-4 duration-300 sm:bottom-4 sm:left-auto sm:right-4 sm:w-80"
    >
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20">
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <Download className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="mb-1 text-sm font-semibold text-slate-950">Instalar SD Dialer</h3>
              <p className="text-xs leading-relaxed text-slate-600">
                Adiciona o discador ao ecrã inicial para abrir as leads e o painel como uma app.
              </p>
            </div>
            <button
              onClick={handleDismiss}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800"
              aria-label="Fechar instalação do SD Dialer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {showInstructions ? (
            <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3" aria-live="polite">
              {isIOS ? (
                <>
                  <p className="flex items-center gap-2 text-xs text-slate-700">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">1</span>
                    Toca em <Share2 className="mx-1 inline h-4 w-4 text-blue-700" aria-label="Partilhar" /> Partilhar.
                  </p>
                  <p className="flex items-center gap-2 text-xs text-slate-700">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">2</span>
                    Escolhe “Adicionar ao ecrã principal” e confirma.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs leading-relaxed text-slate-700">
                    {isSamsungBrowser
                      ? 'No Samsung Internet, abre o menu ☰ e escolhe “Adicionar página a” e depois “Ecrã inicial”.'
                      : 'Abre o menu ⋮ do navegador e escolhe “Instalar app” ou “Adicionar ao ecrã inicial”.'}
                  </p>
                  {isAndroid && !isSamsungBrowser && (
                    <p className="text-[11px] leading-relaxed text-slate-500">
                      Se estiveres noutra app, abre primeiro esta página no Chrome.
                    </p>
                  )}
                </>
              )}
            </div>
          ) : null}

          <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
            <button
              onClick={handleInstall}
              className="flex min-h-11 items-center justify-center rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              {deferredPrompt ? 'Instalar app' : isIOS ? 'Como instalar' : 'Ver como instalar'}
            </button>
            <button
              onClick={handleDismiss}
              className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm text-slate-600 transition-colors hover:bg-slate-50"
            >
              Agora não
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
