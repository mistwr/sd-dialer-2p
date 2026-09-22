'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Activity, MousePointerClick, Sparkles, UserPlus,
  MessageCircle, Bot, TrendingUp, RefreshCw, ExternalLink,
  CircleDollarSign, CreditCard,
} from 'lucide-react'
import { PageSpinner } from '@/components/ui/Spinner'
import { StatCard } from '@/components/ui/StatCard'

type FunnelRow = { key: string; label: string; value: number; sessions: number }
type SourceRow = {
  source: string
  sessions: number
  pageViews: number
  simulationClicks: number
  simulationResults: number
  leadSubmits: number
  whatsappClicks: number
  robotClicks: number
  resultRate: number
  leadRate: number
}
type CreativeRow = {
  source: string
  campaign: string
  content: string
  sessions: number
  pageViews: number
  simulationClicks: number
  simulationResults: number
  leadSubmits: number
  resultRate: number
  leadRate: number
}
type RevenueRow = {
  id: string
  event_type: 'payment' | 'subscription'
  status: string
  amount: number | null
  currency: string
  customer_email_masked: string | null
  occurred_at: string
  matched_to_lead: boolean
}
type LeadRow = {
  id: string
  nome: string
  empresa: string
  status: string
  created_at: string
  source: string
  campaign: string
  content: string
  problem: string
  result: string
}
type GrowthData = {
  days: number
  totals: {
    sessions: number
    pageViews: number
    simulationClicks: number
    simulationResults: number
    leadSubmits: number
    confirmedLeads: number
    confirmedLeadSessions: number
    whatsappClicks: number
    robotClicks: number
    proClicks: number
    checkoutClicks: number
    verifiedPayments: number
    activeSubscriptions: number
  }
  revenue: {
    byCurrency: Record<string, number>
    recent: RevenueRow[]
  }
  funnel: FunnelRow[]
  sources: SourceRow[]
  creatives: CreativeRow[]
  recentLeads: LeadRow[]
}

function pct(a: number, b: number) {
  if (!b) return '0%'
  return ((a / b) * 100).toFixed(1) + '%'
}

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: currency || 'EUR' }).format(amount)
  } catch {
    return amount.toFixed(2) + ' ' + (currency || 'EUR')
  }
}

function sourceLabel(source: string) {
  if (source === '(direct)') return 'Direto'
  if (source.includes('facebook')) return 'Facebook'
  if (source.includes('instagram')) return 'Instagram'
  if (source.includes('tiktok')) return 'TikTok'
  if (source.includes('google')) return 'Google'
  return source
}

