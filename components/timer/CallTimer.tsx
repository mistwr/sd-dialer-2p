'use client'

import { useEffect, useState } from 'react'

interface CallTimerProps {
  isRunning: boolean
  onDurationChange?: (seconds: number) => void
  onStop?: () => void
}

export function CallTimer({ isRunning, onDurationChange, onStop }: CallTimerProps) {
  const [seconds, setSeconds] = useState(0)
  const [minutes, setMinutes] = useState(0)

  useEffect(() => {
    if (!isRunning) return

    const interval = setInterval(() => {
      setSeconds((prev) => {
        if (prev === 59) {
          setMinutes((m) => m + 1)
          return 0
        }
        return prev + 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isRunning])

  useEffect(() => {
    const totalSeconds = minutes * 60 + seconds
    onDurationChange?.(totalSeconds)
  }, [seconds, minutes, onDurationChange])

  const formatTime = (m: number, s: number) => {
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  return (
    <div className="fixed bottom-6 right-6 bg-blue-600 text-white rounded-lg shadow-lg p-4 md:p-6">
      <div className="text-center">
        <p className="text-sm font-medium mb-2">Duração da Chamada</p>
        <p className="text-3xl font-bold font-mono mb-3">{formatTime(minutes, seconds)}</p>
        {onStop && (
          <button onClick={onStop} className="sd-btn-danger w-full">
            Terminar Chamada
          </button>
        )}
      </div>
    </div>
  )
}
