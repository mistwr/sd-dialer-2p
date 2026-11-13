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

type QRow = { callId: string; leadId: string | null; companyId: string; name: string; phone: string; level: string; summary: string; nextAction: string; durationSeconds: number; createdAt: string; assignedTo: string | null; leadStatus: string | null; operator: string | null; currentValue: string | null; scheduled: string | null; missingFields: number }

export default function AnaliseRobot({ getToken, companies, users }: { getToken: () => Promise<string>; companies: { id: string; name: string }[]; users: { id: string; full_name: string; company_id: string; status?: string }[] }) {
  const [days, setDays] = useState(14)
  const [companyId, setCompanyId] = useState('')
  const [data, setData] = useState<Analytics | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [qual, setQual] = useState<QRow[]>([])
  const [picked, setPicked] = useState<Record<string, boolean>>({})
  const [assignTo, setAssignTo] = useState('')
  const [assignMsg, setAssignMsg] = useState('')

  async function loadQualified() {
    try {
      const token = await getToken()
      const qs = new URLSearchParams({ days: String(days) })
      if (companyId) qs.set('companyId', companyId)
      const res = await fetch('/api/admin/voice-calls/qualified?' + qs.toString(), { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' })
      const json = await res.json()
      if (res.ok) setQual(json.rows || [])
    } catch { /* a lista é opcional; os números acima continuam a funcionar */ }
  }

  async function assign() {
    const leadIds = qual.filter(r => r.leadId && picked[r.callId]).map(r => r.leadId as string)
    if (!assignTo || !leadIds.length) { setAssignMsg('Escolhe o vendedor e pelo menos um lead.'); return }
    try {
      const token = await getToken()
      const res = await fetch('/api/admin/voice-calls/qualified', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ userId: assignTo, leadIds }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.detail || 'Não foi possível atribuir.')
      setAssignMsg(json.assigned + ' de ' + json.requested + ' leads atribuídos.')
      setPicked({})
      await loadQualified()
    } catch (err) {
      setAssignMsg(err instanceof Error ? err.message : 'Falha ao atribuir.')
    }
  }

  async function load() {
    void loadQualified()
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

          <div style={card}>
            <div style={label}>Qualificados prontos a ligar ({qual.length})</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', margin: '12px 0' }}>
              <select value={assignTo} onChange={e => setAssignTo(e.target.value)} style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid #CBD5E1' }}>
                <option value="">Atribuir a…</option>
                {users.filter(u => u.status === 'active' && (!companyId || u.company_id === companyId)).map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
              <button type="button" onClick={() => void assign()} style={{ padding: '9px 14px', borderRadius: 10, border: 0, background: '#2563EB', color: 'white', fontWeight: 700 }}>Atribuir selecionados</button>
              {assignMsg && <span style={{ fontSize: 13, color: '#475569' }}>{assignMsg}</span>}
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {qual.map(r => (
                <label key={r.callId} style={{ display: 'grid', gridTemplateColumns: '24px 1fr', gap: 10, padding: 12, borderRadius: 12, border: '1px solid #E2E8F0', background: r.level === 'alto' ? '#F0FDF4' : '#FFFBEB', cursor: r.leadId ? 'pointer' : 'default' }}>
                  <input type="checkbox" disabled={!r.leadId} checked={Boolean(picked[r.callId])} onChange={e => setPicked(p => ({ ...p, [r.callId]: e.target.checked }))} />
                  <div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'baseline' }}>
                      <strong style={{ color: '#0F172A' }}>{r.name}</strong>
                      <span style={{ fontSize: 13, color: '#475569' }}>{r.phone}</span>
                      <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: r.level === 'alto' ? '#BBF7D0' : '#FDE68A', color: '#14532D' }}>{r.level === 'alto' ? 'ALTO' : 'MÉDIO'}</span>
                      {r.operator && <span style={{ fontSize: 12, color: '#475569' }}>{r.operator}</span>}
                      {r.currentValue && <span style={{ fontSize: 12, color: '#475569' }}>{r.currentValue}</span>}
                      {r.assignedTo && <span style={{ fontSize: 12, color: '#64748B' }}>· já atribuído a {users.find(u => u.id === r.assignedTo)?.full_name || 'outro utilizador'}</span>}
                      {r.missingFields > 0 && <span style={{ fontSize: 12, color: '#B45309' }}>· faltam {r.missingFields} dados</span>}
                    </div>
                    {r.summary && <div style={{ fontSize: 13, color: '#334155', marginTop: 4 }}>{r.summary.slice(0, 220)}{r.summary.length > 220 ? '…' : ''}</div>}
                    {r.scheduled && <div style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>Marcado: {r.scheduled}</div>}
                  </div>
                </label>
              ))}
              {qual.length === 0 && <div style={{ color: '#64748B', fontSize: 14 }}>Sem qualificados neste período.</div>}
            </div>
          </div>
        </>
      )}
    </section>
  )
}
