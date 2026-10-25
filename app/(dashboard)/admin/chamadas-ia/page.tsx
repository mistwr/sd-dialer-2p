'use client'

import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Save, PhoneCall, KeyRound, SlidersHorizontal, AudioLines, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type AdminData = {
  users: any[]
  companies: any[]
  callers: any[]
  subscriptions: any[]
  codes: any[]
  agents: any[]
  limits: any[]
  twilioConfigured: boolean
}

const AGENT_NAMES: Record<string, string> = {
  'lumin-telecom': 'Compara+ Telecom',
  'lumin-energia': 'Lumin Energia',
  'lumin-ai': 'Lumin AI',
}

export default function AdminVoiceCallsPage() {
  const [data, setData] = useState<AdminData | null>(null)
  const [tab, setTab] = useState<'agents' | 'numbers' | 'access' | 'limits'>('agents')
  const [agentId, setAgentId] = useState('lumin-telecom')
  const [agentJson, setAgentJson] = useState('{}')
  const [agentActive, setAgentActive] = useState(true)
  const [selectedUser, setSelectedUser] = useState('')
  const [phone, setPhone] = useState('')
  const [durationDays, setDurationDays] = useState(30)
  const [generatedCode, setGeneratedCode] = useState('')
  const [selectedCompany, setSelectedCompany] = useState('')
  const [stopCalls, setStopCalls] = useState(false)
  const [maxCallsPerHour, setMaxCallsPerHour] = useState(20)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function getToken() {
    const client = createClient()
    const { data: authData, error: authError } = await client.auth.getSession()
    if (authError || !authData.session?.access_token) throw new Error('Entra novamente no SD Dialer.')
    return authData.session.access_token
  }

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const token = await getToken()
      const response = await fetch('/api/admin/voice-calls', {
        headers: { Authorization: 'Bearer ' + token },
        cache: 'no-store',
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.detail || 'Não foi possível carregar a configuração.')
      setData(json)
      setSelectedUser(current => current || json.users?.find((user: any) => !user.is_super_admin)?.id || json.users?.[0]?.id || '')
      setSelectedCompany(current => current || json.companies?.[0]?.id || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar a gestão de chamadas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadData() }, [])

  const selectedAgent = useMemo(
    () => data?.agents?.find((agent: any) => agent.id === agentId) || null,
    [data, agentId],
  )
  useEffect(() => {
    if (!selectedAgent) return
    const config = { ...(selectedAgent.profile || {}), ...(selectedAgent.config || {}) }
    setAgentJson(JSON.stringify(config, null, 2))
    setAgentActive(selectedAgent.active !== false)
  }, [selectedAgent])

  const selectedLimit = useMemo(
    () => data?.limits?.find((limit: any) => limit.company_id === selectedCompany) || null,
    [data, selectedCompany],
  )
  useEffect(() => {
    if (!selectedCompany) return
    setStopCalls(Boolean(selectedLimit?.stop_calls))
    setMaxCallsPerHour(Number(selectedLimit?.max_calls_per_hour || 20))
  }, [selectedCompany, selectedLimit])

  async function post(url: string, body: Record<string, unknown>) {
    const token = await getToken()
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
      body: JSON.stringify(body),
    })
    const json = await response.json()
    if (!response.ok) throw new Error(json.detail || 'Não foi possível guardar a alteração.')
    return json
  }

  async function runAction(action: () => Promise<void>, success: string) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await action()
      setMessage(success)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir a ação.')
    } finally {
      setBusy(false)
    }
  }

  function saveAgent() {
    return runAction(async () => {
      let config: Record<string, unknown>
      try {
        config = JSON.parse(agentJson)
      } catch {
        throw new Error('O guião tem de estar em formato JSON válido.')
      }
      await post('/api/admin/voice-calls', { action: 'save_agent', agentId, config, active: agentActive })
    }, 'Agente e guião guardados.')
  }

  function startCallerVerification() {
    return runAction(async () => {
      if (!selectedUser) throw new Error('Escolhe o utilizador a quem pertence o número.')
      const result = await post('/api/admin/voice-calls', { action: 'start_caller_verification', userId: selectedUser, phone })
      setPhone('')
      setMessage(result.status === 'pending'
        ? 'A Twilio está a ligar. O utilizador deve atender e introduzir o código no telefone.'
        : 'O número já estava validado e ficou ativo para este utilizador.')
    }, 'Pedido de validação enviado.')
  }

  function issueCode() {
    return runAction(async () => {
      if (!selectedUser) throw new Error('Escolhe o utilizador que vai receber o código.')
      const result = await post('/api/admin/voice-call-codes', { userId: selectedUser, durationDays })
      setGeneratedCode(result.code)
    }, 'Código criado. Copia-o agora; deixa de ser mostrado depois de sair desta página.')
  }

  function saveLimits() {
    return runAction(async () => {
      await post('/api/admin/voice-calls', { action: 'save_limits', companyId: selectedCompany, stopCalls, maxCallsPerHour })
    }, 'Limites da empresa guardados.')
  }

  function setCallerActive(callerId: string, enabled: boolean) {
    return runAction(async () => {
      await post('/api/admin/voice-calls', { action: 'set_caller_active', callerId, enabled })
    }, enabled ? 'Número atribuído ao utilizador.' : 'Número desativado.')
  }

  function revokeSubscription(userId: string) {
    return runAction(async () => {
      await post('/api/admin/voice-calls', { action: 'revoke_subscription', userId })
    }, 'Subscrição suspensa.')
  }

  const panel: React.CSSProperties = { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20 }
  const field: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #CBD5E1', borderRadius: 8, boxSizing: 'border-box', fontSize: 14 }
  const button: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 14px', border: 0, borderRadius: 8, background: '#2563EB', color: 'white', fontWeight: 700, cursor: 'pointer' }

  return (
    <main style={{ maxWidth: 1180, margin: '0 auto', padding: 24, color: '#0F172A' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#2563EB', fontSize: 12, fontWeight: 800, letterSpacing: '.08em' }}><ShieldCheck size={16} /> SUPERADMIN</div>
          <h1 style={{ margin: '7px 0 3px', fontSize: 28 }}>Chamadas IA</h1>
          <p style={{ margin: 0, color: '#64748B' }}>Controla agentes, guião, números Twilio, subscrições e limites.</p>
        </div>
        <button type="button" onClick={() => void loadData()} disabled={loading || busy} style={{ ...button, background: '#EFF6FF', color: '#1D4ED8' }}><RefreshCw size={15} /> Atualizar</button>
      </header>

      <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
        {([
          ['agents', 'Agentes e guião', AudioLines],
          ['numbers', 'Números Twilio', PhoneCall],
          ['access', 'Subscrições e códigos', KeyRound],
          ['limits', 'Limites', SlidersHorizontal],
        ] as const).map(([id, label, Icon]) => (
          <button key={id} type="button" onClick={() => setTab(id)} style={{ padding: '10px 13px', borderRadius: 9, border: tab === id ? '1px solid #2563EB' : '1px solid #CBD5E1', background: tab === id ? '#EFF6FF' : 'white', color: tab === id ? '#1D4ED8' : '#475569', fontWeight: 700, display: 'inline-flex', gap: 7, alignItems: 'center' }}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </nav>

      {message && <div role="status" style={{ ...panel, marginBottom: 14, padding: 12, borderColor: '#86EFAC', color: '#166534' }}>{message}</div>}
      {error && <div role="alert" style={{ ...panel, marginBottom: 14, padding: 12, borderColor: '#FCA5A5', color: '#B91C1C' }}>{error}</div>}
      {loading && <div style={{ ...panel, color: '#64748B' }}>A carregar a configuração…</div>}

      {!loading && data && tab === 'agents' && (
        <section style={panel}>
          <h2 style={{ marginTop: 0 }}>Agente e script de conversa</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, marginBottom: 14 }}>
            <label>Agente
              <select value={agentId} onChange={event => setAgentId(event.target.value)} style={field}>
                {data.agents.map((agent: any) => <option key={agent.id} value={agent.id}>{AGENT_NAMES[agent.id] || agent.id}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 23 }}>
              <input type="checkbox" checked={agentActive} onChange={event => setAgentActive(event.target.checked)} /> Agente disponível para chamadas
            </label>
          </div>
          <p style={{ marginTop: 0, color: '#64748B', lineHeight: 1.5 }}>Edita a abertura, objetivo, oferta, objeções, tom e voz do agente. O script entra nas novas chamadas após guardar.</p>
          <textarea value={agentJson} onChange={event => setAgentJson(event.target.value)} rows={22} spellCheck={false} style={{ ...field, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', lineHeight: 1.45 }} />
          <button type="button" onClick={() => void saveAgent()} disabled={busy} style={{ ...button, marginTop: 12 }}><Save size={15} /> Guardar agente</button>
        </section>
      )}

      {!loading && data && tab === 'numbers' && (
        <section style={{ display: 'grid', gap: 14 }}>
          <div style={panel}>
            <h2 style={{ marginTop: 0 }}>Validar número de um utilizador</h2>
            {!data.twilioConfigured && <p style={{ color: '#B91C1C' }}>A integração Twilio não está configurada na Netlify.</p>}
            <p style={{ color: '#64748B', lineHeight: 1.5 }}>A Twilio liga para o número escolhido. A pessoa atende e introduz o código no teclado do telefone. O número fica associado a essa conta.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
              <select value={selectedUser} onChange={event => setSelectedUser(event.target.value)} style={field}>
                {data.users.filter((item: any) => item.status === 'active').map((item: any) => <option key={item.id} value={item.id}>{item.full_name || item.id}</option>)}
              </select>
              <input type="tel" value={phone} onChange={event => setPhone(event.target.value)} placeholder="+351 912 345 678" style={field} />
              <button type="button" onClick={() => void startCallerVerification()} disabled={busy || !data.twilioConfigured || !phone.trim()} style={button}>Pedir validação Twilio</button>
            </div>
          </div>
          <div style={panel}>
            <h2 style={{ marginTop: 0 }}>Números registados</h2>
            {!data.callers.length ? <p style={{ color: '#64748B' }}>Ainda não há números associados.</p> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                  <thead><tr>{['Utilizador', 'Número', 'Estado', 'Código de validação', 'Atribuição'].map(label => <th key={label} style={{ padding: 9, textAlign: 'left', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>{label}</th>)}</tr></thead>
                  <tbody>{data.callers.map((item: any) => (
                    <tr key={item.id}>
                      <td style={{ padding: 9, borderBottom: '1px solid #F1F5F9' }}>{item.user_name}<div style={{ color: '#94A3B8', fontSize: 12 }}>{item.company_name}</div></td>
                      <td style={{ padding: 9, borderBottom: '1px solid #F1F5F9' }}>{item.phone_number}</td>
                      <td style={{ padding: 9, borderBottom: '1px solid #F1F5F9' }}>{item.verification_status}</td>
                      <td style={{ padding: 9, borderBottom: '1px solid #F1F5F9', fontFamily: 'ui-monospace,monospace' }}>{item.verification_status === 'pending' ? (item.validation_code || '—') : '—'}</td>
                      <td style={{ padding: 9, borderBottom: '1px solid #F1F5F9' }}>
                        {item.verification_status === 'verified' ? (
                          <button type="button" onClick={() => void setCallerActive(item.id, !item.is_active)} disabled={busy} style={{ ...button, padding: '6px 9px', background: item.is_active ? '#DCFCE7' : '#EFF6FF', color: item.is_active ? '#166534' : '#1D4ED8' }}>
                            {item.is_active ? 'Ativo' : 'Ativar'}
                          </button>
                        ) : 'A aguardar validação'}
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {!loading && data && tab === 'access' && (
        <section style={{ display: 'grid', gap: 14 }}>
          <div style={panel}>
            <h2 style={{ marginTop: 0 }}>Gerar código de subscrição</h2>
            <p style={{ color: '#64748B', lineHeight: 1.5 }}>O código fica ligado à conta escolhida, só pode ser utilizado uma vez e expira após 14 dias.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10 }}>
              <select value={selectedUser} onChange={event => setSelectedUser(event.target.value)} style={field}>
                {data.users.filter((item: any) => item.status === 'active' && !item.is_super_admin).map((item: any) => <option key={item.id} value={item.id}>{item.full_name || item.id}</option>)}
              </select>
              <input type="number" min={1} max={3650} value={durationDays} onChange={event => setDurationDays(Number(event.target.value))} style={field} aria-label="Duração em dias" />
              <button type="button" onClick={() => void issueCode()} disabled={busy || !selectedUser} style={button}><KeyRound size={15} /> Gerar código</button>
            </div>
            {generatedCode && <div style={{ marginTop: 14, padding: 14, borderRadius: 10, background: '#FFFBEB', border: '1px solid #FCD34D' }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Código de utilização única</div>
              <code style={{ fontSize: 20, letterSpacing: '.08em' }}>{generatedCode}</code>
              <div style={{ color: '#92400E', marginTop: 7 }}>Copia e entrega ao utilizador agora. O código não pode ser consultado novamente.</div>
              <button type="button" onClick={() => { void navigator.clipboard?.writeText(generatedCode) }} style={{ ...button, marginTop: 9, background: '#D97706' }}>Copiar código</button>
            </div>}
          </div>
          <div style={panel}>
            <h2 style={{ marginTop: 0 }}>Subscrições ativas e anteriores</h2>
            {!data.subscriptions.length ? <p style={{ color: '#64748B' }}>Ainda não há subscrições registadas.</p> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 650 }}>
                  <thead><tr>{['Utilizador', 'Empresa', 'Estado', 'Expira', 'Ação'].map(label => <th key={label} style={{ padding: 9, textAlign: 'left', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>{label}</th>)}</tr></thead>
                  <tbody>{data.subscriptions.map((item: any) => (
                    <tr key={item.user_id}>
                      <td style={{ padding: 9, borderBottom: '1px solid #F1F5F9' }}>{item.user_name}</td>
                      <td style={{ padding: 9, borderBottom: '1px solid #F1F5F9' }}>{item.company_name}</td>
                      <td style={{ padding: 9, borderBottom: '1px solid #F1F5F9', color: item.active ? '#15803D' : '#B91C1C' }}>{item.active ? 'Ativa' : item.status === 'revoked' ? 'Suspensa' : 'Expirada'}</td>
                      <td style={{ padding: 9, borderBottom: '1px solid #F1F5F9' }}>{new Date(item.expires_at).toLocaleDateString('pt-PT')}</td>
                      <td style={{ padding: 9, borderBottom: '1px solid #F1F5F9' }}>{item.active && <button type="button" onClick={() => void revokeSubscription(item.user_id)} disabled={busy} style={{ ...button, background: '#DC2626', padding: '6px 9px' }}>Suspender</button>}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {!loading && data && tab === 'limits' && (
        <section style={panel}>
          <h2 style={{ marginTop: 0 }}>Limites de chamadas</h2>
          <p style={{ color: '#64748B', lineHeight: 1.5 }}>Os limites aplicam-se a todos os utilizadores da empresa. Pausar bloqueia novas chamadas imediatamente.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, alignItems: 'center' }}>
            <select value={selectedCompany} onChange={event => setSelectedCompany(event.target.value)} style={field}>
              {data.companies.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={stopCalls} onChange={event => setStopCalls(event.target.checked)} /> Pausar chamadas IA</label>
            <label>Máximo por utilizador, por hora
              <input type="number" min={1} max={1000} value={maxCallsPerHour} onChange={event => setMaxCallsPerHour(Number(event.target.value))} style={field} />
            </label>
            <button type="button" onClick={() => void saveLimits()} disabled={busy || !selectedCompany} style={button}><Save size={15} /> Guardar limites</button>
          </div>
        </section>
      )}
    </main>
  )
}
