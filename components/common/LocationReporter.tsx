'use client'
import { useEffect, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'

// Envia a posição do utilizador enquanto a app está aberta (no máx. 1x a cada 30 s).
export function LocationReporter({ userId }: { userId: string }) {
  const [ativo, setAtivo] = useState(false)
  const ultimo = useRef(0)
  const recusou = useRef(false)
  const semGpsTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!userId || typeof navigator === 'undefined') return
    const semGps = () => { fetch('/api/localizacao', { method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true, body: JSON.stringify({ semGps: true }) }).catch(() => {}) }
    if (!('geolocation' in navigator)) { semGps(); const t = setInterval(semGps, 60_000); return () => clearInterval(t) }
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
      err => {
        setAtivo(false)
        // Só usa a posição aproximada (rede) se a pessoa RECUSOU a localização. Se o GPS só demorou, espera pela próxima leitura.
        if (err.code === 1 && !recusou.current) { recusou.current = true; semGps(); semGpsTimer.current = setInterval(semGps, 60_000) }
      },
      { enableHighAccuracy: true, maximumAge: 20_000, timeout: 30_000 },
    )
    return () => { navigator.geolocation.clearWatch(id); if (semGpsTimer.current) clearInterval(semGpsTimer.current) }
  }, [userId])

  if (!ativo) return null
  return <span title="A tua localização está a ser partilhada com a empresa enquanto a app está aberta" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#047857' }}><MapPin size={12} /> localização ativa</span>
}
