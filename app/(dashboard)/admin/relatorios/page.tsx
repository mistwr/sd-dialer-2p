'use client'
import { useState, useEffect } from 'react'
import { BarChart2, PhoneCall, Clock, TrendingUp, CheckCircle, XCircle, Download, MapPin, Users, Heart } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { leadService } from '@/lib/services'
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
  const [tab, setTab] = useState<'chamadas' | 'porta' | 'fidelizacao' | 'porta-cliente' | 'porta-lead'>('chamadas')
  const [from, setFrom] = useState(pastStr(30))
  const [to, setTo] = useState(todayStr())
  const [calls, setCalls] = useState<any[]>([])
  const [doorReports, setDoorReports] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [criacaoEmProgresso, setCriacaoEmProgresso] = useState(false)

  useEffect(() => {
    if (!profile?.company_id) return
    const fetch = async () => {
      setLoading(true)
      const sb = createClient()
      
      const { data: callsData } = await sb
        .from('call_history')
        .select('*, parceiro:parceiro_id(id,full_name), lead:lead_id(nome,telefone)')
        .eq('company_id', profile.company_id!)
        .gte('called_at', from + 'T00:00:00')
        .lte('called_at', to + 'T23:59:59')
        .order('called_at', { ascending: false })
      setCalls(callsData ?? [])
      
      const { data: doorData } = await sb
        .from('door_reports')
        .select('*')
        .eq('company_id', profile.company_id!)
        .gte('data', from)
        .lte('data', to)
        .order('data', { ascending: false })
      setDoorReports(doorData ?? [])
      
      setLoading(false)
    }
    fetch()
  }, [profile, from, to])

  const total = calls.length
  const vendas = calls.filter(c => c.result === 'venda').length
  const totalSec = calls.reduce((s, c) => s + (c.duration_sec ?? 0), 0)
  const avgSec = total > 0 ? Math.round(totalSec / total) : 0
  const conversao = total > 0 ? ((vendas / total) * 100).toFixed(1) : '0'

  const byAddress: Record<string, { morada: string; numero_porta: string; clientes: Set<string>; fidelizados: number; contactos: number; adesoes: string[] }> = {}
  doorReports.forEach(d => {
    const key = `${d.morada}-${d.numero_porta}`
    if (!byAddress[key]) {
      byAddress[key] = { morada: d.morada || '', numero_porta: d.numero_porta || '', clientes: new Set(), fidelizados: 0, contactos: 0, adesoes: [] }
    }
    if (d.cliente_nome) byAddress[key].clientes.add(d.cliente_nome)
    if (d.fidelizada === 'sim') byAddress[key].fidelizados++
    if (d.chamadas || d.fixo_chamadas) byAddress[key].contactos++
    if (d.adesao && d.adesao !== 'nao') byAddress[key].adesoes.push(d.adesao)
  })
  
  const fidelizacaoStats = {
    total_portas: doorReports.length,
    fidelizadas: doorReports.filter(d => d.fidelizada === 'sim').length,
    nao_fidelizadas: doorReports.filter(d => d.fidelizada === 'nao').length,
    por_operadora: {} as Record<string, number>,
    adesoes_sim: doorReports.filter(d => d.adesao === 'sim').length,
    adesoes_nao: doorReports.filter(d => d.adesao === 'nao').length,
  }
  doorReports.forEach(d => {
    if (d.operadora) fidelizacaoStats.por_operadora[d.operadora] = (fidelizacaoStats.por_operadora[d.operadora] ?? 0) + 1
  })

  const portaClienteMatrix = Object.entries(byAddress).map(([key, data]) => ({
    key,
    morada: data.morada,
    numero_porta: data.numero_porta,
    clientes: Array.from(data.clientes),
    clientes_count: data.clientes.size,
    fidelizados: data.fidelizados,
    contactos: data.contactos,
    adesoes: data.adesoes,
  })).sort((a, b) => b.clientes_count - a.clientes_count)

  const portasComDados = doorReports.filter(d => 
    (d.chamadas || d.fixo_chamadas || d.telemovel_dados || d.internet_velocidade || d.tv_canais) &&
    d.cliente_nome && d.cliente_telefone
  ).map(d => ({
    porta_numero: d.numero_porta,
    morada: d.morada,
    cliente_nome: d.cliente_nome,
    cliente_telefone: d.cliente_telefone,
    codigo_postal: d.codigo_postal,
    localidade: d.localidade,
    observacoes: d.observacoes,
    fidelizada: d.fidelizada,
    adesao: d.adesao,
    data: d.data,
  }))

  const byResult: Record<string, number> = {}
  calls.forEach(c => { byResult[c.result] = (byResult[c.result] ?? 0) + 1 })

  const byParceiro: Record<string, { name: string; calls: number; vendas: number; sec: number }> = {}
  calls.forEach(c => {
    const id = c.parceiro?.id ?? 'unknown'
    if (!byParceiro[id]) byParceiro[id] = { name: c.parceiro?.full_name ?? 'Desconhecido', calls: 0, vendas: 0, sec: 0 }
    byParceiro[id].calls++
    byParceiro[id].sec += c.duration_sec ?? 0
    if (c.result === 'venda') byParceiro[id].vendas++
  })
  const ranking = Object.values(byParceiro).sort((a, b) => b.vendas - a.vendas)

  const exportCSV = () => {
    const header = 'Data,Parceiro,Lead,Resultado,Duracao (s),Notas'
    const rows = calls.map(c =>
      `"${new Date(c.called_at).toLocaleString('pt-PT')}","${c.parceiro?.full_name ?? ''}","${c.lead?.nome ?? ''}","${c.result}","${c.duration_sec ?? 0}","${c.notes ?? ''}"`
    )
    const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `relatorio-${from}-${to}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  if (authLoading) return <PageSpinner />

  return (
    <div className="anim-fade-in" style={{ maxWidth: 1200 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0 }}>Relatorios</h1>
          <p style={{ color: '#64748B', fontSize: 14, margin: '3px 0 0' }}>Analise de chamadas, porta, fidelizacao e leads</p>
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

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '2px solid #E2E8F0' }}>
        {[
          { id: 'chamadas', label: 'Chamadas', icon: PhoneCall },
          { id: 'porta', label: 'Porta', icon: MapPin },
          { id: 'fidelizacao', label: 'Fidelizacao', icon: Heart },
          { id: 'porta-cliente', label: 'Porta x Cliente', icon: Users },
          { id: 'porta-lead', label: 'Porta → Lead', icon: PhoneCall },
        ].map(tabConfig => (
          <button
            key={tabConfig.id}
            onClick={() => setTab(tabConfig.id as any)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '12px 16px',
              background: 'none',
              border: 'none',
              borderBottom: tab === tabConfig.id ? '3px solid #2563EB' : 'none',
              color: tab === tabConfig.id ? '#2563EB' : '#64748B',
              fontWeight: tab === tabConfig.id ? 700 : 500,
              fontSize: 14,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <tabConfig.icon size={16} />
            {tabConfig.label}
          </button>
        ))}
      </div>

      {loading ? <PageSpinner /> : (
        <>
          {tab === 'chamadas' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
                <StatCard label="Total Chamadas" value={total}              icon={PhoneCall}   color="#2563EB" />
                <StatCard label="Vendas"          value={vendas}            icon={CheckCircle} color="#16A34A" />
                <StatCard label="Taxa Conversao"  value={`${conversao}%`}  icon={TrendingUp}  color="#16A34A" />
                <StatCard label="Tempo Total"     value={fmtTime(totalSec)} icon={Clock}       color="#8B5CF6" />
                <StatCard label="Tempo Medio"     value={fmtTime(avgSec)}   icon={Clock}       color="#D97706" />
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
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TrendingUp size={16} color="#16A34A" /> Top Parceiros
                  </h2>
                  {!ranking.length ? (
                    <div style={{ color: '#94A3B8', fontSize: 14, textAlign: 'center', padding: '20px 0' }}>Sem dados</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {ranking.slice(0, 6).map((p, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#64748B', flexShrink: 0 }}>
                            {i + 1}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                            <div style={{ fontSize: 11, color: '#94A3B8' }}>{p.calls} chamadas &middot; {fmtTime(p.sec)}</div>
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
                  <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>Nenhuma chamada no periodo.</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                      <thead>
                        <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                          {['Data', 'Parceiro', 'Lead', 'Resultado', 'Duracao', 'Notas'].map(h => (
                            <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {calls.slice(0, 100).map((c, i) => (
                          <tr key={c.id} style={{ borderBottom: i < calls.length - 1 ? '1px solid #F1F5F9' : 'none' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FAFAFA' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                            <td style={{ padding: '10px 16px', fontSize: 12, color: '#64748B', whiteSpace: 'nowrap' }}>{new Date(c.called_at).toLocaleString('pt-PT')}</td>
                            <td style={{ padding: '10px 16px', fontSize: 13, color: '#374151' }}>{c.parceiro?.full_name ?? '—'}</td>
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

          {tab === 'porta-lead' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
                <StatCard label="Total Portas" value={doorReports.length} icon={MapPin} color="#2563EB" />
                <StatCard label="Potenciais Clientes" value={portasComDados.length} icon={Users} color="#16A34A" />
                <StatCard label="Fidelizadas" value={fidelizacaoStats.fidelizadas} icon={Heart} color="#D97706" />
                <StatCard label="Taxa Adesao" value={`${doorReports.length > 0 ? ((fidelizacaoStats.adesoes_sim / doorReports.length) * 100).toFixed(1) : 0}%`} icon={TrendingUp} color="#8B5CF6" />
              </div>

              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0F172A' }}>Portas com Dados ({portasComDados.length})</h2>
                  <button onClick={async () => {
                    if (!profile?.company_id || !portasComDados.length) return
                    if (!confirm(`Criar ${portasComDados.length} leads?`)) return
                    setCriacaoEmProgresso(true)
                    try {
                      const payload = portasComDados.map(p => ({
                        nome: p.cliente_nome,
                        telefone: p.cliente_telefone,
                        email: null,
                        morada: p.morada || null,
                        codigo_postal: p.codigo_postal || null,
                        localidade: p.localidade || null,
                        operador: null,
                        observacoes: `Porta: ${p.porta_numero}${p.observacoes ? ' | ' + p.observacoes : ''}`,
                        company_id: profile.company_id,
                        campanha_id: null,
                        status: 'novo' as const,
                        imported_at: new Date().toISOString(),
                      }))
                      await leadService.bulkInsert(payload)
                      alert(`${portasComDados.length} leads criadas!`)
                    } catch (err) {
                      alert('Erro: ' + (err instanceof Error ? err.message : 'Desconhecido'))
                    } finally {
                      setCriacaoEmProgresso(false)
                    }
                  }}
                    disabled={criacaoEmProgresso}
                    style={{ padding: '9px 16px', borderRadius: 8, background: criacaoEmProgresso ? '#D1D5DB' : '#16A34A', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, cursor: criacaoEmProgresso ? 'not-allowed' : 'pointer', opacity: criacaoEmProgresso ? 0.7 : 1 }}>
                    {criacaoEmProgresso ? 'A criar...' : 'Criar Leads'}
                  </button>
                </div>
                {!portasComDados.length ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>Nenhuma porta com dados.</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
                      <thead>
                        <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                          {['Data', 'Porta', 'Morada', 'Cliente', 'Telefone', 'Adesao', 'Fidelizada', 'Observacoes'].map(h => (
                            <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {portasComDados.slice(0, 100).map((p, i) => (
                          <tr key={i} style={{ borderBottom: i < portasComDados.length - 1 ? '1px solid #F1F5F9' : 'none' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FAFAFA' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                            <td style={{ padding: '10px 16px', fontSize: 12, color: '#64748B', whiteSpace: 'nowrap' }}>{p.data}</td>
                            <td style={{ padding: '10px 16px', fontSize: 13, color: '#374151', fontWeight: 600 }}>{p.porta_numero}</td>
                            <td style={{ padding: '10px 16px', fontSize: 12, color: '#64748B' }}>{p.morada}</td>
                            <td style={{ padding: '10px 16px', fontSize: 13, color: '#374151' }}>{p.cliente_nome}</td>
                            <td style={{ padding: '10px 16px', fontSize: 12, color: '#64748B', fontFamily: 'monospace' }}>{p.cliente_telefone}</td>
                            <td style={{ padding: '10px 16px', fontSize: 12 }}>
                              <span style={{ display: 'inline-block', padding: '4px 8px', borderRadius: 4, background: p.adesao === 'sim' ? '#D1FAE5' : '#FEE2E2', color: p.adesao === 'sim' ? '#065F46' : '#991B1B', fontWeight: 600, fontSize: 11 }}>
                                {p.adesao || '—'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 16px', fontSize: 12 }}>
                              <span style={{ display: 'inline-block', padding: '4px 8px', borderRadius: 4, background: p.fidelizada === 'sim' ? '#DBEAFE' : '#F3F4F6', color: p.fidelizada === 'sim' ? '#1E40AF' : '#4B5563', fontWeight: 600, fontSize: 11 }}>
                                {p.fidelizada || '—'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 16px', fontSize: 11, color: '#94A3B8', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.observacoes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {tab === 'porta' && (
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>
              Aba em desenvolvimento
            </div>
          )}

          {tab === 'fidelizacao' && (
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>
              Aba em desenvolvimento
            </div>
          )}

          {tab === 'porta-cliente' && (
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>
              Aba em desenvolvimento
            </div>
          )}
        </>
      )}
    </div>
  )
}