export default function LuminGrowthPage() {
  const [days, setDays] = useState(7)
  const [data, setData] = useState<GrowthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const r = await fetch('/api/lumin/growth?days=' + days, { cache: 'no-store' })
      const body = await r.json()
      if (!r.ok) throw new Error(body.error || 'Erro ao carregar dados')
      setData(body)
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [days])

  const maxFunnel = useMemo(
    () => Math.max(...(data?.funnel.map(x => x.value) || [1]), 1),
    [data]
  )

  if (loading && !data) return <PageSpinner />

  return (
    <div className="anim-fade-in" style={{ maxWidth: 1180 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <Sparkles size={20} color="#7C3AED" />
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', margin: 0 }}>LUMIN Growth</h1>
          </div>
          <p style={{ color: '#64748B', margin: '5px 0 0', fontSize: 14 }}>
            Redes sociais → simulação → resultado → lead → CRM
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {[1, 7, 30].map(v => (
            <button
              key={v}
              onClick={() => setDays(v)}
              style={{
                border: '1px solid ' + (days === v ? '#7C3AED' : '#E2E8F0'),
                background: days === v ? '#F5F3FF' : '#fff',
                color: days === v ? '#6D28D9' : '#475569',
                borderRadius: 8, padding: '8px 11px', fontSize: 12, fontWeight: 700, cursor: 'pointer'
              }}
            >
              {v === 1 ? 'Hoje' : v + ' dias'}
            </button>
          ))}
          <button
            onClick={load}
            aria-label="Atualizar"
            style={{ border: '1px solid #E2E8F0', background: '#fff', borderRadius: 8, padding: 8, cursor: 'pointer', color: '#475569', display: 'flex' }}
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 18, padding: '12px 14px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: 13 }}>
          {error}
        </div>
      )}

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 24 }}>
            <StatCard label="Sessões" value={data.totals.sessions} icon={Activity} color="#2563EB" />
            <StatCard label="Simulações" value={data.totals.simulationClicks} icon={MousePointerClick} color="#D97706" />
            <StatCard label="Resultados vistos" value={data.totals.simulationResults} icon={Sparkles} color="#7C3AED" />
            <StatCard label="Leads CRM" value={data.totals.confirmedLeads} icon={UserPlus} color="#16A34A" />
            <StatCard label="WhatsApp" value={data.totals.whatsappClicks} icon={MessageCircle} color="#059669" />
            <StatCard label="Robot LUMIN" value={data.totals.robotClicks} icon={Bot} color="#0891B2" />
            <StatCard label="Pagamentos verificados" value={data.totals.verifiedPayments} icon={CircleDollarSign} color="#16A34A" />
            <StatCard label="Subscrições ativas" value={data.totals.activeSubscriptions} icon={CreditCard} color="#0F766E" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(320px, .75fr)', gap: 18, marginBottom: 24 }}>
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                <TrendingUp size={18} color="#7C3AED" />
                <h2 style={{ margin: 0, fontSize: 16, color: '#0F172A' }}>Funil real</h2>
              </div>
              <div style={{ display: 'grid', gap: 14 }}>
                {data.funnel.map((row, i) => {
                  const prev = i > 0 ? data.funnel[i - 1].value : row.value
                  return (
                    <div key={row.key}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>{row.label}</div>
                        <div style={{ fontSize: 13, color: '#64748B' }}>
                          <strong style={{ color: '#0F172A' }}>{row.value}</strong>
                          {i > 0 && <span> · {pct(row.value, prev)} do passo anterior</span>}
                        </div>
                      </div>
                      <div style={{ height: 10, borderRadius: 999, background: '#F1F5F9', overflow: 'hidden' }}>
                        <div style={{
                          width: Math.max(3, (row.value / maxFunnel) * 100) + '%',
                          height: '100%',
                          borderRadius: 999,
                          background: i === data.funnel.length - 1 ? '#16A34A' : '#7C3AED',
                          transition: 'width .25s ease'
                        }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div style={{ background: '#0F172A', color: '#fff', borderRadius: 16, padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#C4B5FD', textTransform: 'uppercase', letterSpacing: .7 }}>Objetivo</div>
              <h2 style={{ margin: '8px 0 10px', fontSize: 24, lineHeight: 1.15 }}>Primeiro cliente vindo das redes</h2>
              <p style={{ color: '#CBD5E1', fontSize: 13, lineHeight: 1.55, margin: 0 }}>
                O painel separa curiosidade de intenção. O número mais importante neste momento é quantas pessoas chegam ao resultado e depois deixam contacto.
              </p>
              <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid #334155', display: 'grid', gap: 8, fontSize: 13 }}>
                <div>Resultado → lead: <strong>{pct(data.totals.leadSubmits, data.totals.simulationResults)}</strong></div>
                <div>Simulação → resultado: <strong>{pct(data.totals.simulationResults, data.totals.simulationClicks)}</strong></div>
                <div>Visita → simulação: <strong>{pct(data.totals.simulationClicks, data.totals.pageViews)}</strong></div>
              </div>
              <a href="https://luminai.pt/simulacao-gratis/" target="_blank" rel="noopener noreferrer" style={{
                marginTop: 18, display: 'inline-flex', alignItems: 'center', gap: 7, color: '#111827',
                background: '#FDE68A', borderRadius: 9, padding: '9px 12px', fontSize: 12, fontWeight: 800, textDecoration: 'none'
              }}>
                Abrir simulação <ExternalLink size={14} />
              </a>
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden', marginBottom: 24 }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #F1F5F9' }}>
              <h2 style={{ margin: 0, fontSize: 16, color: '#0F172A' }}>Por origem</h2>
              <div style={{ color: '#64748B', fontSize: 12, marginTop: 3 }}>A origem fica preservada durante a sessão.</div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', color: '#64748B', fontSize: 11, textAlign: 'left' }}>
                    {['Origem','Sessões','Visitas','Simulação','Resultado','Leads','WhatsApp','Robot'].map(h => <th key={h} style={{ padding: '10px 14px', fontWeight: 800 }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {data.sources.length === 0 ? (
                    <tr><td colSpan={8} style={{ padding: 28, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>Ainda sem dados atribuídos neste período.</td></tr>
                  ) : data.sources.map(row => (
                    <tr key={row.source} style={{ borderTop: '1px solid #F1F5F9', fontSize: 13, color: '#334155' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 800, color: '#0F172A' }}>{sourceLabel(row.source)}</td>
                      <td style={{ padding: '12px 14px' }}>{row.sessions}</td>
                      <td style={{ padding: '12px 14px' }}>{row.pageViews}</td>
                      <td style={{ padding: '12px 14px' }}>{row.simulationClicks}</td>
                      <td style={{ padding: '12px 14px' }}>{row.simulationResults}</td>
                      <td style={{ padding: '12px 14px', fontWeight: 800, color: row.leadSubmits ? '#16A34A' : '#64748B' }}>{row.leadSubmits}</td>
                      <td style={{ padding: '12px 14px' }}>{row.whatsappClicks}</td>
                      <td style={{ padding: '12px 14px' }}>{row.robotClicks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden', marginBottom: 24 }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #F1F5F9' }}>
              <h2 style={{ margin: 0, fontSize: 16, color: '#0F172A' }}>Campanhas e criativos</h2>
              <div style={{ color: '#64748B', fontSize: 12, marginTop: 3 }}>UTM campaign + content: mostra qual publicação está a empurrar pessoas mais fundo no funil.</div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', color: '#64748B', fontSize: 11, textAlign: 'left' }}>
                    {['Origem','Campanha','Criativo','Sessões','Simulação','Resultado','Leads','Res.→Lead'].map(h => <th key={h} style={{ padding: '10px 14px', fontWeight: 800 }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {data.creatives.length === 0 ? (
                    <tr><td colSpan={8} style={{ padding: 28, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>Ainda sem UTMs suficientes para comparar criativos.</td></tr>
                  ) : data.creatives.map((row, i) => (
                    <tr key={[row.source,row.campaign,row.content,i].join('-')} style={{ borderTop: '1px solid #F1F5F9', fontSize: 13, color: '#334155' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 800, color: '#0F172A' }}>{sourceLabel(row.source)}</td>
                      <td style={{ padding: '12px 14px' }}>{row.campaign}</td>
                      <td style={{ padding: '12px 14px', maxWidth: 240, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={row.content}>{row.content}</td>
                      <td style={{ padding: '12px 14px' }}>{row.sessions}</td>
                      <td style={{ padding: '12px 14px' }}>{row.simulationClicks}</td>
                      <td style={{ padding: '12px 14px' }}>{row.simulationResults}</td>
                      <td style={{ padding: '12px 14px', fontWeight: 800, color: row.leadSubmits ? '#16A34A' : '#64748B' }}>{row.leadSubmits}</td>
                      <td style={{ padding: '12px 14px', fontWeight: 700 }}>{row.leadRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden', marginBottom: 24 }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 16, color: '#0F172A' }}>Receita verificada</h2>
                <div style={{ color: '#64748B', fontSize: 12, marginTop: 3 }}>Só entram pagamentos ou subscrições confirmados a partir do Stripe.</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {Object.entries(data.revenue.byCurrency).length === 0 ? (
                  <span style={{ fontSize: 12, color: '#94A3B8' }}>Ainda sem receita verificada</span>
                ) : Object.entries(data.revenue.byCurrency).map(([currency, amount]) => (
                  <span key={currency} style={{ fontSize: 13, fontWeight: 800, color: '#166534', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 999, padding: '6px 10px' }}>
                    {money(amount, currency)}
                  </span>
                ))}
              </div>
            </div>
            {data.revenue.recent.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>À espera do primeiro pagamento LUMIN confirmado no Stripe.</div>
            ) : (
              data.revenue.recent.map((event, i) => (
                <div key={event.id} style={{ padding: '13px 20px', borderTop: i ? '1px solid #F1F5F9' : 'none', display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 800, color: '#0F172A', fontSize: 13 }}>
                      {event.event_type === 'payment' ? 'Pagamento' : 'Subscrição'} · {event.status}
                      {event.amount != null && event.currency ? ' · ' + money(event.amount, event.currency) : ''}
                    </div>
                    <div style={{ color: '#64748B', fontSize: 12, marginTop: 3 }}>
                      {event.matched_to_lead ? 'Ligado a lead CRM' : 'Sem correspondência CRM'}
                      {event.customer_email_masked ? ' · ' + event.customer_email_masked : ''}
                    </div>
                  </div>
                  <div style={{ color: '#94A3B8', fontSize: 11 }}>{new Date(event.occurred_at).toLocaleString('pt-PT')}</div>
                </div>
              ))
            )}
          </div>

          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #F1F5F9' }}>
              <h2 style={{ margin: 0, fontSize: 16, color: '#0F172A' }}>Leads LUMIN recentes</h2>
              <div style={{ color: '#64748B', fontSize: 12, marginTop: 3 }}>Só aparecem contactos efetivamente guardados no CRM.</div>
            </div>
            {data.recentLeads.length === 0 ? (
              <div style={{ padding: 34, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>À espera da primeira lead das redes.</div>
            ) : (
              data.recentLeads.map((lead, i) => (
                <div key={lead.id} style={{ padding: '13px 20px', borderTop: i ? '1px solid #F1F5F9' : 'none', display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 800, color: '#0F172A', fontSize: 13 }}>{lead.nome}{lead.empresa ? ' · ' + lead.empresa : ''}</div>
                    <div style={{ color: '#64748B', fontSize: 12, marginTop: 3 }}>{sourceLabel(lead.source)}{lead.campaign ? ' · ' + lead.campaign : ''}{lead.content ? ' · ' + lead.content : ''}</div>
                    {lead.problem && <div style={{ color: '#475569', fontSize: 12, marginTop: 3 }}>{lead.problem}</div>}
                  </div>
                  <div style={{ color: '#94A3B8', fontSize: 11 }}>{new Date(lead.created_at).toLocaleString('pt-PT')}</div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      <style>{`
        @media (max-width: 820px) {
          div[style*="grid-template-columns: minmax(0, 1.25fr)"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
