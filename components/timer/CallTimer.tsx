'use client'

import { useEffect, useState, useRef } from 'react'
import { Phone, PhoneOff } from 'lucide-react'

interface CallTimerProps {
  leadId?: string
  leadName?: string
  leadPhone?: string
  isRunning: boolean
  onDurationChange?: (seconds: number) => void
  onStop?: () => void
  onCallEnd?: (duration: number) => Promise<void>
}

/**
 * CallTimer Component
 * Cronómetro para rastreamento de chamadas com persistência em localStorage
 * e suporte a Service Worker para continuar mesmo com app fechada
 */
export function CallTimer({
  leadId,
  leadName = 'Chamada',
  leadPhone,
  isRunning,
  onDurationChange,
  onStop,
  onCallEnd,
}: CallTimerProps) {
  const [seconds, setSeconds] = useState(0)
  const [minutes, setMinutes] = useState(0)
  const [isAppVisible, setIsAppVisible] = useState(true)
  const startTimeRef = useRef<number | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Recuperar tempo de localStorage ao montar
  useEffect(() => {
    if (!leadId) return

    const saved = localStorage.getItem(`call_timer_${leadId}`)
    if (saved) {
      const { startTime, totalTime } = JSON.parse(saved)
      startTimeRef.current = startTime
      const elapsed = Math.floor((Date.now() - startTime) / 1000)
      setMinutes(Math.floor(elapsed / 60))
      setSeconds(elapsed % 60)
    }
  }, [leadId])

  // Timer effect com localStorage sync
  useEffect(() => {
    if (!isRunning) {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }

    if (startTimeRef.current === null) {
      startTimeRef.current = Date.now()
    }

    timerRef.current = setInterval(() => {
      setSeconds((prev) => {
        if (prev === 59) {
          setMinutes((m) => m + 1)
          return 0
        }
        return prev + 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isRunning])

  // Sincronizar com localStorage a cada segundo
  useEffect(() => {
    if (!isRunning || !leadId || !startTimeRef.current) return

    const totalSeconds = minutes * 60 + seconds
    localStorage.setItem(
      `call_timer_${leadId}`,
      JSON.stringify({
        startTime: startTimeRef.current,
        totalTime: totalSeconds,
        timestamp: Date.now(),
      })
    )

    // Notificar Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.controller?.postMessage({
        type: 'CALL_TIMER_UPDATE',
        leadId,
        duration: totalSeconds,
      })
    }

    onDurationChange?.(totalSeconds)
  }, [seconds, minutes, isRunning, leadId, onDurationChange])

  // Monitorar visibilidade da página
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsAppVisible(!document.hidden)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  const handleStartCall = () => {
    if (leadPhone) {
      const tel = leadPhone.replace(/\D/g, '')
      window.location.href = `tel:+${tel}`
    }
  }

  const handleEndCall = async () => {
    if (timerRef.current) clearInterval(timerRef.current)
    const totalSeconds = minutes * 60 + seconds

    if (leadId) {
      localStorage.removeItem(`call_timer_${leadId}`)
    }

    onStop?.()

    if (onCallEnd) {
      await onCallEnd(totalSeconds)
    }
  }

  const formatTime = (m: number, s: number) => {
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  return (
    <div className={`fixed bottom-6 right-6 rounded-lg shadow-lg p-4 md:p-6 ${isAppVisible ? 'bg-blue-600' : 'bg-yellow-600'} text-white z-50`}>
      <div className="text-center">
        <p className="text-sm font-medium mb-2">{leadName}</p>
        {leadPhone && <p className="text-xs text-gray-200 mb-2">{leadPhone}</p>}
        <p className="text-3xl font-bold font-mono mb-3">{formatTime(minutes, seconds)}</p>

        <div className="flex gap-2">
          {leadPhone && !isRunning && (
            <button onClick={handleStartCall} className="sd-btn-success flex-1 flex items-center justify-center gap-2 text-sm">
              <Phone size={16} />
              Chamar
            </button>
          )}
          <button onClick={handleEndCall} className="sd-btn-danger flex-1 flex items-center justify-center gap-2 text-sm">
            <PhoneOff size={16} />
            Terminar
          </button>
        </div>

        {!isAppVisible && <p className="text-xs text-yellow-200 mt-2">⏱️ Timer em background</p>}
      </div>
    </div>
  )
}
