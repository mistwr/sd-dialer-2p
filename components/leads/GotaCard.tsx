'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { Droplets } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// Gota-a-gota: cada parceiro recebe leads novas todas as manhãs até ao máximo, quando desce abaixo do mínimo.
export default function GotaCard({ companyId }: { companyId?: string | null }) {
  const sb = createClient()
  const { data, mutate } = useSWR(companyId ? ['gota', companyId] : null, async () => {
    const { data } = await sb.from('companies').select('gota_ativo, gota_maximo, gota_minimo').eq('id', String(companyId)).single()
    return data as { gota_ativo: boolean; gota_maximo: number; gota_minimo: number } | null
  })
  const [ativo, setAtivo] = useState(false)
  const [maximo, setMaximo] = useState('60')
  const [minimo, setMinimo] = useState('20')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!data) return
    setAtivo(!!data.gota_ativo)
    setMaximo(String(data.gota_maximo ?? 60))
    setMinimo(String(data.gota_minimo ?? 20))
  }, [data])

  if (!companyId) return null

  async function guardar() {
    setBusy(true); setMsg(null)
    const { error } = await sb.rpc('set_gota_config', { p_company_id: companyId, p_ativo: ativo, p_maximo: Number(maximo) || 60, p_minimo: Number(minimo) || 20 })
    setBusy(false)
    setMsg(error ? `Erro: ${error.message}` : 'Guardado.')
    mutate()
  }

  async function devolver() {
    if (!confirm(`Devolver ao stock as leads novas que cada parceiro tem acima de ${maximo}? (só leads ainda por ligar)`)) return
    setBusy(true); setMsg(null)
    const { data: n, error } = await sb.rpc('devolver_excesso_leads', { p_company_id: companyId })
    setBusy(false)
    setMsg(error ? `Erro: ${error.message}` : `${n ?? 0} leads devolvidas ao stock.`)
  }

  const input = { width: 80, padding: '7px 10px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 14 } as const

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: '20px 24px', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Droplets size={17} color="#2563EB" />
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0F172A' }}>Distribuição gota-a-gota</h2>
      </div>
      <p style={{ color: '#64748B', fontSize: 13, margin: '0 0 14px' }}>
        Todas as manhãs (seg–sáb, 07:30) cada parceiro com menos de <b>mínimo</b> leads novas recebe até ficar com o <b>máximo</b>. Evita parceiros com milhares de leads paradas.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600 }}>
          <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} /> Ativo
        </label>
        <label style={{ fontSize: 13, color: '#374151' }}>Máximo <input style={input} type="number" min={1} value={maximo} onChange={e => setMaximo(e.target.value)} /></label>
        <label style={{ fontSize: 13, color: '#374151' }}>Mínimo <input style={input} type="number" min={0} value={minimo} onChange={e => setMinimo(e.target.value)} /></label>
        <button disabled={busy} onClick={guardar} style={{ background: '#2563EB', color: '#fff', border: 0, borderRadius: 8, padding: '8px 14px', fontWeight: 700, cursor: 'pointer' }}>Guardar</button>
        <button disabled={busy} onClick={devolver} style={{ background: '#fff', color: '#B45309', border: '1px solid #FCD34D', borderRadius: 8, padding: '8px 14px', fontWeight: 700, cursor: 'pointer' }}>Devolver excesso</button>
      </div>
      {msg && <div style={{ marginTop: 10, fontSize: 13, color: msg.startsWith('Erro') ? '#B91C1C' : '#15803D' }}>{msg}</div>}
    </div>
  )
}
