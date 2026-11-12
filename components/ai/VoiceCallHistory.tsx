'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { ChevronDown, ChevronUp, Loader2, PhoneCall, Play, RefreshCw } from 'lucide-react'

type VoiceTranscriptLine = {
  id: string
  speaker: string
  text: string
  is_interruption: boolean
  spoken_at: string
}

const INFO_LABELS: Array<[string, string]> = [
  ['operadora_atual', 'Operadora atual'], ['valor_atual', 'Paga hoje'], ['servicos', 'Serviços'], ['prioridade', 'Prioridade'],
  ['pacote_proposto', 'Pacote proposto'], ['preco_proposto', 'Preço proposto'], ['objecao', 'Objeção'],
  ['email', 'Email'], ['consultor_agendado', 'Consultor'], ['instalacao', 'Instalação'],
]
const PRIORIDADES: Record<string, string> = { pagar_menos: 'Pagar menos', melhor_servico: 'Melhor serviço', ambos: 'Pagar menos e melhor serviço' }

function CallInfoPanel({ info }: { info?: Record<string, string | number | null> | null }) {
  const rows = INFO_LABELS.filter(([k]) => info && info[k] != null && info[k] !== '')
  if (!info || !rows.length) return null
  const fmt = (k: string, v: string | number) =>
    k === 'valor_atual' || k === 'preco_proposto' ? Number(v).toFixed(2).replace('.', ',') + ' €/mês' : k === 'prioridade' ? PRIORIDADES[String(v)] || String(v) : String(v)
  return (
    <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#1E3A8A', marginBottom: 6 }}>🤖 Informação recolhida pelo robot</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '4px 16px', fontSize: 12.5, color: '#1E293B' }}>
        {rows.map(([k, label]) => (
          <div key={k}><span style={{ color: '#475569' }}>{label}:</span> <strong>{fmt(k, info[k] as string | number)}</strong></div>
        ))}
      </div>
    </div>
  )
}

type VoiceCall = {
  id: string
  client_name: string | null
  phone_number: string
  status: string
  duration_seconds: number | null
  transcript_consent_status: 'pending' | 'granted' | 'denied' | 'not_requested' | 'unavailable' | string
  transcript_consent_at: string | null
  ended_at: string | null
  created_at: string
  summary?: string | null
  interest_level?: string | null
  next_action?: string | null
  has_recording?: boolean
  call_info?: Record<string, string | number | null> | null
  review?: { decision: string; by: string | null; at: string | null; note: string | null } | null
  ai_sale?: { status: string; operator: string | null; package: string | null; monthly_price: number | null; email: string | null; delivery: Record<string, any> | null } | null
  transcripts: VoiceTranscriptLine[]
}

const REVIEW_LABELS: Record<string, string> = {
  voltar_a_ligar: 'Voltar a ligar',
  passar_consultor: 'Passado ao consultor',
  nao_ligar: 'Não ligar mais',
  ok: 'Visto, está certo',
}

function needsReview(call: VoiceCall): boolean {
  if (call.ai_sale) return false
  const i = call.interest_level
  return !i || i === 'indeterminado' || i === 'correio_voz' || call.status === 'failed'
}

