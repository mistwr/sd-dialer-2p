'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { authFetcher } from '@/lib/client/authFetch'

type Linha = {
  id: string; result: string; duration_sec: number; notes: string | null; called_at: string; ai_summary: string | null
  vendedor: string; empresa: string; lead: { id: string; nome: string | null; telefone: string | null } | null
}
type Resp = { chamadas: Linha[]; vendedores: { id: string; nome: string; empresa: string }[]; empresas: { id: string; nome: string }[]; limitado: boolean; error?: string }

const RES: Record<string, [string, string]> = {
  venda: ['Venda', '#16A34A'], nao_interessado: ['Não interessado', '#DC2626'], nao_atende: ['Não atende', '#64748B'],
  numero_errado: ['Número errado', '#7C3AED'], ligar_depois: ['Ligar depois', '#0891B2'], sem_cobertura: ['Sem cobertura', '#EA580C'], outro: ['Outro', '#64748B'],
  desligado: ['Desligou', '#B45309'], numero_nao_atribuido: ['Número não atribuído', '#7C3AED'], pertence_outra_pessoa: ['Pertence a outra pessoa', '#7C3AED'],
}
const sel: React.CSSProperties = { padding: '9px 10px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 13, background: '#fff', color: '#0F172A', minWidth: 0 }
const mmss = (s: number) => `${String(Math.floor((s || 0) / 60)).padStart(2, '0')}:${String((s || 0) % 60).padStart(2, '0')}`

export function HistoricoTodos() {
  const [dias, setDias] = useState('7')
  const [vendedor, setVendedor] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [resultado, setResultado] = useState('')
  const [q, setQ] = useState('')
  const qs = new URLSearchParams({ dias, vendedor, empresa, resultado, q }).toString()
  const { data, isLoading } = useSWR<Resp>(`/api/historico/todos?${qs}`, authFetcher, { revalidateOnFocus: false })
  const linhas = Array.isArray(data?.chamadas) ? data!.chamadas : []
  const vendas = linhas.filter((l) => l.result === 'venda').length
  const conversas = linhas.filter((l) => ['venda', 'ligar_depois', 'nao_interessado', 'outro'].includes(l.result)).length
  const porVendedor = Object.entries(linhas.reduce((a: Record<string, number>, l) => { a[l.vendedor] = (a[l.vendedor] || 0) + 1; return a }, {}))
    .sort((a, b) => b[1] - a[1]).slice(0, 8)

  if (data?.error) return <div style={{ color: '#B91C1C' }}>{data.error}</div>

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginBottom: 12 }}>
        <select value={dias} onChange={(e) => setDias(e.target.value)} style={sel}>
          <option value="1">Hoje (24 h)</option><option value="7">7 dias</option><option value="30">30 dias</option><option value="90">90 dias</option><option value="365">1 ano</option>
        </select>
        <select value={empresa} onChange={(e) => { setEmpresa(e.target.value); setVendedor('') }} style={sel}>
          <option value="">Todas as empresas</option>
          {(data?.empresas || []).map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
        <select value={vendedor} onChange={(e) => setVendedor(e.target.value)} style={sel}>
          <option value="">Todos os vendedores</option>
          {(data?.vendedores || []).filter((v) => !empresa || v.empresa === (data?.empresas || []).find((e) => e.id === empresa)?.nome)
            .map((v) => <option key={v.id} value={v.id}>{v.nome}{v.empresa ? ` · ${v.empresa}` : ''}</option>)}
        </select>
        <select value={resultado} onChange={(e) => setResultado(e.target.value)} style={sel}>
          <option value="">Todos os resultados</option>
          {Object.entries(RES).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Lead, telefone ou vendedor…" style={sel} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
        {[['Chamadas', linhas.length, '#4F46E5'], ['Conversas', conversas, '#0891B2'], ['Vendas', vendas, '#16A34A']].map(([l, v, c]) => (
          <div key={String(l)} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 12 }}>
            <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>{l}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: String(c) }}>{v}{data?.limitado && l === 'Chamadas' ? '+' : ''}</div>
          </div>
        ))}
      </div>

      {porVendedor.length > 1 && (
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 6 }}>Quem mais ligou neste filtro</div>
          {porVendedor.map(([n, c]) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, margin: '4px 0' }}>
              <span style={{ width: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#334155' }}>{n}</span>
              <div style={{ flex: 1, height: 8, borderRadius: 9, background: '#EEF2FF' }}><div style={{ width: `${(c / porVendedor[0][1]) * 100}%`, height: 8, borderRadius: 9, background: 'linear-gradient(90deg,#6366F1,#10B981)' }} /></div>
              <b style={{ width: 36, textAlign: 'right', color: '#0F172A' }}>{c}</b>
            </div>
          ))}
        </div>
      )}

      {isLoading && <div style={{ color: '#64748B' }}>A carregar…</div>}
      {!isLoading && linhas.length === 0 && <div style={{ color: '#64748B', padding: 16, textAlign: 'center' }}>Sem chamadas neste filtro.</div>}
      {data?.limitado && <div style={{ fontSize: 12, color: '#92400E', marginBottom: 8 }}>A mostrar as 1000 chamadas mais recentes. Usa os filtros para afinar.</div>}

      <div style={{ display: 'grid', gap: 8 }}>
        {linhas.map((l) => {
          const [rl, rc] = RES[l.result] || [l.result, '#64748B']
          return (
            <div key={l.id} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 800, color: '#0F172A' }}>{l.lead?.nome || 'Lead'} <span style={{ fontWeight: 500, color: '#64748B', fontSize: 13 }}>{l.lead?.telefone || ''}</span></div>
                <span style={{ fontSize: 12, fontWeight: 800, color: rc, background: rc + '14', padding: '3px 8px', borderRadius: 999 }}>{rl}</span>
              </div>
              <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 3 }}>
                {l.vendedor} · {l.empresa} · {new Date(l.called_at).toLocaleString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · {mmss(l.duration_sec)}
              </div>
              {(l.notes || l.ai_summary) && <div style={{ fontSize: 13, color: '#334155', marginTop: 5 }}>{l.notes || l.ai_summary}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
