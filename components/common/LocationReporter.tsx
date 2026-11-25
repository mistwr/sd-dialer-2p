'use client'
import { useEffect, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'

// Envia a posição do utilizador enquanto a app está aberta (no máx. 1x a cada 30 s).
export function LocationReporter({ userId }: { userId: string }) {
  const [ativo, setAtivo] = useState(false)
  const ultimo = useRef(0)

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
      () => { setAtivo(false); semGps() },
      { enableHighAccuracy: true, maximumAge: 20_000, timeout: 30_000 },
    )
    // batimento: mesmo parado, renova a posição de 60 em 60 s enquanto a app está visível
    const enviar = () => {
      if (document.visibilityState !== 'visible') return
      navigator.geolocation.getCurrentPosition(pos => {
        ultimo.current = Date.now()
        fetch('/api/localizacao', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
          body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        }).then(r => setAtivo(r.ok)).catch(() => setAtivo(false))
      }, () => {}, { enableHighAccuracy: false, maximumAge: 30_000, timeout: 20_000 })
    }
    const hb = setInterval(enviar, 60_000)
    document.addEventListener('visibilitychange', enviar)
    return () => { navigator.geolocation.clearWatch(id); clearInterval(hb); document.removeEventListener('visibilitychange', enviar) }
  }, [userId])

  if (!ativo) return null
  return <span title="A tua localização está a ser partilhada com a empresa enquanto a app está aberta" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#047857' }}><MapPin size={12} /> localização ativa</span>
}
