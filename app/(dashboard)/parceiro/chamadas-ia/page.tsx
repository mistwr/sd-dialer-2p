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
  Clock, Megaphone, Calendar, RefreshCw, Loader2, Mic,
  Sparkles, Send, Wifi, Zap, PhoneCall, AlertCircle,
  Plus, Copy, Trash2,
} from 'lucide-react'
import AIAnalysisPanel from '@/components/ai/AIAnalysisPanel'
import VoiceLeadPicker from '@/components/ai/VoiceLeadPicker'
import VoiceCallHistory from '@/components/ai/VoiceCallHistory'
import { VoiceCallQueue } from '@/lib/utils/voice-call-queue'
import type { VoiceLead } from '@/lib/utils/voice-leads'
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




const VOICE_AGENTS = [
  { id: 'lumin-telecom', label: 'Compara+ Telecom', detail: 'Qualifica o interesse em internet e televisão e agenda uma comparação.' },
  { id: 'lumin-energia', label: 'Lumin Energia', detail: 'Qualifica energia e fecha interesse para comparação.' },
  { id: 'lumin-ai', label: 'Lumin AI Comercial', detail: 'Vende a plataforma LUMIN AI de forma consultiva.' },
] as const

type VoiceAgentId = (typeof VOICE_AGENTS)[number]['id']
type CallerIdRecord = {
  id: string
  phoneNumber: string
  status: 'pending' | 'verified' | 'failed'
  isActive: boolean
  requestedAt?: string | null
  verifiedAt?: string | null
  validationCode?: string | null
}

function normalizeCallerIdInput(phone: string) {
  let normalized = phone.replace(/[^0-9+]/g, '')
  if (normalized.startsWith('00')) normalized = '+' + normalized.slice(2)
  else if (normalized.startsWith('351') && !normalized.startsWith('+')) normalized = '+' + normalized
  else if (/^\d{9}$/.test(normalized)) normalized = '+351' + normalized
  return normalized
}

