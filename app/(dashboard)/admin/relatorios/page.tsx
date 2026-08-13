'use client'
import { useState, useEffect } from 'react'
import { BarChart2, PhoneCall, Clock, TrendingUp, CheckCircle, Download, Users2, Target, PhoneIncoming, Hourglass, ThumbsDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { PageSpinner } from '@/components/ui/Spinner'
import { StatCard } from '@/components/ui/StatCard'
import type { CallResult } from '@/lib/types'

const RESULT_LABELS: Record<CallResult, string> = {
  venda: 'Venda', nao_interessado: 'Nao Interessado', nao_atende: 'Nao Atende',
  numero_errado: 'Num. Errado', ligar_depois: 'Ligar Depois', sem_cobertura: 'Sem Cobertura', outro: 'Outro',
}
const RESULT_COLORS: Record<CallResult, string> = {
  venda: '#16A34A', nao_interessado: '#DC2626', nao_atende: '#6B7280',
  numero_errado: '#8B5CF6', ligar_depois: '#0891B2', sem_cobertura: '#EA580C', outro: '#94A3B8',
}

function fmtTime(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${sec % 60}s`
}

function todayStr() { return new Date().toISOString().slice(0, 10) }
function pastStr(days: number) {
  const d = new Date(); d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

export default function RelatoriosPage() {
  const { profile, loading: authLoading } = useAuth()
  const [from, setFrom] = useState(pastStr(30))
  const [to, setTo] = useState(todayStr())
  const [groupBy, setGroupBy] = useState<'comercial' | 'equipa' | 'campanha'>('comercial')
  const [calls, setCalls] = useState<any[]>([])
  const [equipe, setEquipe] = useState<{ id: string; full_name: string; equipa: string | null; meta_ligacoes_dia: number }[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!profile?.company_id) return
    const fetchData = async () => {
      setLoading(true)
      const sb = createClient()
      const [{ data: callsData }, { data: usersData }] = await Promise.all([
        sb.from('call_history')
          .select('*, parceiro:parceiro_id(id,full_name,equipa), lead:lead_id(nome,telefone,campanha_id,campanhas(name))')
          .eq('company_id', profile.company_id!)
          .gte('called_at', from + 'T00:00:00')
          .lte('called_at', to + 'T23:59:59')
          .order('called_at', { ascending: false }),
        sb.from('usuarios').select('id, full_name, equipa, meta_ligacoes_dia').eq('company_id', profile.company_id!).eq('role', 'parceiro'),
      ])
      setCalls(callsData ?? [])
      setEquipe(usersData ?? [])
      setLoading(false)
    }
    fetchData()
  }, [profile, from, to])

  const total = calls.length
  const atendidas = calls.filter(c => c.result !== 'nao_atende').length
  const interessados = calls.filter(c => c.result === 'ligar_depois').length
  const naoInteressados = calls.filter(c => c.result === 'nao_interessado').length
  const vendas = calls.filter(c => c.result === 'venda').length
  const totalSec = calls.reduce((s, c) => s + (c.duration_sec ?? 0), 0)
  const avgSec = total > 0 ? Math.round(totalSec / total) : 0
  const conversao = total > 0 ? ((vendas / total) * 100).toFixed(1) : '0'

  const byResult: Record<string, number> = {}
  calls.forEach(c => { byResult[c.result] = (byResult[c.result] ?? 0) + 1 })

  const grouped: Record<string, { name: string; calls: number; atendidas: number; vendas: number; sec: number }> = {}
  calls.forEach(c => {
    let key: string, name: string
    if (groupBy === 'comercial') {
      key = c.parceiro?.id ?? 'unknown'; name = c.parceiro?.full_name ?? 'Desconhecido'
    } else if (groupBy === 'equipa') {
      key = c.parceiro?.equipa ?? 'sem-equipa'; name = c.parceiro?.equipa ?? 'Sem equipa'
    } else {
      key = c.lead?.campanha_id ?? 'sem-campanha'; name = c.lead?.campanhas?.name ?? 'Sem campanha'
    }
    if (!grouped[key]) grouped[key] = { name, calls: 0, atendidas: 0, vendas: 0, sec: 0 }
    grouped[key].calls++
    grouped[key].sec += c.duration_sec ?? 0
    if (c.result !== 'nao_atende') grouped[key].atendidas++
    if (c.result === 'venda') grouped[key].vendas++
  })
  const ranking = Object.values(grouped).sort((a, b) => b.vendas - a.vendas || b.calls - a.calls)

  const today = todayStr()
  const callsToday: Record<string, number> = {}
  calls.forEach(c => {
    if (c.called_at.slice(0, 10) !== today) return
    const id = c.parceiro?.id
    if (!id) return
    callsToday[id] = (callsToday[id] ?? 0) + 1
  })
  const metaEquipe = equipe.map(u => {
    const feitas = callsToday[u.id] ?? 0
    const meta = u.meta_ligacoes_dia || 150
    return { ...u, feitas, meta, pct: Math.min(100, Math.round((feitas / meta) * 100)) }
  }).sort((a, b) => b.pct - a.pct)

  const exportCSV = () => {
    const header = 'Data,Parceiro,Equipa,Lead,Campanha,Resultado,Duracao (s),Notas'
    const rows = calls.map(c =>
      `"${new Date(c.called_at).toLocaleString('pt-PT')}","${c.parceiro?.full_name ?? ''}","${c.parceiro?.equipa ?? ''}","${c.lead?.nome ?? ''}","${c.lead?.campanhas?.name ?? ''}","${c.result}","${c.duration_sec ?? 0}","${c.notes ?? ''}"`
    )
    const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `relatorio-${from}-${to}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  if (authLoading) return <PageSpinner />

  return (
    <div className="anim-fade-in" style={{ maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0 }}>Relatorios</h1>
          <p style={{ color: '#64748B', fontSize: 14, margin: '3px 0 0' }}>Analise de chamadas e desempenho</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none' }} />
          <span style={{ color: '#94A3B8', fontSize: 13 }}>ate</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none' }} />
          <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: '#F8FAFC', color: '#64748B', border: '1.5px solid #E2E8F0', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            <Download size={14} /> Exportar
          </button>
        </div>
      </div>

      {loading ? <PageSpinner /> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 14, marginBottom: 20 }}>
            <StatCard label="Ligacoes Feitas"        value={total}           icon={PhoneCall}    color="#2563EB" />
            <StatCard label="Pessoas Atendidas"      value={atendidas}       icon={PhoneIncoming} color="#0891B2" />
            <StatCard label="Interessados/Pendentes" value={interessados}    icon={Hourglass}    color="#D97706" />
            <StatCard label="Nao Interessados"       value={naoInteressados} icon={ThumbsDown}   color="#DC2626" />
            <StatCard label="Vendas Feitas"          value={vendas}          icon={CheckCircle}  color="#16A34A" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 14, marginBottom: 28 }}>
            <StatCard label="Taxa Conversao"  value={`${conversao}%`}  icon={TrendingUp}  color="#16A34A" />
            <StatCard label="Tempo Total"     value={fmtTime(totalSec)} icon={Clock}       color="#8B5CF6" />
            <StatCard label="Tempo Medio"     value={fmtTime(avgSec)}   icon={Clock}       color="#D97706" />
          </div>

          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: '20px 24px', marginBottom: 28, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Target size={16} color="#D97706" /> Objetivo Diario de Ligacoes
            </h2>
            <p style={{ fontSize: 12, color: '#94A3B8', margin: '0 0 16px' }}>Progresso de hoje face a meta de cada comercial</p>
            {metaEquipe.length === 0 ? (
              <div style={{ color: '#94A3B8', fontSize: 14, textAlign: 'center', padding: '16px 0' }}>Sem comerciais ativos</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {metaEquipe.map(u => (
                  <div key={u.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{u.full_name}</span>
                      <span style={{ fontSize: 12, color: '#64748B' }}>{u.feitas} / {u.meta} <strong style={{ color: u.pct >= 100 ? '#16A34A' : '#0F172A' }}>({u.pct}%)</strong></span>
                    </div>
                    <div style={{ height: 8, borderRadius: 4, background: '#F1F5F9', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 4, background: u.pct >= 100 ? '#16A34A' : u.pct >= 60 ? '#D97706' : '#DC2626', width: `${u.pct}%`, transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <BarChart2 size={16} color="#2563EB" /> Resultados
              </h2>
              {!Object.keys(byResult).length ? (
                <div style={{ color: '#94A3B8', fontSize: 14, textAlign: 'center', padding: '20px 0' }}>Sem dados</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {Object.entries(byResult).sort((a, b) => b[1] - a[1]).map(([result, count]) => (
                    <div key={result}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, color: '#374151' }}>{RESULT_LABELS[result as CallResult] ?? result}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: RESULT_COLORS[result as CallResult] ?? '#64748B' }}>{count}</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: '#F1F5F9', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 3, background: RESULT_COLORS[result as CallResult] ?? '#94A3B8', width: `${Math.round((count / total) * 100)}%`, transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Users2 size={16} color="#16A34A" /> Ranking
                </h2>
                <select value={groupBy} onChange={e => setGroupBy(e.target.value as any)}
                  style={{ fontSize: 12, padding: '5px 8px', borderRadius: 7, border: '1.5px solid #E2E8F0', background: '#fff', outline: 'none', color: '#374151' }}>
                  <option value="comercial">Por Comercial</option>
                  <option value="equipa">Por Equipa</option>
                  <option value="campanha">Por Campanha</option>
                </select>
              </div>
              {!ranking.length ? (
                <div style={{ color: '#94A3B8', fontSize: 14, textAlign: 'center', padding: '20px 0' }}>Sem dados</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {ranking.slice(0, 8).map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#64748B', flexShrink: 0 }}>
                        {i + 1}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: '#94A3B8' }}>{p.calls} chamadas &middot; {p.atendidas} atendidas &middot; {fmtTime(p.sec)}</div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#16A34A' }}>{p.vendas} v</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9' }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0F172A' }}>Registo de Chamadas ({calls.length})</h2>
            </div>
            {!calls.length ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>Nenhuma chamada no periodo selecionado.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                      {['Data', 'Parceiro', 'Campanha', 'Lead', 'Resultado', 'Duracao', 'Notas'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {calls.slice(0, 100).map((c, i) => (
                      <tr key={c.id} style={{ borderBottom: i < calls.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                        <td style={{ padding: '10px 16px', fontSize: 12, color: '#64748B', whiteSpace: 'nowrap' }}>{new Date(c.called_at).toLocaleString('pt-PT')}</td>
                        <td style={{ padding: '10px 16px', fontSize: 13, color: '#374151' }}>{c.parceiro?.full_name ?? '—'}</td>
                        <td style={{ padding: '10px 16px', fontSize: 13, color: '#374151' }}>{c.lead?.campanhas?.name ?? '—'}</td>
                        <td style={{ padding: '10px 16px', fontSize: 13, color: '#374151' }}>{c.lead?.nome ?? '—'}</td>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: RESULT_COLORS[c.result as CallResult] ?? '#64748B' }}>
                            {RESULT_LABELS[c.result as CallResult] ?? c.result}
                          </span>
                        </td>
                        <td style={{ padding: '10px 16px', fontSize: 12, color: '#64748B' }}>{fmtTime(c.duration_sec ?? 0)}</td>
                        <td style={{ padding: '10px 16px', fontSize: 12, color: '#94A3B8', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.notes ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