function ReviewBar({ call, onDone }: { call: VoiceCall; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function send(decision: string) {
    setBusy(true)
    setErr('')
    try {
      const r = await fetch('/api/voice-calls/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_id: call.id, decision }),
      })
      if (!r.ok) throw new Error('falhou')
      onDone()
    } catch {
      setErr('Não foi possível guardar. Tenta outra vez.')
    } finally {
      setBusy(false)
    }
  }
  const btn = (bg: string): React.CSSProperties => ({
    border: 0, borderRadius: 8, background: bg, color: '#fff', padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: busy ? 'wait' : 'pointer',
  })
  return (
    <div style={{ margin: '0 14px 8px', padding: '8px 10px', borderRadius: 8, background: '#F1F5F9', fontSize: 12.5, color: '#1E293B' }}>
      {call.review ? (
        <span>
          <strong>Validado:</strong> {REVIEW_LABELS[call.review.decision] || call.review.decision}
          {call.review.by ? ' · ' + call.review.by : ''}
          {call.review.at ? ' · ' + new Date(call.review.at).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
          {' '}
          <button type="button" disabled={busy} onClick={() => send('voltar_a_ligar')} style={{ ...btn('#64748B'), marginLeft: 6 }}>Mudar</button>
        </span>
      ) : (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <strong>Validar depois de ver a transcrição:</strong>
          <button type="button" disabled={busy} onClick={() => send('voltar_a_ligar')} style={btn('#2563EB')}>Voltar a ligar</button>
          <button type="button" disabled={busy} onClick={() => send('passar_consultor')} style={btn('#16A34A')}>Passar ao consultor</button>
          <button type="button" disabled={busy} onClick={() => send('nao_ligar')} style={btn('#B91C1C')}>Não ligar mais</button>
          <button type="button" disabled={busy} onClick={() => send('ok')} style={btn('#64748B')}>Está certo</button>
        </div>
      )}
      {err && <div style={{ color: '#B91C1C', marginTop: 4 }}>{err}</div>}
    </div>
  )
}

const INTEREST_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  alto: { label: 'Interesse alto', color: '#166534', bg: '#DCFCE7' },
  medio: { label: 'Interesse médio', color: '#854D0E', bg: '#FEF9C3' },
  baixo: { label: 'Interesse baixo', color: '#9A3412', bg: '#FFEDD5' },
  sem_interesse: { label: 'Sem interesse', color: '#991B1B', bg: '#FEE2E2' },
  correio_voz: { label: 'Correio de voz', color: '#475569', bg: '#F1F5F9' },
  indeterminado: { label: 'Sem conversa útil', color: '#475569', bg: '#F1F5F9' },
}

async function fetcher(url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Erro ao carregar o histórico')
  return response.json() as Promise<{ calls: VoiceCall[]; total: number; counts?: Record<string, number> }>
}

