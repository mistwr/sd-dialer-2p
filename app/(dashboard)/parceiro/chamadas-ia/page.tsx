'use client'

/**
 * /parceiro/chamadas-ia
 * Historico de Chamadas com IA — parceiro view.
 * Lists all recordings, allows playback, download, and shows AI analysis.
 * Additive only — no existing page modified.
 */

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import {
  AudioLines, Play, Download, Brain, ChevronDown, ChevronUp,
  Clock, User, Megaphone, Calendar, RefreshCw, Loader2, Mic,
  Sparkles, Send, Wifi, Zap, PhoneCall, Search, CheckCircle2, AlertCircle,
} from 'lucide-react'
import AIAnalysisPanel from '@/components/ai/AIAnalysisPanel'
import { createClient } from '@/lib/supabase/client'

type Recording = {
  id: string
  audio_url: string | null
  file_name: string | null
  duration_sec: number
  status: string
  created_at: string
  leads?: { nome: string; telefone: string } | null
  campanhas?: { nome: string } | null
  usuarios?: { nome: string } | null
  ai_analyses?: any[] | null
}

async function fetcher(url: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Erro ao carregar')
  return res.json()
}

function formatDur(sec: number) {
  if (!sec) return '--:--'
  const m = Math.floor(sec / 60).toString().padStart(2, '0')
  const s = (sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    uploaded:    { label: 'Guardado',    bg: '#EFF6FF', color: '#2563EB' },
    analysed:    { label: 'Analisado',   bg: '#DCFCE7', color: '#15803D' },
    transcribing:{ label: 'A transcrever', bg: '#FEF3C7', color: '#92400E' },
    error:       { label: 'Erro',        bg: '#FEE2E2', color: '#DC2626' },
    pending:     { label: 'Pendente',    bg: '#F3F4F6', color: '#6B7280' },
  }
  const s = map[status] ?? map.pending
  return (
    <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

function RecordingRow({ recording, onAnalyse }: { recording: Recording; onAnalyse: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [analysing, setAnalysing] = useState(false)
  const analysis = recording.ai_analyses?.[0] ?? null

  async function handleAnalyse() {
    setAnalysing(true)
    await onAnalyse(recording.id)
    setAnalysing(false)
  }

  return (
    <div style={{
      background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0',
      overflow: 'hidden', transition: 'box-shadow 0.15s',
    }}>
      {/* Row header */}
      <div style={{
        padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
        flexWrap: 'wrap',
      }}>
        {/* Icon */}
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: analysis ? '#DCFCE7' : '#EFF6FF',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <AudioLines size={18} color={analysis ? '#15803D' : '#2563EB'} />
        </div>

        {/* Meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#0F172A', marginBottom: 3 }}>
            {recording.leads?.nome ?? 'Cliente desconhecido'}
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#64748B' }}>
              <Clock size={11} /> {formatDur(recording.duration_sec)}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#64748B' }}>
              <Calendar size={11} /> {formatDate(recording.created_at)}
            </span>
            {recording.campanhas?.nome && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#64748B' }}>
                <Megaphone size={11} /> {recording.campanhas.nome}
              </span>
            )}
          </div>
        </div>

        {/* Score pill */}
        {analysis?.score != null && (
          <div style={{
            padding: '4px 12px', borderRadius: 99, fontWeight: 800, fontSize: 16,
            background: analysis.score >= 70 ? '#DCFCE7' : analysis.score >= 40 ? '#FEF3C7' : '#FEE2E2',
            color: analysis.score >= 70 ? '#14532D' : analysis.score >= 40 ? '#92400E' : '#7F1D1D',
          }}>
            {analysis.score}<span style={{ fontSize: 10, fontWeight: 500 }}>/100</span>
          </div>
        )}

        <StatusBadge status={recording.status} />

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {recording.audio_url && (
            <>
              <a
                href={recording.audio_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: '#EFF6FF', border: '1px solid #BFDBFE',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  textDecoration: 'none',
                }}
                title="Ouvir"
              >
                <Play size={14} color="#2563EB" />
              </a>
              <a
                href={recording.audio_url}
                download={recording.file_name ?? 'gravacao.webm'}
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: '#F3F4F6', border: '1px solid #E5E7EB',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  textDecoration: 'none',
                }}
                title="Descarregar"
              >
                <Download size={14} color="#374151" />
              </a>
            </>
          )}

          {recording.status !== 'analysed' && recording.audio_url && (
            <button
              onClick={handleAnalyse}
              disabled={analysing || recording.status === 'transcribing'}
              style={{
                height: 32, padding: '0 12px', borderRadius: 8,
                background: '#2563EB', color: '#fff',
                border: 'none', cursor: analysing ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 12, fontWeight: 600, opacity: analysing ? 0.7 : 1,
              }}
              title="Analisar com IA"
            >
              {analysing
                ? <Loader2 size={12} style={{ animation: 'spin 0.75s linear infinite' }} />
                : <Brain size={12} />}
              {analysing ? 'A analisar...' : 'Analisar IA'}
            </button>
          )}

          {analysis && (
            <button
              onClick={() => setExpanded(v => !v)}
              style={{
                width: 32, height: 32, borderRadius: 8,
                background: '#F3F4F6', border: '1px solid #E5E7EB',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              title={expanded ? 'Fechar analise' : 'Ver analise IA'}
            >
              {expanded ? <ChevronUp size={14} color="#374151" /> : <ChevronDown size={14} color="#374151" />}
            </button>
          )}
        </div>
      </div>

      {/* Inline audio player */}
      {recording.audio_url && expanded && (
        <div style={{ padding: '0 16px 12px' }}>
          <audio
            controls
            src={recording.audio_url}
            style={{ width: '100%', height: 36, borderRadius: 8 }}
          />
        </div>
      )}

      {/* AI Analysis panel */}
      {analysis && expanded && (
        <div style={{ padding: '0 16px 16px' }}>
          <AIAnalysisPanel
            analysis={analysis}
            recordingId={recording.id}
            leadName={recording.leads?.nome ?? null}
          />
        </div>
      )}
    </div>
  )
}

const LUMIN_GATEWAY = 'https://lumin-voice-gateway-production.up.railway.app'

type VoiceLead = {
  id: string
  nome: string
  telefone: string
  status: string
  assigned_to?: string | null
}

const VOICE_AGENTS = [
  { id: 'lumin-telecom', label: 'Lumin Telecom', detail: 'Qualifica telecomunicações e fecha interesse para comparação.' },
  { id: 'lumin-energia', label: 'Lumin Energia', detail: 'Qualifica energia e fecha interesse para comparação.' },
  { id: 'lumin-ai', label: 'Lumin AI Comercial', detail: 'Vende a plataforma LUMIN AI de forma consultiva.' },
] as const

function LuminCallPanel() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<VoiceLead[]>([])
  const [selected, setSelected] = useState<VoiceLead | null>(null)
  const [searching, setSearching] = useState(false)
  const [agentId, setAgentId] = useState<(typeof VOICE_AGENTS)[number]['id']>('lumin-telecom')
  const [callStatus, setCallStatus] = useState<'idle' | 'queued' | 'preparing' | 'ringing' | 'answered' | 'connected' | 'failed'>('idle')
  const [callMessage, setCallMessage] = useState('Escolhe uma lead e o Lumin liga.')
  const [error, setError] = useState('')
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (pollTimer.current) clearTimeout(pollTimer.current)
  }, [])

  async function getSessionToken() {
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session?.access_token) throw new Error('Sessão expirada. Entra novamente no SD Dialer.')
    return session.access_token
  }

  async function searchLeads() {
    const term = query.trim()
    if (term.length < 2) {
      setError('Escreve pelo menos 2 caracteres.')
      return
    }

    setSearching(true)
    setError('')
    try {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) throw new Error('Sessão expirada.')

      const { data: profile } = await sb
        .from('usuarios')
        .select('role,company_id')
        .eq('id', user.id)
        .single()

      if (!profile?.company_id) throw new Error('Perfil sem empresa associada.')

      const buildQuery = (field: 'nome' | 'telefone') => {
        let q = sb
          .from('leads')
          .select('id,nome,telefone,status,assigned_to')
          .eq('company_id', profile.company_id)
          .not('telefone', 'is', null)
          .ilike(field, `%${term.replace(/[%_,()]/g, '')}%`)
          .limit(12)

        if (profile.role === 'parceiro') q = q.eq('assigned_to', user.id)
        return q
      }

      const [nameRes, phoneRes] = await Promise.all([
        buildQuery('nome'),
        buildQuery('telefone'),
      ])

      if (nameRes.error) throw nameRes.error
      if (phoneRes.error) throw phoneRes.error

      const merged = new Map<string, VoiceLead>()
      ;[...(nameRes.data ?? []), ...(phoneRes.data ?? [])].forEach((lead: any) => {
        if (lead?.id && lead?.telefone) merged.set(lead.id, lead as VoiceLead)
      })

      setResults(Array.from(merged.values()).slice(0, 15))
      if (merged.size === 0) setError('Nenhuma lead encontrada.')
    } catch (err: any) {
      setError(err?.message || 'Erro ao pesquisar leads.')
    } finally {
      setSearching(false)
    }
  }

  async function pollCall(callId: string, token: string) {
    try {
      const res = await fetch(`${LUMIN_GATEWAY}/api/sd-dialer/call/${callId}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.detail || 'Erro ao consultar a chamada.')

      const status = json.status as typeof callStatus
      setCallStatus(status)

      const labels: Record<string, string> = {
        queued: 'Na fila...',
        preparing: 'A preparar a chamada...',
        ringing: 'Telefone a tocar...',
        answered: 'Cliente atendeu. A ligar o Lumin...',
        connected: 'Lumin ligado à chamada.',
        failed: json.error || 'A chamada falhou.',
      }
      setCallMessage(labels[status] || status)

      if (!['connected', 'failed'].includes(status)) {
        pollTimer.current = setTimeout(() => pollCall(callId, token), 1200)
      }
    } catch (err: any) {
      setCallStatus('failed')
      setCallMessage(err?.message || 'Erro ao acompanhar a chamada.')
    }
  }

  async function startCall() {
    if (!selected || ['queued', 'preparing', 'ringing', 'answered'].includes(callStatus)) return
    setError('')
    setCallStatus('queued')
    setCallMessage('A iniciar chamada...')

    try {
      const token = await getSessionToken()
      const res = await fetch(`${LUMIN_GATEWAY}/api/sd-dialer/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          lead_id: selected.id,
          agent_id: agentId,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.detail || 'Não foi possível iniciar a chamada.')

      setCallStatus(json.status || 'queued')
      setCallMessage('Chamada iniciada.')
      pollCall(json.callId, token)
    } catch (err: any) {
      setCallStatus('failed')
      setCallMessage(err?.message || 'Falha ao iniciar chamada.')
    }
  }

  const agent = VOICE_AGENTS.find(a => a.id === agentId)!

  return (
    <>
    <style>{`
      .lumin-call-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.15fr) minmax(280px, .85fr);
        gap: 16px;
        align-items: start;
        width: 100%;
      }
      .lumin-call-card,
      .lumin-call-status {
        min-width: 0;
        width: 100%;
        box-sizing: border-box;
      }
      @media (max-width: 760px) {
        .lumin-call-grid {
          grid-template-columns: 1fr;
        }
        .lumin-call-status {
          min-height: 0 !important;
        }
      }
    `}</style>
    <div className="lumin-call-grid">
      <div className="lumin-call-card" style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#111827,#7C3AED)', display: 'grid', placeItems: 'center' }}>
            <PhoneCall size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A' }}>Ligar com Lumin</div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>A IA liga à lead escolhida e conversa por voz.</div>
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 6, textTransform: 'uppercase' }}>1. Procurar lead</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') searchLeads() }}
                placeholder="Nome ou telefone..."
                style={{ width: '100%', padding: '10px 12px 10px 34px', border: '1.5px solid #E2E8F0', borderRadius: 9, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <button onClick={searchLeads} disabled={searching} style={{ padding: '0 14px', borderRadius: 9, border: 'none', background: '#0F172A', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', opacity: searching ? .65 : 1 }}>
              {searching ? 'A procurar...' : 'Procurar'}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginTop: 10, fontSize: 12, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 10px' }}>
            <AlertCircle size={13} /> {error}
          </div>
        )}

        {results.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10, maxHeight: 260, overflowY: 'auto' }}>
            {results.map(lead => {
              const active = selected?.id === lead.id
              return (
                <button
                  key={lead.id}
                  onClick={() => { setSelected(lead); setCallStatus('idle'); setCallMessage('Pronto para ligar.') }}
                  style={{
                    textAlign: 'left', padding: '10px 12px', borderRadius: 9, cursor: 'pointer',
                    background: active ? '#EFF6FF' : '#F8FAFC',
                    border: `1px solid ${active ? '#93C5FD' : '#E2E8F0'}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A' }}>{lead.nome}</span>
                    {active && <CheckCircle2 size={15} color="#2563EB" />}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{lead.telefone} · {lead.status}</div>
                </button>
              )
            })}
          </div>
        )}

        <div style={{ marginTop: 18 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 6, textTransform: 'uppercase' }}>2. Agente</label>
          <select
            value={agentId}
            onChange={e => setAgentId(e.target.value as typeof agentId)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', background: '#fff', color: '#0F172A', fontSize: 13.5 }}
          >
            {VOICE_AGENTS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
          <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 5 }}>{agent.detail}</div>
        </div>
      </div>

      <div className="lumin-call-status" style={{
        background: 'linear-gradient(160deg,#0F172A,#111827 60%,#312E81)',
        color: '#fff', borderRadius: 16, padding: 20, minHeight: 270,
        boxShadow: '0 12px 32px rgba(15,23,42,.16)',
      }}>
        <div style={{ fontSize: 11, color: '#A5B4FC', fontWeight: 800, letterSpacing: '.08em' }}>LUMIN VOICE</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 8 }}>{selected?.nome || 'Escolhe uma lead'}</div>
        <div style={{ fontSize: 13, color: '#CBD5E1', marginTop: 3 }}>{selected?.telefone || 'A chamada sai pelo número autorizado do Lumin.'}</div>

        <div style={{ marginTop: 24, padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.08)' }}>
          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 5 }}>ESTADO</div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: callStatus === 'failed' ? '#FCA5A5' : callStatus === 'connected' ? '#86EFAC' : '#fff' }}>
            {callMessage}
          </div>
        </div>

        <button
          onClick={startCall}
          disabled={!selected || ['queued','preparing','ringing','answered'].includes(callStatus)}
          style={{
            width: '100%', marginTop: 18, minHeight: 48, borderRadius: 11, border: 'none',
            background: selected ? 'linear-gradient(135deg,#C4B5FD,#818CF8)' : '#334155',
            color: selected ? '#111827' : '#94A3B8', fontSize: 14, fontWeight: 900,
            cursor: selected ? 'pointer' : 'not-allowed',
          }}
        >
          {['queued','preparing','ringing','answered'].includes(callStatus) ? 'A LIGAR...' : '📞 LIGAR COM LUMIN'}
        </button>

        <div style={{ fontSize: 10.5, lineHeight: 1.5, color: '#94A3B8', marginTop: 12 }}>
          O Lumin identifica-se como assistente virtual de IA. Leads marcadas como não interessadas, desligadas ou com número inválido ficam bloqueadas para nova chamada.
        </div>
      </div>
    </div>
    </>
  )
}


function AssistenteComercial() {
  const [segmento, setSegmento] = useState<'telecom' | 'energia'>('telecom')
  const [pergunta, setPergunta] = useState('')
  const [morada, setMorada] = useState('')
  const [historico, setHistorico] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [loading, setLoading] = useState(false)

  async function handleSend() {
    if (!pergunta.trim() || loading) return
    const perguntaAtual = pergunta
    setHistorico(h => [...h, { role: 'user', content: perguntaAtual }])
    setPergunta('')
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/assistente-comercial', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ pergunta: perguntaAtual, segmento, morada: morada || undefined }),
      })
      const json = await res.json()
      setHistorico(h => [...h, { role: 'assistant', content: json.resposta ?? json.error ?? 'Erro sem detalhe.' }])
    } catch (err) {
      setHistorico(h => [...h, { role: 'assistant', content: 'Erro ao contactar o assistente. Tenta outra vez.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10,
        padding: '10px 14px', fontSize: 12.5, color: '#92400E',
      }}>
        ⚠️ Os preços vêm de uma tabela interna atualizada manualmente pela equipa (não em tempo real da ANACOM — essa fonte bloqueia acesso automático). A cobertura de rede depende de uma ligação ainda a finalizar.
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {(['telecom', 'energia'] as const).map(s => (
          <button
            key={s}
            onClick={() => setSegmento(s)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              background: segmento === s ? '#2563EB' : '#F1F5F9',
              color: segmento === s ? '#fff' : '#64748B',
            }}
          >
            {s === 'telecom' ? <Wifi size={14} /> : <Zap size={14} />}
            {s === 'telecom' ? 'Telecom' : 'Energia'}
          </button>
        ))}
      </div>

      <input
        value={morada}
        onChange={e => setMorada(e.target.value)}
        placeholder="Morada do cliente (opcional, ajuda a IA a contextualizar)"
        style={{ padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none' }}
      />

      <div style={{
        background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0',
        minHeight: 200, maxHeight: 400, overflowY: 'auto', padding: 16,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {historico.length === 0 ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
            <Sparkles size={24} style={{ marginBottom: 8 }} />
            <div>Pergunta algo tipo: "Qual o melhor pacote MEO para este cliente?"</div>
          </div>
        ) : (
          historico.map((m, i) => (
            <div key={i} style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%', padding: '10px 14px', borderRadius: 12,
              background: m.role === 'user' ? '#2563EB' : '#F8FAFC',
              color: m.role === 'user' ? '#fff' : '#0F172A',
              fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap',
            }}>
              {m.content}
            </div>
          ))
        )}
        {loading && <Loader2 size={16} style={{ animation: 'spin 0.75s linear infinite', alignSelf: 'flex-start' }} color="#2563EB" />}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={pergunta}
          onChange={e => setPergunta(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
          placeholder="Escreve a tua pergunta..."
          style={{ flex: 1, padding: '11px 14px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none' }}
        />
        <button
          onClick={handleSend}
          disabled={loading || !pergunta.trim()}
          style={{
            width: 44, height: 44, borderRadius: 10, border: 'none',
            background: '#2563EB', color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: loading || !pergunta.trim() ? 0.6 : 1, flexShrink: 0,
          }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}

export default function ChamadasIAPage() {
  const [tab, setTab] = useState<'ligar' | 'historico' | 'assistente'>('ligar')
  const { data, isLoading, mutate } = useSWR(
    '/api/recordings?limit=50',
    fetcher,
    { revalidateOnMount: true }
  )

  const recordings: Recording[] = data?.recordings ?? []

  async function handleAnalyse(recordingId: string) {
    try {
      const res = await fetch('/api/recordings/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recording_id: recordingId }),
      })
      if (!res.ok) {
        const json = await res.json()
        console.error('[ChamadasIA] analyse error:', json.error)
      }
    } catch (err) {
      console.error('[ChamadasIA] analyse exception:', err)
    }
    await mutate()
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #2563EB, #7C3AED)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AudioLines size={18} color="#fff" />
            </div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0F172A' }}>
              Chamadas Inteligentes
            </h1>
          </div>
          <p style={{ margin: '6px 0 0 46px', fontSize: 13, color: '#64748B' }}>
            Chamadas por voz com Lumin, historico e analise de IA
          </p>
        </div>
        <button
          onClick={() => mutate()}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 8,
            border: '1px solid #E2E8F0', background: '#fff',
            fontSize: 13, color: '#374151', cursor: 'pointer', fontWeight: 500,
          }}
        >
          <RefreshCw size={14} />
          Atualizar
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 4, background: '#F1F5F9', borderRadius: 10, padding: 4, marginBottom: 20, width: '100%', boxSizing: 'border-box' }}>
        {[
          { key: 'ligar' as const, label: 'Ligar com Lumin', icon: <PhoneCall size={14} /> },
          { key: 'historico' as const, label: 'Histórico', icon: <AudioLines size={14} /> },
          { key: 'assistente' as const, label: 'Assistente Comercial', icon: <Sparkles size={14} /> },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 10px', borderRadius: 7, border: 'none',
              fontSize: 12.5, fontWeight: 600, cursor: 'pointer', minWidth: 0,
              background: tab === t.key ? '#fff' : 'transparent',
              color: tab === t.key ? '#0F172A' : '#64748B',
              boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'ligar' ? <LuminCallPanel /> : tab === 'assistente' ? <AssistenteComercial /> : (
        <>
      {/* Stats bar */}
      {recordings.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'Total de gravacoes', value: recordings.length },
            { label: 'Analisadas', value: recordings.filter(r => r.status === 'analysed').length },
            {
              label: 'Score medio',
              value: (() => {
                const scored = recordings.filter(r => r.ai_analyses?.[0]?.score != null)
                if (!scored.length) return '--'
                const avg = scored.reduce((s, r) => s + (r.ai_analyses![0].score ?? 0), 0) / scored.length
                return Math.round(avg) + '/100'
              })(),
            },
          ].map(stat => (
            <div key={stat.label} style={{
              flex: 1, minWidth: 140,
              padding: '12px 16px', borderRadius: 10,
              background: '#fff', border: '1px solid #E2E8F0',
            }}>
              <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>{stat.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A' }}>{stat.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 10 }}>
          <Loader2 size={22} color="#2563EB" style={{ animation: 'spin 0.75s linear infinite' }} />
          <span style={{ color: '#64748B', fontSize: 14 }}>A carregar gravacoes...</span>
        </div>
      ) : recordings.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: '#EFF6FF', margin: '0 auto 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Mic size={28} color="#93C5FD" />
          </div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#0F172A', marginBottom: 8 }}>
            Sem gravacoes ainda
          </div>
          <div style={{ fontSize: 13, color: '#64748B', maxWidth: 320, margin: '0 auto' }}>
            As suas gravacoes de chamadas aparecem aqui apos gravar e enviar uma chamada.
            Use o botao Gravar Chamada durante uma chamada ativa.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {recordings.map(r => (
            <RecordingRow key={r.id} recording={r} onAnalyse={handleAnalyse} />
          ))}
        </div>
      )}
        </>
      )}
    </div>
  )
}
