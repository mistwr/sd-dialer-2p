'use client'
import useSWR from 'swr'
import {
  PhoneCall, Users, TrendingUp, Clock, CheckCircle2,
  PhoneOff, PhoneMissed, BarChart2,
} from 'lucide-react'
import { StatCard } from '@/components/ui/StatCard'
import { Spinner } from '@/components/ui/Spinner'
import { useAuth } from '@/lib/hooks/useAuth'
import { callHistoryService, usuarioService } from '@/lib/services'

function fmt(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export default function SupervisorPage() {
  const { profile } = useAuth()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data: parceiros = [], isLoading: loadingP } = useSWR(
    profile?.company_id ? ['parceiros', profile.company_id] : null,
    () => usuarioService.getByCompany(profile!.company_id!),
  )

  const { data: calls = [], isLoading: loadingC } = useSWR(
    profile?.company_id ? ['all-calls', profile.company_id] : null,
    () => callHistoryService.getStats(profile!.company_id!),
  )

  const todayCalls = calls.filter(c => new Date(c.called_at) >= today)
  const totalDur   = calls.reduce((s: number, c: {duration_sec: number}) => s + c.duration_sec, 0)
  const todayDur   = todayCalls.reduce((s: number, c: {duration_sec: number}) => s + c.duration_sec, 0)
  const sales      = calls.filter((c: {result: string}) => c.result === 'venda').length
  const conversion = calls.length > 0 ? ((sales / calls.length) * 100).toFixed(1) : '0.0'

  // Per-parceiro stats
  const parceiroStats = parceiros.filter(p => p.role === 'parceiro').map(p => {
    const pCalls = calls.filter((c: {parceiro_id: string}) => c.parceiro_id === p.id)
    const pSales = pCalls.filter((c: {result: string}) => c.result === 'venda').length
    const pDur   = pCalls.reduce((s: number, c: {duration_sec: number}) => s + c.duration_sec, 0)
    const pConv  = pCalls.length > 0 ? ((pSales / pCalls.length) * 100).toFixed(0) : '0'
    return {
      id: p.id, name: p.full_name, calls: pCalls.length,
      sales: pSales, duration: pDur, conversion: pConv,
      initials: p.full_name.split(' ').map((w: string) => w[0]).slice(0,2).join('').toUpperCase(),
    }
  }).sort((a, b) => b.sales - a.sales)

  const loading = loadingP || loadingC

  return (
    <div className="anim-fade-in">
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', margin: 0 }}>Supervisao</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748B' }}>
            Monitorizacao em tempo real da equipa
          </p>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <Spinner size={32} />
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 28 }}>
              <StatCard icon={PhoneCall}   label="Chamadas Hoje"    value={todayCalls.length}      color="#2563EB" />
              <StatCard icon={BarChart2}   label="Total Chamadas"   value={calls.length}            color="#7C3AED" />
              <StatCard icon={Clock}       label="Tempo Hoje"       value={fmt(todayDur)}           color="#0891B2" />
              <StatCard icon={Clock}       label="Tempo Total"      value={fmt(totalDur)}           color="#0891B2" />
              <StatCard icon={CheckCircle2}label="Vendas"           value={sales}                   color="#16A34A" />
              <StatCard icon={TrendingUp}  label="Conversao"        value={`${conversion}%`}        color="#16A34A" />
              <StatCard icon={Users}       label="Parceiros"        value={parceiroStats.length}     color="#D97706" />
            </div>

            {/* Ranking Table */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9' }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', margin: 0 }}>Ranking da Equipa</h2>
              </div>

              {parceiroStats.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                  Nenhum parceiro com chamadas ainda
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC' }}>
                        {['#', 'Parceiro', 'Chamadas', 'Vendas', 'Conversao', 'Tempo Total'].map(h => (
                          <th key={h} style={{
                            padding: '11px 16px', textAlign: 'left',
                            fontSize: 11, fontWeight: 600, color: '#64748B',
                            textTransform: 'uppercase', letterSpacing: '0.04em',
                            borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap',
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parceiroStats.map((p, i) => (
                        <tr key={p.id} style={{
                          borderBottom: '1px solid #F1F5F9',
                          transition: 'background 0.1s',
                        }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F8FAFC' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}
                        >
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              width: 24, height: 24, borderRadius: '50%', fontSize: 12, fontWeight: 700,
                              background: i === 0 ? '#FEF9C3' : i === 1 ? '#F1F5F9' : i === 2 ? '#FEF3C7' : '#F8FAFC',
                              color: i === 0 ? '#854D0E' : '#64748B',
                            }}>
                              {i + 1}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{
                                width: 32, height: 32, borderRadius: '50%',
                                background: '#EFF6FF', color: '#2563EB',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 11, fontWeight: 700, flexShrink: 0,
                              }}>
                                {p.initials}
                              </div>
                              <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{p.name}</span>
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 600, color: '#2563EB' }}>
                            {p.calls}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              fontSize: 13, fontWeight: 700, color: '#16A34A',
                            }}>
                              <CheckCircle2 size={13} />
                              {p.sales}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{
                                height: 5, borderRadius: 3, overflow: 'hidden',
                                background: '#E2E8F0', width: 60, flexShrink: 0,
                              }}>
                                <div style={{
                                  height: '100%', borderRadius: 3,
                                  background: '#16A34A',
                                  width: `${Math.min(Number(p.conversion), 100)}%`,
                                }} />
                              </div>
                              <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>{p.conversion}%</span>
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 13, color: '#64748B' }}>
                            {fmt(p.duration)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Result Breakdown */}
            {calls.length > 0 && (
              <div style={{ marginTop: 20, background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9' }}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', margin: 0 }}>Distribuicao de Resultados</h2>
                </div>
                <div style={{ padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  {[
                    { key: 'venda',           label: 'Vendas',         color: '#16A34A', bg: '#F0FDF4', Icon: CheckCircle2 },
                    { key: 'nao_interessado', label: 'Nao Interessado',color: '#DC2626', bg: '#FEF2F2', Icon: PhoneOff },
                    { key: 'nao_atende',      label: 'Nao Atende',     color: '#6B7280', bg: '#F9FAFB', Icon: PhoneMissed },
                    { key: 'ligar_depois',    label: 'Ligar Depois',   color: '#0891B2', bg: '#ECFEFF', Icon: Clock },
                  ].map(({ key, label, color, bg, Icon }) => {
                    const count = calls.filter((c: {result: string}) => c.result === key).length
                    const pct = ((count / calls.length) * 100).toFixed(0)
                    return (
                      <div key={key} style={{
                        flex: '1 1 150px', background: bg, borderRadius: 10,
                        padding: '14px 16px', border: `1px solid ${color}20`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                          <Icon size={14} color={color} />
                          <span style={{ fontSize: 12, fontWeight: 600, color }}>{label}</span>
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>{count}</div>
                        <div style={{ fontSize: 11, color, marginTop: 4, opacity: 0.7 }}>{pct}% do total</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
  )
}