function RecordingPlayer({ callId }: { callId: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/voice-calls/${callId}/recording`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.url) throw new Error(data.error || 'Não foi possível abrir a gravação')
      setUrl(data.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível abrir a gravação')
    } finally {
      setLoading(false)
    }
  }

  if (url) {
    return <audio controls autoPlay src={url} style={{ width: '100%', marginBottom: 12 }} />
  }
  return (
    <div style={{ marginBottom: 12 }}>
      <button
        type="button"
        onClick={() => void load()}
        disabled={loading}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          border: '1px solid #BFDBFE', background: '#EFF6FF', color: '#1D4ED8',
          borderRadius: 8, padding: '7px 12px', fontSize: 12.5, fontWeight: 600,
          cursor: loading ? 'wait' : 'pointer',
        }}
      >
        {loading ? <Loader2 size={14} style={{ animation: 'spin 0.75s linear infinite' }} /> : <Play size={14} />}
        Ouvir gravação
      </button>
      {error && <span style={{ marginLeft: 10, color: '#B91C1C', fontSize: 12 }}>{error}</span>}
    </div>
  )
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('pt-PT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDuration(seconds: number | null) {
  if (seconds == null) return '—'
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return minutes ? `${minutes} min ${remainder} s` : `${remainder} s`
}

function formatTranscriptTime(spokenAt: string, callStartedAt: string) {
  const spokenMs = Date.parse(spokenAt)
  const startedMs = Date.parse(callStartedAt)
  if (!Number.isFinite(spokenMs)) return 'Hora indisponível'
  const clock = new Date(spokenMs).toLocaleTimeString('pt-PT', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  if (!Number.isFinite(startedMs) || spokenMs < startedMs) return clock
  const elapsed = Math.floor((spokenMs - startedMs) / 1000)
  const minutes = Math.floor(elapsed / 60)
  const seconds = String(elapsed % 60).padStart(2, '0')
  return `${clock} · +${minutes}:${seconds}`
}

function consentLabel(status: VoiceCall['transcript_consent_status']) {
  if (status === 'granted') return 'Transcrição autorizada'
  if (status === 'denied') return 'Transcrição não autorizada'
  if (status === 'pending') return 'Sem autorização confirmada'
  return 'Sem transcrição'
}

function callStatusLabel(status: string, endedAt: string | null) {
  const terminalLabels: Record<string, string> = {
    failed: 'Falhada',
    voicemail: 'Correio de voz',
    not_interested: 'Sem interesse',
    do_not_call: 'Não voltar a ligar',
  }
  if (terminalLabels[status]) return terminalLabels[status]
  if (endedAt) return 'Terminada'
  const labels: Record<string, string> = {
    queued: 'A aguardar',
    ringing: 'A tocar',
    answered: 'Atendida',
    active: 'Em curso',
    interested: 'Interessado',
    follow_up: 'Pedir novo contacto',
    transferred: 'Transferida',
    sale: 'Venda',
    callback: 'Pedir retorno',
  }
  return labels[status] ?? status
}

export default function VoiceCallHistory({ leadId }: { leadId?: string } = {}) {
  const [openCallId, setOpenCallId] = useState<string | null>(null)
  const [filter, setFilter] = useState<string | null>(null)
  const [period, setPeriod] = useState<'today' | '7d' | '30d' | 'all'>(leadId ? 'all' : 'today')
  const url = `/api/voice-calls?limit=50&period=${period}` +
    (leadId ? `&lead_id=${encodeURIComponent(leadId)}` : '') +
    (filter ? `&filter=${filter}` : '')
  const { data, error, isLoading, mutate } = useSWR(url, fetcher, {
    refreshInterval: 15000,
    revalidateOnFocus: true,
  })

  const calls = data?.calls ?? []
  const [exporting, setExporting] = useState(false)

  async function exportCsv() {
    setExporting(true)
    try {
      const rows: any[] = []
      for (let offset = 0; offset < 2000; offset += 100) {
        const res = await fetch(`${url.replace('limit=50', 'limit=100')}&offset=${offset}`)
        if (!res.ok) break
        const json = await res.json()
        const batch: any[] = json.calls ?? []
        rows.push(...batch)
        if (batch.length < 100) break
      }
      const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`
      const head = ['Data', 'Cliente', 'Telefone', 'Estado', 'Duração (s)', 'Interesse', 'Venda robot', 'Resumo', 'Próxima ação', 'Operadora atual', 'Transcrição']
      const lines = rows.map((c) => [
        c.created_at, c.client_name, c.phone_number, c.status, c.duration_seconds, c.interest_level,
        c.ai_sale ? `${c.ai_sale.status} ${c.ai_sale.operator ?? ''} ${c.ai_sale.package ?? ''} ${c.ai_sale.monthly_price ?? ''}`.trim() : '',
        c.summary, c.next_action, c.call_info?.operadora_atual ?? c.call_info?.operadora ?? '',
        (c.transcripts ?? []).map((t: VoiceTranscriptLine) => `${t.speaker === 'agent' ? 'Robot' : 'Cliente'}: ${t.text}`).join(' | '),
      ].map(esc).join(';'))
      const blob = new Blob(['\uFEFF' + [head.map(esc).join(';'), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `chamadas-ia-${period}${filter ? '-' + filter : ''}-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(a.href)
    } finally {
      setExporting(false)
    }
  }

  return (
    <section style={{
      background: '#fff',
      border: '1px solid #E2E8F0',
      borderRadius: 14,
      padding: 18,
      marginBottom: 22,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
        marginBottom: 14,
      }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, margin: '0 0 5px', color: '#0F172A' }}>
            <PhoneCall size={18} color="#2563EB" />
            {leadId ? 'Chamadas de IA desta lead' : 'Chamadas da Lumin'}
          </h2>
          <p style={{ margin: 0, color: '#64748B', fontSize: 12.5, lineHeight: 1.5 }}>
            Gravações e transcrições só ficam acessíveis a quem tem acesso à chamada. Os links de áudio expiram em 10 minutos.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void mutate()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            border: '1px solid #CBD5E1',
            background: '#fff',
            borderRadius: 8,
            padding: '7px 10px',
            color: '#334155',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={14} />
          Atualizar
        </button>
      </div>

      {(() => {
        const counts = data?.counts
        if (!counts) return null
        const TILES: Array<{ key: string | null; label: string; color: string; bg: string }> = [
          { key: null, label: 'Todas', color: '#1E293B', bg: '#F1F5F9' },
          { key: 'vendas', label: 'Venda do robot', color: '#166534', bg: '#DCFCE7' },
          { key: 'alto', label: 'Interesse alto', color: INTEREST_LABELS.alto.color, bg: INTEREST_LABELS.alto.bg },
          { key: 'medio', label: 'Interesse médio', color: INTEREST_LABELS.medio.color, bg: INTEREST_LABELS.medio.bg },
          { key: 'baixo', label: 'Interesse baixo', color: INTEREST_LABELS.baixo.color, bg: INTEREST_LABELS.baixo.bg },
          { key: 'sem_interesse', label: 'Sem interesse', color: INTEREST_LABELS.sem_interesse.color, bg: INTEREST_LABELS.sem_interesse.bg },
          { key: 'correio_voz', label: 'Correio de voz', color: INTEREST_LABELS.correio_voz.color, bg: INTEREST_LABELS.correio_voz.bg },
          { key: 'indeterminado', label: 'Sem conversa útil', color: INTEREST_LABELS.indeterminado.color, bg: INTEREST_LABELS.indeterminado.bg },
          { key: 'em_curso', label: 'Em curso', color: '#1D4ED8', bg: '#DBEAFE' },
        ]
        const PERIODS: Array<['today' | '7d' | '30d' | 'all', string]> = [['today', 'Hoje'], ['7d', '7 dias'], ['30d', '30 dias'], ['all', 'Tudo']]
        return (
          <div style={{ margin: '14px 0 16px' }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              {PERIODS.map(([value, label]) => (
                <button key={value} type="button" onClick={() => setPeriod(value)} style={{
                  border: '1px solid ' + (period === value ? '#2563EB' : '#E2E8F0'), background: period === value ? '#2563EB' : '#fff',
                  color: period === value ? '#fff' : '#334155', borderRadius: 999, padding: '5px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                }}>{label}</button>
              ))}
              <button type="button" onClick={exportCsv} disabled={exporting} style={{
                marginLeft: 'auto', border: '1px solid #E2E8F0', background: '#fff', color: '#334155', borderRadius: 999,
                padding: '5px 12px', fontSize: 12.5, fontWeight: 600, cursor: exporting ? 'wait' : 'pointer',
              }}>{exporting ? 'A exportar…' : '⬇ Exportar CSV'}</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(128px, 1fr))', gap: 8 }}>
              {TILES.map((t) => {
                const active = filter === t.key
                const n = counts[t.key ?? 'todas'] ?? 0
                return (
                  <button key={t.key ?? 'todas'} type="button" onClick={() => setFilter(active ? null : t.key)} aria-pressed={active} style={{
                    textAlign: 'left', cursor: 'pointer', padding: '10px 12px', borderRadius: 12, background: t.bg, color: t.color,
                    border: active ? '2px solid ' + t.color : '2px solid transparent',
                  }}>
                    <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1 }}>{n}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>{t.label}</div>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })()}

      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '24px 0', color: '#64748B', fontSize: 13 }}>
          <Loader2 size={18} style={{ animation: 'spin 0.75s linear infinite' }} />
          A carregar chamadas...
        </div>
      ) : error ? (
        <div style={{ padding: '14px 0', color: '#B91C1C', fontSize: 13 }}>
          Não foi possível carregar as chamadas. Atualize para tentar novamente.
        </div>
      ) : calls.length === 0 ? (
        <div style={{ padding: '18px 0', color: '#64748B', fontSize: 13 }}>
          {leadId ? 'Esta lead ainda não tem chamadas de IA registadas.' : filter || period !== 'all' ? 'Nenhuma chamada neste filtro. Escolhe outro estado ou período.' : 'Ainda não há chamadas da Lumin registadas.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {calls.map((call) => {
            const expanded = openCallId === call.id
            return (
              <div key={call.id} style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpenCallId(expanded ? null : call.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                    width: '100%',
                    padding: '12px 14px',
                    border: 'none',
                    background: expanded ? '#F8FAFC' : '#fff',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ minWidth: 140, flex: '1 1 180px' }}>
                    <span style={{ display: 'block', color: '#0F172A', fontSize: 13.5, fontWeight: 700 }}>
                      {call.client_name || call.phone_number}
                    </span>
                    <span style={{ display: 'block', color: '#64748B', fontSize: 12, marginTop: 3 }}>
                      {call.phone_number} · {formatDate(call.created_at)}
                    </span>
                  </span>
                  <span style={{ color: '#475569', fontSize: 12 }}>
                    {callStatusLabel(call.status, call.ended_at)} · {formatDuration(call.duration_seconds)}
                  </span>
                  <span style={{
                    color: call.ai_sale ? '#166534' : '#1D4ED8',
                    background: call.ai_sale ? '#DCFCE7' : '#DBEAFE',
                    padding: '4px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                  }}>
                    {call.ai_sale ? '🤖 Robot · Venda' : '🤖 Robot'}
                  </span>
                  <span style={{
                    color: call.transcript_consent_status === 'granted' ? '#166534' : '#64748B',
                    background: call.transcript_consent_status === 'granted' ? '#DCFCE7' : '#F1F5F9',
                    padding: '4px 8px',
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 600,
                  }}>
                    {consentLabel(call.transcript_consent_status)}
                  </span>
                  {call.interest_level && INTEREST_LABELS[call.interest_level] && (
                    <span style={{
                      color: INTEREST_LABELS[call.interest_level].color,
                      background: INTEREST_LABELS[call.interest_level].bg,
                      padding: '4px 8px',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 600,
                    }}>
                      {INTEREST_LABELS[call.interest_level].label}
                    </span>
                  )}
                  {expanded ? <ChevronUp size={16} color="#64748B" /> : <ChevronDown size={16} color="#64748B" />}
                </button>
                {call.ai_sale && (
                  <div style={{ margin: '0 14px 8px', padding: '8px 10px', borderRadius: 8, fontSize: 12.5, lineHeight: 1.5,
                    background: call.ai_sale.status === 'sent' ? '#DCFCE7' : call.ai_sale.status === 'delivery_failed' ? '#FEE2E2' : '#FEF9C3',
                    color: '#1E293B' }}>
                    <strong>Venda do robot:</strong>{' '}
                    {({ sent: 'pedido enviado ao cliente', delivery_failed: 'registada, mas o envio falhou', needs_review: 'a rever (dados incompletos)', shadow: 'simulação (envio desligado para este número)', skipped: 'não enviada' } as Record<string, string>)[call.ai_sale.status] || call.ai_sale.status}
                    {[call.ai_sale.operator, call.ai_sale.package].filter(Boolean).length > 0 && ' · ' + [call.ai_sale.operator, call.ai_sale.package].filter(Boolean).join(' ')}
                    {call.ai_sale.monthly_price != null && ' · ' + call.ai_sale.monthly_price.toFixed(2).replace('.', ',') + ' €/mês'}
                    {call.ai_sale.email && ' · ' + call.ai_sale.email}
                  </div>
                )}
                {needsReview(call) && (
                  <ReviewBar call={call} onDone={() => mutate()} />
                )}
                {call.summary && (
                  <div style={{ padding: '0 14px 12px', background: expanded ? '#F8FAFC' : '#fff' }}>
                    <p style={{ margin: 0, color: '#334155', fontSize: 12.5, lineHeight: 1.5 }}>
                      <strong>Resumo:</strong> {call.summary}
                    </p>
                    {call.next_action && (
                      <p style={{ margin: '4px 0 0', color: '#334155', fontSize: 12.5, lineHeight: 1.5 }}>
                        <strong>Próxima ação:</strong> {call.next_action}
                      </p>
                    )}
                  </div>
                )}

                {expanded && (
                  <div style={{ padding: '12px 14px', borderTop: '1px solid #E2E8F0', background: '#fff' }}>
                    <CallInfoPanel info={call.call_info} />
                    {call.has_recording && <RecordingPlayer callId={call.id} />}
                    {call.transcript_consent_status === 'granted' && call.transcripts.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {call.transcripts.map((line) => (
                          <div key={line.id} style={{ display: 'grid', gridTemplateColumns: '70px minmax(0, 1fr)', gap: 9 }}>
                            <span style={{ color: '#64748B', fontSize: 12, fontWeight: 700 }}>
                              {line.speaker === 'agent' ? 'Lumin' : 'Contacto'}
                              <span style={{ display: 'block', fontSize: 10, fontWeight: 500, marginTop: 3, fontVariantNumeric: 'tabular-nums' }} title="Hora da intervenção e tempo desde o início da chamada">
                                {formatTranscriptTime(line.spoken_at, call.created_at)}
                              </span>
                            </span>
                            <p style={{ margin: 0, color: '#1E293B', fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                              {line.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ margin: 0, color: '#64748B', fontSize: 12.5, lineHeight: 1.5 }}>
                        {call.transcript_consent_status === 'denied'
                          ? 'A chamada foi registada, mas a pessoa não autorizou guardar a transcrição.'
                          : call.transcript_consent_status === 'granted'
                            ? 'A autorização foi dada, mas não há texto disponível para esta chamada.'
                            : 'A chamada foi registada. Não foi recebida uma autorização clara para guardar a transcrição.'}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
