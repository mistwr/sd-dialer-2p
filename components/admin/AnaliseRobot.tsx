'use client'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'

type Analytics = {
  days: number
  costPerMinUsd: number
  funnel: { total: number; pickedUp: number; noAnswer: number; voicemail: number; answered: number; conversations: number; qualified: number; alto: number; medio: number; baixo: number }
  cost: { billedMinutes: number; estimatedUsd: number; perQualifiedUsd: number | null; perConversationUsd: number | null }
  waste: { voicemailMinutes: number; voicemailPct: number; longCalls: number; longCallsMinutes: number; longCallsPct: number }
  hours: { hour: string; tried: number; picked: number; rate: number }[]
}

const card: React.CSSProperties = {
  background: 'linear-gradient(180deg,#FFFFFF 0%,#F8FAFC 100%)',
  border: '1px solid #E2E8F0',
  borderRadius: 16,
  padding: 18,
  boxShadow: '0 1px 2px rgba(15,23,42,.04), 0 8px 24px rgba(15,23,42,.04)',
}
const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#64748B' }
const big: React.CSSProperties = { fontSize: 32, fontWeight: 800, color: '#0F172A', lineHeight: 1.1, marginTop: 6 }

function Stat({ title, value, hint, tone }: { title: string; value: string; hint?: string; tone?: 'good' | 'warn' }) {
  const color = tone === 'warn' ? '#B45309' : tone === 'good' ? '#047857' : '#0F172A'
  return (
    <div style={card}>
      <div style={label}>{title}</div>
      <div style={{ ...big, color }}>{value}</div>
      {hint && <div style={{ fontSize: 13, color: '#64748B', marginTop: 6 }}>{hint}</div>}
    </div>
  )
}

export default function AnaliseRobot({ getToken, companies }: { getToken: () => Promise<string>; companies: { id: string; name: string }[] }) {
  const [days, setDays] = useState(14)
  const [companyId, setCompanyId] = useState('')
  const [data, setData] = useState<Analytics | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setBusy(true)
    setError('')
    try {
      const token = await getToken()
      const qs = new URLSearchParams({ days: String(days) })
      if (companyId) qs.set('companyId', companyId)
      const res = await fetch('/api/admin/voice-calls/analytics?' + qs.toString(), { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.detail || 'Não foi possível carregar a análise.')
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar a análise.')
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => { void load() }, [days, companyId])

  const f = data?.funnel
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) + '%' : '—')
  const steps = f ? [
    { name: 'Chamadas feitas', n: f.total },
    { name: 'Atendidas (humano + voicemail)', n: f.pickedUp },
    { name: 'Conversas reais', n: f.conversations },
    { name: 'Qualificados (alto + médio)', n: f.qualified },
    { name: 'Interesse alto', n: f.alto },
  ] : []
  const maxStep = Math.max(1, ...steps.map(s => s.n))
  const maxHour = Math.max(0.0001, ...(data?.hours || []).map(h => h.rate))

  return (
    <section style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <select value={days} onChange={e => setDays(Number(e.target.value))} style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid #CBD5E1' }}>
          {[7, 14, 30, 60].map(d => <option key={d} value={d}>Últimos {d} dias</option>)}
        </select>
        <select value={companyId} onChange={e => setCompanyId(e.target.value)} style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid #CBD5E1' }}>
          <option value="">Todas as empresas</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button type="button" onClick={() => void load()} disabled={busy} style={{ padding: '9px 13px', borderRadius: 10, border: '1px solid #CBD5E1', background: 'white', display: 'inline-flex', gap: 6, alignItems: 'center', fontWeight: 700 }}>
          <RefreshCw size={14} /> {busy ? 'A atualizar…' : 'Atualizar'}
        </button>
      </div>

      {error && <div role="alert" style={{ ...card, borderColor: '#FCA5A5', color: '#B91C1C' }}>{error}</div>}
      {!data && !error && <div style={{ ...card, color: '#64748B' }}>A carregar a análise…</div>}

      {data && f && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
            <Stat title="Custo estimado" value={'$' + data.cost.estimatedUsd.toFixed(2)} hint={data.cost.billedMinutes + ' min a $' + data.costPerMinUsd + '/min'} />
            <Stat title="Custo por qualificado" value={data.cost.perQualifiedUsd == null ? '—' : '$' + data.cost.perQualifiedUsd.toFixed(2)} hint={f.qualified + ' leads com interesse alto/médio'} tone="good" />
            <Stat title="Custo por conversa" value={data.cost.perConversationUsd == null ? '—' : '$' + data.cost.perConversationUsd.toFixed(2)} hint={f.conversations + ' conversas reais'} />
            <Stat title="Taxa de atendimento" value={pct(f.pickedUp, f.total)} hint={f.noAnswer + ' sem resposta'} />
          </div>

          <div style={card}>
            <div style={label}>Funil do robot</div>
            <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
              {steps.map((s, i) => (
                <div key={s.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: '#0F172A' }}>{s.name}</span>
                    <span style={{ color: '#475569' }}>{s.n}{i > 0 && steps[i - 1].n ? ' · ' + pct(s.n, steps[i - 1].n) + ' do passo anterior' : ''}</span>
                  </div>
                  <div style={{ height: 10, borderRadius: 999, background: '#E2E8F0', overflow: 'hidden' }}>
                    <div style={{ width: Math.max(2, (s.n / maxStep) * 100) + '%', height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#2563EB,#7C3AED)' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 14 }}>
            <Stat title="Minutos em voicemail" value={data.waste.voicemailMinutes + ' min'} hint={data.waste.voicemailPct + '% do tempo total faturado'} tone={data.waste.voicemailPct >= 10 ? 'warn' : undefined} />
            <Stat title="Chamadas acima de 4 min" value={String(data.waste.longCalls)} hint={data.waste.longCallsMinutes + ' min (' + data.waste.longCallsPct + '% do tempo total)'} tone={data.waste.longCallsPct >= 25 ? 'warn' : undefined} />
          </div>

          <div style={card}>
            <div style={label}>Taxa de atendimento por hora</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 150, marginTop: 14 }}>
              {data.hours.map(h => (
                <div key={h.hour} title={h.picked + ' de ' + h.tried + ' chamadas'} style={{ flex: 1, minWidth: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                  <div style={{ fontSize: 10, color: '#64748B', marginBottom: 3 }}>{Math.round(h.rate * 100)}%</div>
                  <div style={{ width: '100%', height: Math.max(4, (h.rate / maxHour) * 100) + '%', borderRadius: 6, background: 'linear-gradient(180deg,#60A5FA,#2563EB)' }} />
                  <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>{h.hour}h</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 10 }}>Atendida = humano ou voicemail. O custo é uma estimativa a partir da duração das chamadas; a fatura real está na Twilio.</div>
          </div>
        </>
      )}
    </section>
  )
}
