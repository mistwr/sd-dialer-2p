'use client'
import { useEffect, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'

// Envia a posição do utilizador enquanto a app está aberta (no máx. 1x a cada 30 s).
export function LocationReporter({ userId }: { userId: string }) {
  const [ativo, setAtivo] = useState(false)
  const ultimo = useRef(0)

  useEffect(() => {
    if (!userId || typeof navigator === 'undefined' || !('geolocation' in navigator)) return
    const id = navigator.geolocation.watchPosition(
      pos => {
        const agora = Date.now()
        if (agora - ultimo.current < 30_000) return
        ultimo.current = agora
        fetch('/api/localizacao', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
          body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        }).then(r => setAtivo(r.ok)).catch(() => setAtivo(false))
      },
      () => setAtivo(false),
      { enableHighAccuracy: true, maximumAge: 20_000, timeout: 30_000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [userId])

  if (!ativo) return null
  return <span title="A tua localização está a ser partilhada com a empresa enquanto a app está aberta" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#047857' }}><MapPin size={12} /> localização ativa</span>
}