function LuminCallPanel() {
  const [selectedLeads, setSelectedLeads] = useState<VoiceLead[]>([])
  const queue = useRef<VoiceCallQueue<VoiceLead> | null>(null)
  const [, refreshQueue] = useState(0)
  const requestBusy = useRef(false)
  const alive = useRef(true)
  const [selected, setSelected] = useState<VoiceLead | null>(null)
  const [callMode, setCallMode] = useState<'lead' | 'manual'>('lead')
  const [manualPhone, setManualPhone] = useState('')
  const [manualName, setManualName] = useState('')
  const [agentId, setAgentId] = useState<VoiceAgentId>('lumin-telecom')
  const [agentStorageKey, setAgentStorageKey] = useState('')
  const [agentReady, setAgentReady] = useState(false)
  const [callStatus, setCallStatus] = useState<'idle' | 'queued' | 'preparing' | 'ringing' | 'answered' | 'connected' | 'ended' | 'failed'>('idle')
  const [callMessage, setCallMessage] = useState('Escolhe uma lead ou introduz um número autorizado para contacto.')
  const [error, setError] = useState('')
  const [callerPhone, setCallerPhone] = useState('')
  const [callerIdActive, setCallerIdActive] = useState<CallerIdRecord | null>(null)
  const [callerIdNumbers, setCallerIdNumbers] = useState<CallerIdRecord[]>([])
  const [callerIdRemoving, setCallerIdRemoving] = useState<string | null>(null)
  const [callerIdPending, setCallerIdPending] = useState<CallerIdRecord | null>(null)
  const [callerIdFailed, setCallerIdFailed] = useState<CallerIdRecord | null>(null)
  const [callerIdVerificationAvailable, setCallerIdVerificationAvailable] = useState(false)
  const [callerIdLoading, setCallerIdLoading] = useState(true)
  const [callerIdSaving, setCallerIdSaving] = useState(false)
  const [callerIdError, setCallerIdError] = useState('')
  const [callerIdMessage, setCallerIdMessage] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const callerIdPollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    alive.current = true
    return () => {
    alive.current = false
    queue.current?.stop()
    if (pollTimer.current) clearTimeout(pollTimer.current)
    }
  }, [])

  useEffect(() => {
    let active = true

    async function loadAgentChoice() {
      let key = ''
      let selectedAgent: unknown = null
      try {
        const sb = createClient()
        const { data: { user } } = await sb.auth.getUser()
        if (user) {
          key = 'sd-dialer-agent-v1:' + user.id
          selectedAgent = window.localStorage.getItem(key)

          // Preserve the previously selected agent when moving away from local script settings.
          if (!VOICE_AGENTS.some(item => item.id === selectedAgent)) {
            const oldKey = 'sd-dialer-voice-profiles-v2:' + user.id
            const raw = window.localStorage.getItem(oldKey)
            const saved = raw ? JSON.parse(raw) : null
            const selectedProfile = Array.isArray(saved?.profiles)
              ? saved.profiles.find((profile: any) => profile?.id === saved.activeProfileId)
              : null
            selectedAgent = selectedProfile?.agentId
          }
        }
      } catch {
        selectedAgent = null
      }

      if (!active) return
      const validAgent = VOICE_AGENTS.some(item => item.id === selectedAgent)
      setAgentId(validAgent ? selectedAgent as VoiceAgentId : 'lumin-telecom')
      setAgentStorageKey(key)
      setAgentReady(true)
    }

    loadAgentChoice()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!agentReady || !agentStorageKey) return
    try {
      window.localStorage.setItem(agentStorageKey, agentId)
    } catch {}
  }, [agentReady, agentStorageKey, agentId])

  async function getSessionToken() {
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session?.access_token) throw new Error('Sessão expirada. Entra novamente no SD Dialer.')
    return session.access_token
  }

  async function fetchCallerIdentity(token: string) {
    const res = await fetch('/api/sd-dialer/caller-id', {
      headers: { Authorization: 'Bearer ' + token },
      cache: 'no-store',
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.detail || 'Erro ao consultar o número de saída.')
    const active = (json.active ?? null) as CallerIdRecord | null
    const pending = (json.pending ?? null) as CallerIdRecord | null
    const failed = (json.failed ?? null) as CallerIdRecord | null
    const numbers = Array.isArray(json.numbers)
      ? json.numbers as CallerIdRecord[]
      : active ? [active] : []
    setCallerIdActive(active)
    setCallerIdNumbers(numbers)
    setCallerIdPending(pending)
    setCallerIdFailed(failed)
    setCallerIdVerificationAvailable(Boolean(json.verificationAvailable))
    setVerificationCode(pending?.validationCode || '')
    setCallerIdError('')
    return { active, pending, failed, numbers }
  }

  function scheduleCallerIdentityPoll(token: string) {
    if (callerIdPollTimer.current) clearTimeout(callerIdPollTimer.current)
    callerIdPollTimer.current = setTimeout(() => pollCallerIdentity(token), 3000)
  }

  async function pollCallerIdentity(token: string) {
    try {
      const result = await fetchCallerIdentity(token)
      if (result.pending) scheduleCallerIdentityPoll(token)
    } catch (err: any) {
      setCallerIdError(err?.message || 'Não foi possível atualizar a verificação.')
    }
  }

  useEffect(() => {
    let active = true
    async function loadCallerIdentity() {
      try {
        const token = await getSessionToken()
        const result = await fetchCallerIdentity(token)
        if (active && result.pending) {
          scheduleCallerIdentityPoll(token)
        }
      } catch (err: any) {
        if (active) setCallerIdError(err?.message || 'Não foi possível carregar o número de saída.')
      } finally {
        if (active) setCallerIdLoading(false)
      }
    }
    void loadCallerIdentity()
    return () => {
      active = false
      if (callerIdPollTimer.current) clearTimeout(callerIdPollTimer.current)
    }
  }, [])

  async function startCallerIdVerification() {
    if (!callerPhone.trim() || callerIdSaving || callerIdRemoving || callIsBusy) return
    if (!callerIdVerificationAvailable) {
      setCallerIdError('A validação de números pessoais ainda não está configurada. Pede ao superadministrador para ativar a integração Twilio.')
      return
    }
    setCallerIdSaving(true)
    setCallerIdError('')
    setCallerIdMessage('')
    setVerificationCode('')
    try {
      const token = await getSessionToken()
      const res = await fetch('/api/sd-dialer/caller-id/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({ phone: callerPhone.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.detail || 'Não foi possível verificar o número.')
      const result = await fetchCallerIdentity(token)
      if (result.active?.phoneNumber === normalizeCallerIdInput(callerPhone)) {
        setCallerIdMessage('Este número já está verificado e ficou ativo para as chamadas.')
      } else {
        setCallerIdMessage(result.pending ? 'A Twilio vai ligar para ' + result.pending.phoneNumber + '. Atende e introduz o código abaixo.' : 'O número foi atualizado.')
        if (result.pending) scheduleCallerIdentityPoll(token)
      }
    } catch (err: any) {
      setCallerIdError(err?.message || 'Falha ao iniciar a verificação.')
    } finally {
      setCallerIdSaving(false)
    }
  }


  async function removeCallerIdNumber(record: CallerIdRecord) {
    if (!record.id || callerIdRemoving || callerIdSaving || callIsBusy) return
    const confirmation = window.confirm(
      'Remover ' + record.phoneNumber + ' da associação ao teu utilizador? A validação na Twilio mantém-se, mas este número deixa de poder ser usado nas tuas chamadas de IA.'
    )
    if (!confirmation) return

    setCallerIdRemoving(record.id)
    setCallerIdError('')
    setCallerIdMessage('')
    try {
      const token = await getSessionToken()
      const res = await fetch(
        '/api/sd-dialer/caller-id/' + encodeURIComponent(record.id),
        {
          method: 'DELETE',
          headers: { Authorization: 'Bearer ' + token },
        },
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.detail || 'Não foi possível remover o número.')
      await fetchCallerIdentity(token)
      setCallerIdMessage('Número removido da tua associação. A validação da Twilio mantém-se.')
    } catch (err: any) {
      setCallerIdError(err?.message || 'Falha ao remover o número.')
    } finally {
      setCallerIdRemoving(null)
    }
  }

  async function pollCall(callId: string, token: string, leadId?: string) {
    try {
      const res = await fetch(`/api/sd-dialer/call/${callId}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.detail || 'Erro ao consultar a chamada.')

      if (!alive.current) return
      const status = json.status as typeof callStatus
      setCallStatus(status)

      const labels: Record<string, string> = {
        queued: 'Na fila...',
        preparing: 'A preparar a chamada...',
        ringing: 'Telefone a tocar...',
        answered: 'Cliente atendeu. A ligar o Lumin...',
        connected: 'Assistente Compara+ ligado à chamada.',
        ended: 'Chamada terminada. Podes selecionar a próxima lead.',
        failed: json.error || 'A chamada falhou.',
      }
      setCallMessage(labels[status] || status)

      if (['ended', 'failed'].includes(status)) {
        if (leadId && queue.current?.complete(leadId)) {
          refreshQueue(value => value + 1)
          pollTimer.current = setTimeout(() => advanceQueue(), 1500)
        }
      } else {
        pollTimer.current = setTimeout(async () => {
          try { await pollCall(callId, await getSessionToken(), leadId) }
          catch { await pollCall(callId, token, leadId) }
        }, 1500)
      }
    } catch (err: any) {
      if (!alive.current) return
      queue.current?.pause()
      refreshQueue(value => value + 1)
      setCallMessage('Ligação interrompida. A confirmar o fim da chamada; a fila ficou pausada.')
      pollTimer.current = setTimeout(() => pollCall(callId, token, leadId), 5000)
    }
  }

  const callIsBusy = Boolean(queue.current?.active) || ['queued', 'preparing', 'ringing', 'answered', 'connected'].includes(callStatus)
  const canStartCall = agentReady && !callerIdLoading && Boolean(callerIdActive) && (callMode === 'lead'
    ? Boolean(selected)
    : Boolean(manualPhone.trim() && manualName.trim() && manualPhone.replace(/\D/g, '').length >= 9))

  const queueActive = queue.current?.mode === 'running' || queue.current?.mode === 'paused'
  const controlsLocked = callIsBusy || queueActive
  useEffect(() => {
    if (!controlsLocked) return
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warnBeforeLeaving)
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving)
  }, [controlsLocked])

  async function advanceQueue() {
    if (!alive.current || requestBusy.current) return
    const lead = queue.current?.take()
    refreshQueue(value => value + 1)
    if (lead) { setSelected(lead); await startCall(lead) }
  }

  function startSelectedCalls() {
    if (!canStartCall || controlsLocked || requestBusy.current) return
    if (callMode === 'lead' && selectedLeads.length > 1) {
      queue.current = new VoiceCallQueue(selectedLeads)
      void advanceQueue()
    } else { queue.current = null; void startCall() }
  }

  async function startCall(queuedLead?: VoiceLead) {
    if (requestBusy.current || (!queuedLead && (!canStartCall || callIsBusy))) return
    requestBusy.current = true
    setError('')
    setCallStatus('queued')
    setCallMessage('A iniciar chamada...')

    try {
      const token = await getSessionToken()
      const lead = queuedLead || selected
      const requestBody = callMode === 'lead' && lead
        ? { lead_id: lead.id, agent_id: agentId }
        : {
            phone: manualPhone.trim(),
            name: manualName.trim(),
            consent_confirmed: true,
            agent_id: agentId,
          }
      const res = await fetch(`/api/sd-dialer/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      })
      const json = await res.json()
      if (!res.ok) {
        if (queuedLead) queue.current?.complete(queuedLead.id)
        throw new Error(json.detail || 'Não foi possível iniciar a chamada.')
      }

      if (!json.callId) throw new Error('Sem identificador de chamada. Verifica o histórico antes de voltar a ligar.')
      if (!alive.current) return
      setCallStatus(json.status || 'queued')
      setCallMessage('Chamada iniciada.')
      void pollCall(json.callId, token, queuedLead?.id)
    } catch (err: any) {
      queue.current?.stop()
      setCallStatus('failed')
      setCallMessage((err?.message || 'Falha ao iniciar chamada.') + ' Verifica o histórico antes de repetir.')
      // An uncertain POST must never automatically retry or release the next lead.
      refreshQueue(value => value + 1)
    } finally { requestBusy.current = false }
  }

  const agent = VOICE_AGENTS.find(a => a.id === agentId) ?? VOICE_AGENTS[0]

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
      .lumin-call-card {
        background: #0B0A08 !important;
        border-color: #332C21 !important;
        border-radius: 17px !important;
        color: #F7F0E2 !important;
        box-shadow: 0 18px 42px rgba(0,0,0,.2) !important;
      }
      .lumin-call-card div:not([role="alert"]):not([style*="background"]) {
        color: #D8CEBA !important;
      }
      .lumin-call-card label {
        color: #CDBFA3 !important;
      }
      .lumin-call-card input,
      .lumin-call-card select,
      .lumin-call-card textarea {
        color-scheme: dark;
        background: #13110D !important;
        color: #F5EEDC !important;
        border-color: #383228 !important;
      }
      .lumin-call-card input::placeholder,
      .lumin-call-card textarea::placeholder {
        color: #847968 !important;
      }
      .lumin-call-card section {
        border-color: #352F24 !important;
      }
      .lumin-call-card button:not([aria-pressed]) {
        background: #18150F !important;
        color: #F1E7D1 !important;
        border: 1px solid #3B3327 !important;
      }
      .lumin-call-card button[aria-pressed="false"] {
        background: #171510 !important;
        color: #E8DDC7 !important;
        border-color: #393329 !important;
      }
      .lumin-call-card button[aria-pressed="true"] {
        background: #2A2114 !important;
        color: #FFE6B0 !important;
        border-color: #D5AA56 !important;
      }
      .lumin-call-status {
        background: linear-gradient(155deg,#0C0B09,#17130D 66%,#342315) !important;
        border: 1px solid #382E20 !important;
        box-shadow: 0 18px 42px rgba(0,0,0,.24) !important;
      }
      .lumin-call-status > button:last-of-type:not(:disabled) {
        background: linear-gradient(100deg,#FFE2AB,#D9A849) !important;
        color: #211807 !important;
      }
      .lumin-call-status > button:last-of-type:disabled {
        background: #33302B !important;
        color: #938976 !important;
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
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Escolhe um contacto e carrega em Ligar.</div>
          </div>
        </div>

        <section aria-label="Número de saída" style={{ marginTop: 16, padding: 13, borderRadius: 11, background: '#13110D', border: '1px solid #383228' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#F5EEDC' }}>Número de saída</div>
          <div style={{ fontSize: 11.5, lineHeight: 1.5, color: '#B7AA91', marginTop: 4 }}>
            Cada utilizador faz chamadas apenas a partir do seu próprio número validado na Twilio.
          </div>
          {callerIdActive && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#86EFAC' }}>
              Número validado para as tuas chamadas: <strong>{callerIdActive.phoneNumber}</strong>
            </div>
          )}
          {!callerIdActive && (
            <div style={{ marginTop: 8, fontSize: 11.5, lineHeight: 1.5, color: '#FCA5A5' }}>
              Valida o teu número pessoal para desbloquear as chamadas de IA. O número de outros utilizadores não é usado como alternativa.
            </div>
          )}
          {callerIdFailed && !callerIdPending && (
            <div role="alert" style={{ marginTop: 8, padding: 9, borderRadius: 8, background: '#281414', color: '#FCA5A5', fontSize: 11.5, lineHeight: 1.5 }}>
              A última verificação falhou. Confirma que atendeste à chamada da Twilio e introduziste o código corretamente; depois podes tentar novamente.
            </div>
          )}
          {callerIdPending && (
            <div style={{ marginTop: 8, padding: 9, borderRadius: 8, background: '#211B10', color: '#FFE6B0', fontSize: 11.5, lineHeight: 1.5 }}>
              A Twilio está a ligar para {callerIdPending.phoneNumber}. Atende e marca este código no teclado do telefone:
              <div style={{ fontSize: 20, letterSpacing: '.16em', fontWeight: 900, marginTop: 3 }}>{verificationCode || '— — — — — —'}</div>
              Se já tinhas um número validado, continua ativo até a nova validação terminar.
            </div>
          )}
          <div style={{ display: callerIdVerificationAvailable ? 'flex' : 'none', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <input
              type="tel"
              autoComplete="tel"
              value={callerPhone}
              onChange={e => setCallerPhone(e.target.value)}
              placeholder="+351 912 345 678"
              aria-label="O teu número de telefone"
              style={{ flex: '1 1 190px', minWidth: 0, padding: '9px 10px', border: '1px solid #383228', borderRadius: 8, fontSize: 12.5, boxSizing: 'border-box' }}
            />
            <button
              type="button"
              onClick={startCallerIdVerification}
              disabled={callerIdLoading || !callerIdVerificationAvailable || callerIdSaving || Boolean(callerIdRemoving) || callIsBusy || !callerPhone.trim()}
              style={{ padding: '0 12px', border: '1px solid #D5AA56', borderRadius: 8, color: '#FFE6B0', fontSize: 11.5, fontWeight: 800, cursor: callerIdLoading || !callerIdVerificationAvailable || callerIdSaving || callerIdRemoving || callIsBusy || !callerPhone.trim() ? 'not-allowed' : 'pointer', opacity: !callerIdVerificationAvailable ? 0.55 : 1 }}
            >
              {callerIdSaving ? 'A iniciar…' : !callerIdVerificationAvailable ? 'Verificação indisponível' : callerIdActive ? 'Verificar outro número' : 'Verificar número'}
            </button>
          </div>
          {callerIdLoading && <div style={{ marginTop: 7, fontSize: 11, color: '#B7AA91' }}>A carregar a configuração…</div>}
          {!callerIdLoading && !callerIdVerificationAvailable && <div style={{ marginTop: 7, fontSize: 11, color: '#B7AA91' }}>A integração Twilio para validar números pessoais ainda não está ativa. Pede ajuda ao superadministrador.</div>}
          {callerIdMessage && <div role="status" style={{ marginTop: 7, fontSize: 11.5, color: '#86EFAC' }}>{callerIdMessage}</div>}
          {callerIdError && <div role="alert" style={{ marginTop: 7, fontSize: 11.5, color: '#FCA5A5' }}>{callerIdError}</div>}

          {!callerIdLoading && (
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #352F24' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 7 }}>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: '#F5EEDC' }}>Números associados</span>
                <span style={{ fontSize: 10.5, color: '#B7AA91' }}>{callerIdNumbers.length} verificado{callerIdNumbers.length === 1 ? '' : 's'}</span>
              </div>
              {callerIdNumbers.length === 0 ? (
                <div style={{ fontSize: 11, lineHeight: 1.45, color: '#B7AA91' }}>Ainda não tens números pessoais verificados nesta conta.</div>
              ) : (
                <div style={{ display: 'grid', gap: 6 }}>
                  {callerIdNumbers.map(record => (
                    <div key={record.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 9px', borderRadius: 8, background: '#1A1711', border: '1px solid #383228', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
                        <strong style={{ fontSize: 12, color: '#F5EEDC' }}>{record.phoneNumber}</strong>
                        <span style={{ fontSize: 10, padding: '3px 7px', borderRadius: 99, background: record.isActive ? '#15351F' : '#252118', color: record.isActive ? '#86EFAC' : '#D8CEBA' }}>
                          {record.isActive ? 'Ativo para chamadas' : 'Verificado'}
                        </span>
                      </div>
                      <button
                        type="button"
                        aria-label={`Remover ${record.phoneNumber} da conta Twilio`}
                        title="Remover número"
                        onClick={() => void removeCallerIdNumber(record)}
                        disabled={Boolean(callerIdRemoving) || callerIdSaving || callIsBusy}
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '6px 8px', borderRadius: 7, fontSize: 10.5, fontWeight: 700, cursor: callerIdRemoving || callIsBusy ? 'not-allowed' : 'pointer', opacity: callerIdRemoving || callIsBusy ? 0.6 : 1 }}
                      >
                        {callerIdRemoving === record.id ? <Loader2 size={13} /> : <Trash2 size={13} color="#FCA5A5" />}
                        {callerIdRemoving === record.id ? 'A remover…' : 'Remover'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: 4, borderRadius: 10, background: '#F1F5F9', marginBottom: 14 }}>
            <button
              type="button"
              disabled={controlsLocked}
              onClick={() => { setCallMode('lead'); setError(''); setCallStatus('idle') }}
              style={{ padding: '9px 8px', border: 0, borderRadius: 8, background: callMode === 'lead' ? '#0F172A' : 'transparent', color: callMode === 'lead' ? '#fff' : '#475569', fontSize: 12, fontWeight: 800 }}
            >
              Lead existente
            </button>
            <button
              type="button"
              disabled={controlsLocked}
              onClick={() => { setCallMode('manual'); setSelected(null); setError(''); setCallStatus('idle') }}
              style={{ padding: '9px 8px', border: 0, borderRadius: 8, background: callMode === 'manual' ? '#0F172A' : 'transparent', color: callMode === 'manual' ? '#fff' : '#475569', fontSize: 12, fontWeight: 800 }}
            >
              Número manual
            </button>
          </div>

          {callMode === 'lead' ? (
            <VoiceLeadPicker
              selectedId={selected?.id}
              selectedLeads={selectedLeads}
              onSelectionChange={leads => { setSelectedLeads(leads); setSelected(leads[0] || null) }}
              disabled={controlsLocked}
              onSelect={lead => {
                setSelected(lead)
                setError('')
                setCallStatus('idle')
                setCallMessage(lead ? 'Pronto para ligar.' : 'Escolhe uma lead para preparar a chamada.')
              }}
            />
          ) : (
            <>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 6, textTransform: 'uppercase' }}>Número a marcar</label>
              <input
                type="tel"
                autoComplete="tel"
                value={manualPhone}
                onChange={e => setManualPhone(e.target.value)}
                placeholder="+351 912 345 678"
                style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E2E8F0', borderRadius: 9, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
              <input
                value={manualName}
                onChange={e => setManualName(e.target.value)}
                placeholder="Nome da lead"
                required
                style={{ width: '100%', marginTop: 8, padding: '10px 12px', border: '1.5px solid #E2E8F0', borderRadius: 9, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
            </>
          )}
        </div>

        {error && (
          <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginTop: 10, fontSize: 12, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 10px' }}>
            <AlertCircle size={13} /> {error}
          </div>
        )}
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid #E2E8F0' }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 6, textTransform: 'uppercase' }}>Agente</label>
          <select
            value={agentId}
            onChange={e => setAgentId(e.target.value as VoiceAgentId)}
            disabled={!agentReady || controlsLocked}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', background: '#fff', color: '#0F172A', fontSize: 13.5 }}
          >
            {VOICE_AGENTS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 5 }}>{agent.detail}</div>
        </div>

        {queue.current && <section aria-label="Fila de chamadas" style={{ marginTop: 16, padding: 12, border: '1px solid #D5AA56', borderRadius: 10 }}>
          <strong role="status">{queue.current.completed} de {queue.current.total} concluídas · {queue.current.mode === 'paused' ? 'Pausada' : queue.current.mode === 'stopped' ? 'Terminada' : 'Em execução'}</strong>
          {queueActive && <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" onClick={() => {
              if (queue.current?.mode === 'paused') { queue.current.resume(); void advanceQueue() }
              else queue.current?.pause()
              refreshQueue(value => value + 1)
            }}>{queue.current.mode === 'paused' ? 'Retomar' : 'Pausar'}</button>
            <button type="button" onClick={() => { queue.current?.stop(); refreshQueue(value => value + 1) }}>Parar fila</button>
          </div>}
          <p style={{ fontSize: 11, marginBottom: 0 }}>Uma chamada de cada vez. Pausar/Parar impede a próxima; a chamada atual termina normalmente. Mantém esta página aberta. Fechar ou atualizar interrompe a fila.</p>
        </section>}

        <button
          type="button"
          onClick={startSelectedCalls}
          disabled={!canStartCall || controlsLocked}
          style={{
            width: '100%', marginTop: 14, minHeight: 50, borderRadius: 11, border: 'none',
            background: canStartCall ? '#2563EB' : '#E2E8F0',
            color: canStartCall ? '#fff' : '#94A3B8', fontSize: 14, fontWeight: 800,
            cursor: canStartCall ? 'pointer' : 'not-allowed',
          }}
        >
          {callStatus === 'connected' ? 'CHAMADA EM CURSO' : callIsBusy ? 'A LIGAR…' : queueActive ? 'FILA ATIVA' : callMode === 'lead' && selectedLeads.length > 1 ? `📞 LIGAR ÀS ${selectedLeads.length} SELECIONADAS` : '📞 LIGAR'}
        </button>


      </div>

      <div className="lumin-call-status" style={{
        background: 'linear-gradient(160deg,#0F172A,#111827 60%,#312E81)',
        color: '#fff', borderRadius: 16, padding: 20, minHeight: 270,
        boxShadow: '0 12px 32px rgba(15,23,42,.16)',
      }}>
        <div style={{ fontSize: 11, color: '#A5B4FC', fontWeight: 800, letterSpacing: '.08em' }}>LUMIN VOICE</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 8 }}>{callMode === 'manual' ? (manualName.trim() || 'Lead manual') : (selected?.nome || 'Escolhe um contacto')}</div>
        <div style={{ fontSize: 13, color: '#CBD5E1', marginTop: 3 }}>{callMode === 'manual' ? (manualPhone.trim() || 'Número manual') : (selected?.telefone || 'Escolhe um contacto para preparar a chamada.')}</div>
        <div style={{ fontSize: 11, color: '#B7AA91', marginTop: 5 }}>{callerIdLoading ? 'A verificar número de saída…' : callerIdActive ? 'Número pessoal validado' : 'Valida o teu número pessoal'}</div>

        <div style={{ marginTop: 15, padding: '11px 12px', borderRadius: 10, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.08)' }}>
          <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 4 }}>AGENTE SELECIONADO</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{agent.label}</div>
        </div>

        {error && <div role="alert" style={{ fontSize: 11, color: '#FCA5A5', marginTop: 8 }}>{error}</div>}

        <div style={{ marginTop: 24, padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.08)' }}>
          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 5 }}>ESTADO</div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: callStatus === 'failed' ? '#FCA5A5' : callStatus === 'connected' ? '#86EFAC' : '#fff' }}>
            {callMessage}
          </div>
        </div>


        <div style={{ fontSize: 10.5, lineHeight: 1.5, color: '#94A3B8', marginTop: 12 }}>
          A voz e o guião seguem a configuração central do agente. Leads marcadas como não interessadas, desligadas ou com número inválido ficam bloqueadas.
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

function ChamadasIAPageContent() {
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

      <div style={{ display: tab === 'ligar' ? 'block' : 'none' }}><LuminCallPanel /></div>
      {tab === 'ligar' ? null : tab === 'assistente' ? <AssistenteComercial /> : (
        <>
      <VoiceCallHistory />
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


export default function ChamadasIAPage() {
  const [accessState, setAccessState] = useState<'loading' | 'active' | 'locked'>('loading')
  const [accessCode, setAccessCode] = useState('')
  const [accessError, setAccessError] = useState('')
  const [submittingCode, setSubmittingCode] = useState(false)

  async function accessToken() {
    const client = createClient()
    const { data, error } = await client.auth.getSession()
    if (error || !data.session?.access_token) throw new Error('Entra novamente no SD Dialer.')
    return data.session.access_token
  }

  useEffect(() => {
    let mounted = true
    async function checkAccess() {
      try {
        const token = await accessToken()
        const response = await fetch('/api/sd-dialer/voice-access', {
          headers: { Authorization: 'Bearer ' + token },
          cache: 'no-store',
        })
        const json = await response.json()
        if (!response.ok) throw new Error(json.detail || 'Não foi possível consultar o acesso.')
        if (mounted) setAccessState(json.active ? 'active' : 'locked')
      } catch (error) {
        if (mounted) {
          setAccessState('locked')
          setAccessError(error instanceof Error ? error.message : 'Não foi possível consultar o acesso.')
        }
      }
    }
    void checkAccess()
    return () => { mounted = false }
  }, [])

  async function redeemCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!accessCode.trim() || submittingCode) return
    setSubmittingCode(true)
    setAccessError('')
    try {
      const token = await accessToken()
      const response = await fetch('/api/sd-dialer/voice-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({ code: accessCode }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.detail || 'Código inválido ou já utilizado.')
      setAccessState('active')
      setAccessCode('')
    } catch (error) {
      setAccessError(error instanceof Error ? error.message : 'Não foi possível ativar a subscrição.')
    } finally {
      setSubmittingCode(false)
    }
  }

  if (accessState === 'loading') {
    return <main style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', color: '#64748B' }}>A verificar o acesso às chamadas de IA…</main>
  }
  if (accessState === 'active') return <ChamadasIAPageContent />

  return (
    <main style={{ minHeight: '100vh', padding: 24, background: '#F8FAFC', display: 'grid', placeItems: 'center' }}>
      <section style={{ width: 'min(100%, 520px)', background: '#11100D', color: '#F5EEDC', border: '1px solid #383228', borderRadius: 20, padding: 26, boxShadow: '0 20px 55px rgba(0,0,0,.25)' }}>
        <div style={{ color: '#E7C77D', fontSize: 12, fontWeight: 800, letterSpacing: '.12em' }}>SD DIALER · CHAMADAS IA</div>
        <h1 style={{ fontSize: 28, lineHeight: 1.15, margin: '10px 0' }}>Ativa o acesso às chamadas</h1>
        <p style={{ color: '#C5BDAE', lineHeight: 1.6, margin: '0 0 22px' }}>
          Introduz o código de subscrição fornecido pelo superadministrador. Cada código é de utilização única e fica associado a esta conta.
        </p>
        <form onSubmit={redeemCode} style={{ display: 'grid', gap: 12 }}>
          <input
            value={accessCode}
            onChange={event => setAccessCode(event.target.value)}
            placeholder="Ex.: ABCD-EFGH-IJKL"
            autoComplete="one-time-code"
            aria-label="Código de acesso às chamadas de IA"
            style={{ padding: '13px 14px', borderRadius: 10, border: '1px solid #504733', background: '#191710', color: '#F5EEDC', fontSize: 16 }}
          />
          <button type="submit" disabled={submittingCode || !accessCode.trim()} style={{ padding: 13, border: 0, borderRadius: 10, background: '#F4C96B', color: '#17130C', fontWeight: 900, fontSize: 15, opacity: submittingCode ? .7 : 1 }}>
            {submittingCode ? 'A validar…' : 'Ativar chamadas IA'}
          </button>
        </form>
        {accessError && <div role="alert" style={{ marginTop: 12, color: '#FCA5A5', lineHeight: 1.5 }}>{accessError}</div>}
      </section>
    </main>
  )
}
