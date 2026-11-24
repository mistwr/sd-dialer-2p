'use client'
import { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import { MapPin, RefreshCw } from 'lucide-react'

type Pessoa = { user_id: string; nome: string; role: string; empresa?: string | null; lat: number; lng: number; accuracy: number | null; updated_at: string }

const minAtras = (iso: string) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
const cor = (m: number) => (m <= 2 ? '#16A34A' : m <= 15 ? '#D97706' : '#94A3B8')
const txt = (m: number) => (m < 1 ? 'agora' : m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : `há ${Math.round(m / 1440)} d`)

export default function EquipaNoMapaPage() {
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [erro, setErro] = useState('')
  const mapaRef = useRef<HTMLDivElement>(null)
  const mapa = useRef<any>(null)
  const camada = useRef<any>(null)
  const L = useRef<any>(null)
  const centrado = useRef(false)

  async function carregar() {
    try {
      const r = await fetch('/api/localizacao', { cache: 'no-store' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d?.error || 'Não foi possível carregar.')
      setPessoas(d.pessoas || []); setErro('')
    } catch (e: any) { setErro(e?.message || 'Erro') }
  }

  useEffect(() => { carregar(); const t = setInterval(carregar, 15_000); return () => clearInterval(t) }, [])

  useEffect(() => {
    let cancelado = false
    ;(async () => {
      if (mapa.current || !mapaRef.current) return
      const leaflet = (await import('leaflet')).default
      if (cancelado || !mapaRef.current) return
      L.current = leaflet
      mapa.current = leaflet.map(mapaRef.current).setView([41.15, -8.61], 11)
      leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(mapa.current)
      camada.current = leaflet.layerGroup().addTo(mapa.current)
      setPessoas(p => [...p])
    })()
    return () => { cancelado = true; if (mapa.current) { mapa.current.remove(); mapa.current = null } }
  }, [])

  useEffect(() => {
    if (!mapa.current || !camada.current || !L.current) return
    camada.current.clearLayers()
    const pts: [number, number][] = []
    pessoas.forEach(p => {
      const m = minAtras(p.updated_at)
      L.current.circleMarker([p.lat, p.lng], { radius: 10, color: '#fff', weight: 2, fillColor: cor(m), fillOpacity: 1 })
        .bindTooltip(`${p.nome}${p.accuracy && p.accuracy >= 5000 ? ' (aprox.)' : ''} · ${txt(m)}`, { permanent: true, direction: 'top', offset: [0, -8] }).addTo(camada.current)
      pts.push([p.lat, p.lng])
    })
    if (pts.length && !centrado.current) { mapa.current.fitBounds(pts, { padding: [50, 50], maxZoom: 15 }); centrado.current = true }
  }, [pessoas])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, display: 'flex', gap: 8, alignItems: 'center' }}><MapPin size={22} color="#2563EB" /> Equipa no mapa</h1>
          <p style={{ fontSize: 13, color: '#64748B', margin: '4px 0 0' }}>Atualiza sozinho de 15 em 15 s. A posição é enviada enquanto o utilizador tem a app aberta. Verde: agora · Laranja: até 15 min · Cinza: mais antigo.</p>
        </div>
        <button onClick={carregar} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', border: '1px solid #E2E8F0', background: '#fff', borderRadius: 999, padding: '8px 14px', cursor: 'pointer' }}><RefreshCw size={14} /> Atualizar</button>
      </div>
      {erro && <div style={{ color: '#B91C1C', marginBottom: 10 }}>{erro}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <div ref={mapaRef} style={{ gridColumn: 'span 2', minHeight: 460, borderRadius: 14, border: '1px solid #E2E8F0', zIndex: 0 }} />
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 14, alignSelf: 'start' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Pessoas ({pessoas.length})</div>
          {pessoas.length === 0 && <div style={{ fontSize: 13, color: '#94A3B8' }}>Ainda ninguém partilhou posição. Cada utilizador tem de abrir a app e aceitar a permissão de localização do telemóvel.</div>}
          {[...pessoas].sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at)).map(p => {
            const m = minAtras(p.updated_at)
            return (
              <div key={p.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: '1px solid #F1F5F9' }}>
                <span style={{ width: 10, height: 10, borderRadius: 999, background: cor(m) }} />
                <div style={{ flex: 1, fontSize: 13 }}><b>{p.nome}</b><div style={{ color: '#94A3B8', fontSize: 12 }}>{p.empresa ? p.empresa + ' · ' : ''}{p.role} · {txt(m)}{p.accuracy && p.accuracy >= 5000 ? ' · aprox. (cidade)' : ''}</div></div>
                <a href={`https://www.google.com/maps?q=${p.lat},${p.lng}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#2563EB', fontWeight: 700 }}>Google Maps</a>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
