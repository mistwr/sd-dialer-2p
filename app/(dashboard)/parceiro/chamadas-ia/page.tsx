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

const LUMIN_GATEWAY = 'https://lumin-voice-gateway-production.up.railway.app'


const VOICE_AGENTS = [
  { id: 'lumin-telecom', label: 'Lumin Telecom', detail: 'Qualifica telecomunicações e fecha interesse para comparação.' },
  { id: 'lumin-energia', label: 'Lumin Energia', detail: 'Qualifica energia e fecha interesse para comparação.' },
  { id: 'lumin-ai', label: 'Lumin AI Comercial', detail: 'Vende a plataforma LUMIN AI de forma consultiva.' },
] as const

type VoiceStyle = 'natural' | 'clear' | 'commercial'
type VoiceEngine = 'piper' | 'xai'
type VoiceCustomization = {
  name: string
  company: string
  objective: string
  product: string
  opening: string
  voice: VoiceStyle
  voiceEngine: VoiceEngine
}

type VoiceAgentId = (typeof VOICE_AGENTS)[number]['id']
type SavedVoiceProfile = {
  id: string
  label: string
  agentId: VoiceAgentId
  settings: VoiceCustomization
}

const MAX_VOICE_PROFILES = 12

function normalizeVoiceSettings(value: unknown, accountCompany: string): VoiceCustomization {
  const saved = value && typeof value === 'object' ? value as Partial<VoiceCustomization> : {}
  const text = (value: unknown, fallback: string, max: number) =>
    typeof value === 'string' ? value.slice(0, max) : fallback
  const hasCompany = Object.prototype.hasOwnProperty.call(saved, 'company')

  return {
    name: text(saved.name, DEFAULT_VOICE_CUSTOMIZATION.name, 48),
    company: hasCompany ? text(saved.company, '', 64) : accountCompany,
    objective: text(saved.objective, DEFAULT_VOICE_CUSTOMIZATION.objective, 180),
    product: text(saved.product, DEFAULT_VOICE_CUSTOMIZATION.product, 500),
    opening: text(saved.opening, DEFAULT_VOICE_CUSTOMIZATION.opening, 180),
    voice: saved.voice && ['natural', 'clear', 'commercial'].includes(saved.voice) ? saved.voice : 'natural',
    voiceEngine: saved.voiceEngine === 'piper' ? 'piper' : 'xai',
  }
}

function newVoiceProfileId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const DEFAULT_VOICE_CUSTOMIZATION: VoiceCustomization = {
  name: 'João',
  company: 'Soluções Diferentes',
  objective: 'Quero que faças um questionário para vender energias no primeiro dia.',
  product: '',
  opening: 'Olá! Sou o João, assistente de voz da Soluções Diferentes.',
  voice: 'natural',
  voiceEngine: 'xai',
}

const RICARDO_VOICE_PROFILE_LABEL = 'Ricardo - Qualificação telecom'
const RICARDO_VOICE_CUSTOMIZATION: VoiceCustomization = {
  name: 'Ricardo Salgado',
  company: 'Compara+',
  objective: 'Confirmar operadora e fidelização; agendar contacto comercial só se a fidelização terminou ou estiver perto do fim.',
  product: 'Só 3 passos, uma pergunta de cada vez: 1) Qual é a sua operadora? 2) Ainda está fidelizado? Se sim, até quando? 3) Se terminou ou termina em breve, oferece marcação comercial e combina dia/hora só se aceitar. Caso contrário, agradece e termina. Não repitas nem acrescentes perguntas; aproveita as respostas já dadas.',
  opening: 'Boa tarde, [nome]. Falo da Compara+. Vou ser breve.',
  voice: 'natural',
  voiceEngine: 'xai',
}

const RICARDO_VOICE_PREVIOUS_CUSTOMIZATION = {
  objective: 'Confirmar a operadora atual e o estado/data da fidelização. Se não houver fidelização ou estiver perto do fim, propor uma marcação com a equipa comercial.',
  product: 'Qualifica serviços residenciais de internet/TV, com uma pergunta de cada vez: (1) operadora atual; (2) fidelização ativa? Se sim, mês/ano de fim; se não souber, regista desconhecido sem insistir. (3) Se não tem fidelização ou termina em breve, oferece contacto comercial e só agenda se aceitar, combinando dia/período horário. Se falta bastante, regista a data, agradece e termina. Não perguntes titularidade, satisfação, preços ou email. Não vendas, não prometas poupanças e respeita recusas.',
  opening: 'Boa tarde, [nome]. Falo da Compara+. Vou ser breve: quero confirmar a operadora e a fidelização para ver se faz sentido deixar contacto da equipa comercial.',
}

const VOICE_STYLES: Array<{ id: VoiceStyle; label: string; detail: string; tone: string }> = [
  { id: 'natural', label: 'Natural', detail: 'Próxima e equilibrada', tone: 'Natural, profissional e direto.' },
  { id: 'clear', label: 'Clara', detail: 'Calma e objetiva', tone: 'Clara, calma e objetiva.' },
  { id: 'commercial', label: 'Comercial', detail: 'Enérgica e cordial', tone: 'Comercial, enérgica e cordial.' },
]

function LuminCallPanel() {
  const [selected, setSelected] = useState<VoiceLead | null>(null)
  const [callMode, setCallMode] = useState<'lead' | 'manual'>('lead')
  const [manualPhone, setManualPhone] = useState('')
  const [manualName, setManualName] = useState('')
  const [manualConsent, setManualConsent] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [voiceProfiles, setVoiceProfiles] = useState<SavedVoiceProfile[]>([])
  const [activeProfileId, setActiveProfileId] = useState('')
  const [settingsKey, setSettingsKey] = useState('')
  const [legacySettingsKey, setLegacySettingsKey] = useState('')
  const [settingsReady, setSettingsReady] = useState(false)
  const [profileNotice, setProfileNotice] = useState('')
  const [accountCompany, setAccountCompany] = useState('')
  const [callStatus, setCallStatus] = useState<'idle' | 'queued' | 'preparing' | 'ringing' | 'answered' | 'connected' | 'ended' | 'failed'>('idle')
  const [callMessage, setCallMessage] = useState('Escolhe uma lead ou introduz um número autorizado para contacto.')
  const [error, setError] = useState('')
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const previewUrlRef = useRef<string | null>(null)

  const activeProfile = voiceProfiles.find(profile => profile.id === activeProfileId) ?? voiceProfiles[0]
  const voiceSettings = activeProfile?.settings ?? DEFAULT_VOICE_CUSTOMIZATION
  const agentId = activeProfile?.agentId ?? 'lumin-energia'

  useEffect(() => () => {
    if (pollTimer.current) clearTimeout(pollTimer.current)
    previewAudioRef.current?.pause()
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
  }, [])

  useEffect(() => {
    let active = true
    async function loadCustomization() {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) {
        if (active) setSettingsReady(true)
        return
      }

      const key = 'sd-dialer-voice-profiles-v2:' + user.id
      const oldKey = 'sd-dialer-voice-profile-v1:' + user.id
      const { data: account } = await sb
        .from('usuarios')
        .select('company_id')
        .eq('id', user.id)
        .single()

      let company = ''
      if (account?.company_id) {
        const { data: companyRow } = await sb
          .from('companies')
          .select('name')
          .eq('id', account.company_id)
          .single()
        company = companyRow?.name || ''
      }

      let profiles: SavedVoiceProfile[] = []
      let activeId = ''
      try {
        const raw = window.localStorage.getItem(key)
        const parsed = raw ? JSON.parse(raw) : null
        if (Array.isArray(parsed?.profiles)) {
          profiles = parsed.profiles
            .filter((profile: any) => profile && typeof profile.id === 'string' && typeof profile.label === 'string')
            .slice(0, MAX_VOICE_PROFILES)
            .map((profile: any): SavedVoiceProfile => ({
              id: profile.id.slice(0, 100),
              label: profile.label.trim().slice(0, 56) || 'Perfil sem nome',
              agentId: VOICE_AGENTS.some(agent => agent.id === profile.agentId) ? profile.agentId : 'lumin-energia',
              settings: normalizeVoiceSettings(profile.settings, company),
            }))
          activeId = profiles.some(profile => profile.id === parsed.activeProfileId)
            ? parsed.activeProfileId
            : profiles[0]?.id || ''
        }
      } catch {}

      if (profiles.length === 0) {
        let legacy: Partial<VoiceCustomization> | null = null
        try {
          const raw = window.localStorage.getItem(oldKey)
          const parsed = raw ? JSON.parse(raw) : null
          if (parsed && typeof parsed === 'object') legacy = parsed
        } catch {}
        const settings = normalizeVoiceSettings(legacy, company)
        activeId = 'default'
        profiles = [{ id: activeId, label: settings.name.trim() || 'Perfil principal', agentId: 'lumin-energia', settings }]
      }

      if (!active) return
      setAccountCompany(company)
      setSettingsKey(key)
      setLegacySettingsKey(oldKey)
      setVoiceProfiles(profiles)
      setActiveProfileId(activeId)
      setSettingsReady(true)
    }

    loadCustomization().catch(() => {
      if (active) setSettingsReady(true)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!settingsReady || !settingsKey || !activeProfile || voiceProfiles.length === 0) return
    try {
      window.localStorage.setItem(settingsKey, JSON.stringify({ version: 2, activeProfileId, profiles: voiceProfiles }))
      // Keep the previous single-profile key current so a rollback does not lose the active setup.
      if (legacySettingsKey) window.localStorage.setItem(legacySettingsKey, JSON.stringify(voiceSettings))
    } catch {
      setProfileNotice('O navegador não conseguiu guardar o guião. Verifica o espaço disponível neste dispositivo.')
    }
  }, [settingsReady, settingsKey, legacySettingsKey, activeProfileId, activeProfile, voiceProfiles, voiceSettings])

  function updateVoiceSetting<K extends keyof VoiceCustomization>(key: K, value: VoiceCustomization[K]) {
    if (!activeProfile) return
    setVoiceProfiles(current => current.map(profile => profile.id === activeProfile.id
      ? { ...profile, settings: { ...profile.settings, [key]: value } }
      : profile))
  }

  function updateActiveProfile(updates: Partial<SavedVoiceProfile>) {
    if (!activeProfile) return
    setVoiceProfiles(current => current.map(profile => profile.id === activeProfile.id
      ? { ...profile, ...updates }
      : profile))
  }

  function createVoiceProfile(duplicate = false) {
    if (voiceProfiles.length >= MAX_VOICE_PROFILES) {
      setProfileNotice(`Podes guardar até ${MAX_VOICE_PROFILES} guiões neste dispositivo.`)
      return
    }
    const id = newVoiceProfileId()
    const label = duplicate
      ? `${activeProfile?.label || 'Guião'} (cópia)`.slice(0, 56)
      : 'Novo guião'
    const profile: SavedVoiceProfile = {
      id,
      label,
      agentId,
      settings: { ...voiceSettings },
    }
    setVoiceProfiles(current => [...current, profile])
    setActiveProfileId(id)
    setProfileNotice(duplicate ? 'Cópia criada e guardada neste dispositivo.' : 'Novo guião criado e guardado neste dispositivo.')
    stopVoiceSample()
  }

  function selectRicardoVoiceProfile() {
    const existing = voiceProfiles.find(profile => profile.label === RICARDO_VOICE_PROFILE_LABEL && profile.agentId === 'lumin-telecom')
    if (existing) {
      const settings = { ...existing.settings }
      if (settings.objective === RICARDO_VOICE_PREVIOUS_CUSTOMIZATION.objective) settings.objective = RICARDO_VOICE_CUSTOMIZATION.objective
      if (settings.product === RICARDO_VOICE_PREVIOUS_CUSTOMIZATION.product) settings.product = RICARDO_VOICE_CUSTOMIZATION.product
      if (settings.opening === RICARDO_VOICE_PREVIOUS_CUSTOMIZATION.opening) settings.opening = RICARDO_VOICE_CUSTOMIZATION.opening
      if (settings.objective !== existing.settings.objective || settings.product !== existing.settings.product || settings.opening !== existing.settings.opening) {
        setVoiceProfiles(current => current.map(profile => profile.id === existing.id ? { ...profile, settings } : profile))
      }
      setActiveProfileId(existing.id)
      setProfileNotice('Guião curto do Ricardo selecionado e atualizado.')
      stopVoiceSample()
      return
    }
    if (voiceProfiles.length >= MAX_VOICE_PROFILES) {
      setProfileNotice(`Podes guardar até ${MAX_VOICE_PROFILES} guiões neste dispositivo. Apaga um para adicionar o do Ricardo.`)
      return
    }

    const profile: SavedVoiceProfile = {
      id: newVoiceProfileId(),
      label: RICARDO_VOICE_PROFILE_LABEL,
      agentId: 'lumin-telecom',
      settings: { ...RICARDO_VOICE_CUSTOMIZATION },
    }
    setVoiceProfiles(current => [...current, profile])
    setActiveProfileId(profile.id)
    setProfileNotice('Guião do Ricardo criado e guardado neste dispositivo.')
    stopVoiceSample()
  }

  function deleteActiveProfile() {
    if (!activeProfile || voiceProfiles.length <= 1) {
      setProfileNotice('Mantém pelo menos um guião guardado.')
      return
    }
    if (!window.confirm(`Apagar o guião “${activeProfile.label}” deste dispositivo?`)) return
    const remaining = voiceProfiles.filter(profile => profile.id !== activeProfile.id)
    setVoiceProfiles(remaining)
    setActiveProfileId(remaining[0].id)
    setProfileNotice('Guião apagado deste dispositivo.')
    stopVoiceSample()
  }

  function buildAgentOverride() {
    const style = VOICE_STYLES.find(item => item.id === voiceSettings.voice)!
    const profile: Record<string, string> = {
      voice: voiceSettings.voice,
      voiceEngine: voiceSettings.voiceEngine,
      tone: '[VOICE:' + voiceSettings.voice + '] ' + style.tone,
    }
    for (const key of ['name', 'company', 'objective', 'product', 'opening'] as const) {
      const value = voiceSettings[key].trim()
      if (value) profile[key] = value
    }
    return profile
  }

  function stopVoiceSample() {
    previewAudioRef.current?.pause()
    if (previewAudioRef.current) {
      previewAudioRef.current.removeAttribute('src')
      previewAudioRef.current.load()
      previewAudioRef.current = null
    }
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
  }

  async function playVoiceSample() {
    const agentName = voiceSettings.name.trim() || agent.label
    const companyName = voiceSettings.company.trim() || accountCompany || 'a empresa'
    const sample = (voiceSettings.opening.trim() || ('Olá, sou ' + agentName + ', assistente de voz da ' + companyName + '.')).slice(0, 800)
    setError('')
    setPreviewing(true)
    stopVoiceSample()
    try {
      const token = await getSessionToken()
      const response = await fetch(`${LUMIN_GATEWAY}/api/sd-dialer/voice-preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          voice: voiceSettings.voice,
          voiceEngine: voiceSettings.voiceEngine,
          text: sample,
        }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.detail || 'Não foi possível gerar a amostra de voz.')
      }
      const audioUrl = URL.createObjectURL(await response.blob())
      const audio = new Audio(audioUrl)
      previewAudioRef.current = audio
      previewUrlRef.current = audioUrl
      audio.onended = () => {
        if (previewAudioRef.current === audio) previewAudioRef.current = null
        if (previewUrlRef.current === audioUrl) previewUrlRef.current = null
        URL.revokeObjectURL(audioUrl)
      }
      await audio.play()
    } catch (err: any) {
      setError(err?.message || 'Erro ao reproduzir a amostra de voz.')
      stopVoiceSample()
    } finally {
      setPreviewing(false)
    }
  }

  function resetVoiceSettings() {
    stopVoiceSample()
    updateActiveProfile({ settings: { ...DEFAULT_VOICE_CUSTOMIZATION, company: accountCompany } })
  }

  async function getSessionToken() {
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session?.access_token) throw new Error('Sessão expirada. Entra novamente no SD Dialer.')
    return session.access_token
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
        ended: 'Chamada terminada. Podes selecionar a próxima lead.',
        failed: json.error || 'A chamada falhou.',
      }
      setCallMessage(labels[status] || status)

      if (!['ended', 'failed'].includes(status)) {
        pollTimer.current = setTimeout(() => pollCall(callId, token), 1200)
      }
    } catch (err: any) {
      setCallStatus('failed')
      setCallMessage(err?.message || 'Erro ao acompanhar a chamada.')
    }
  }

  const callIsBusy = ['queued', 'preparing', 'ringing', 'answered', 'connected'].includes(callStatus)
  const canStartCall = callMode === 'lead'
    ? Boolean(selected)
    : Boolean(manualPhone.trim() && manualConsent && manualPhone.replace(/\D/g, '').length >= 9)

  async function startCall() {
    if (!canStartCall || callIsBusy) return
    setError('')
    setCallStatus('queued')
    setCallMessage('A iniciar chamada...')

    try {
      const token = await getSessionToken()
      const requestBody = callMode === 'lead' && selected
        ? { lead_id: selected.id, agent_id: agentId, agent: buildAgentOverride() }
        : {
            phone: manualPhone.trim(),
            name: manualName.trim() || 'Contacto manual',
            consent_confirmed: manualConsent,
            agent_id: agentId,
            agent: buildAgentOverride(),
          }
      const res = await fetch(`${LUMIN_GATEWAY}/api/sd-dialer/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
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
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Escolhe uma lead da empresa ou marca um número manualmente.</div>
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: 4, borderRadius: 10, background: '#F1F5F9', marginBottom: 14 }}>
            <button
              type="button"
              disabled={callIsBusy}
              onClick={() => { setCallMode('lead'); setError(''); setCallStatus('idle') }}
              style={{ padding: '9px 8px', border: 0, borderRadius: 8, background: callMode === 'lead' ? '#0F172A' : 'transparent', color: callMode === 'lead' ? '#fff' : '#475569', fontSize: 12, fontWeight: 800 }}
            >
              Lead existente
            </button>
            <button
              type="button"
              disabled={callIsBusy}
              onClick={() => { setCallMode('manual'); setSelected(null); setError(''); setCallStatus('idle') }}
              style={{ padding: '9px 8px', border: 0, borderRadius: 8, background: callMode === 'manual' ? '#0F172A' : 'transparent', color: callMode === 'manual' ? '#fff' : '#475569', fontSize: 12, fontWeight: 800 }}
            >
              Número manual
            </button>
          </div>

          {callMode === 'lead' ? (
            <VoiceLeadPicker
              selectedId={selected?.id}
              disabled={callIsBusy}
              onSelect={lead => {
                setSelected(lead)
                setError('')
                setCallStatus('idle')
                setCallMessage(lead ? 'Pronto para ligar.' : 'Escolhe uma lead para preparar a chamada.')
              }}
            />
          ) : (
            <>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 6, textTransform: 'uppercase' }}>1. Marcar número</label>
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
                placeholder="Nome (opcional)"
                style={{ width: '100%', marginTop: 8, padding: '10px 12px', border: '1.5px solid #E2E8F0', borderRadius: 9, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 10, fontSize: 11.5, lineHeight: 1.45, color: '#64748B', cursor: 'pointer' }}>
                <input type="checkbox" checked={manualConsent} onChange={e => setManualConsent(e.target.checked)} style={{ marginTop: 2 }} />
                <span>Confirmo que tenho autorização para contactar este número. Números de leads com contacto bloqueado continuam sem poder ser chamados.</span>
              </label>
            </>
          )}
        </div>

        {error && (
          <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginTop: 10, fontSize: 12, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 10px' }}>
            <AlertCircle size={13} /> {error}
          </div>
        )}

        <div style={{ marginTop: 18 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 6, textTransform: 'uppercase' }}>2. Agente</label>
          <select
            value={agentId}
            onChange={e => updateActiveProfile({ agentId: e.target.value as VoiceAgentId })}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', background: '#fff', color: '#0F172A', fontSize: 13.5 }}
          >
            {VOICE_AGENTS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
          <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 5 }}>{agent.detail}</div>
        </div>

        <section style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>3. Guiões guardados</div>
              <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 3 }}>Guarda configurações diferentes para trocar de agente sem reescrever o guião.</div>
            </div>
            <button type="button" onClick={() => createVoiceProfile()} disabled={!settingsReady || !settingsKey || voiceProfiles.length >= MAX_VOICE_PROFILES} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid #E2E8F0', borderRadius: 8, padding: '7px 9px', color: '#334155', fontSize: 11, fontWeight: 700, cursor: 'pointer', opacity: !settingsReady || !settingsKey || voiceProfiles.length >= MAX_VOICE_PROFILES ? .55 : 1, whiteSpace: 'nowrap' }}>
              <Plus size={13} /> Novo
            </button>
          </div>

          <select
            aria-label="Selecionar guião guardado"
            value={activeProfileId}
            disabled={!settingsReady || voiceProfiles.length === 0}
            onChange={e => { setActiveProfileId(e.target.value); setProfileNotice(''); stopVoiceSample() }}
            style={{ width: '100%', padding: '9px 10px', borderRadius: 9, border: '1.5px solid #E2E8F0', background: '#fff', color: '#0F172A', fontSize: 12.5 }}
          >
            {voiceProfiles.map(profile => <option key={profile.id} value={profile.id}>{profile.label}</option>)}
          </select>

          <button
            type="button"
            onClick={selectRicardoVoiceProfile}
            disabled={!settingsReady || !settingsKey}
            style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8, padding: '8px 10px', border: '1px solid #F3D48B', borderRadius: 8, background: '#FFFBEB', color: '#854D0E', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', opacity: !settingsReady || !settingsKey ? .55 : 1 }}
          >
            <Sparkles size={13} /> Usar guião do Ricardo · qualificação telecom
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', gap: 6, marginTop: 8 }}>
            <input
              aria-label="Nome do guião"
              value={activeProfile?.label ?? ''}
              maxLength={56}
              disabled={!settingsReady || !activeProfile}
              onChange={e => { updateActiveProfile({ label: e.target.value }); setProfileNotice('') }}
              placeholder="Nome deste guião"
              style={{ minWidth: 0, padding: '8px 9px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 12 }}
            />
            <button type="button" onClick={() => createVoiceProfile(true)} disabled={!settingsReady || !settingsKey || voiceProfiles.length >= MAX_VOICE_PROFILES} title="Duplicar guião" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 8px', border: '1px solid #E2E8F0', borderRadius: 8, color: '#334155', fontSize: 11, fontWeight: 700, cursor: 'pointer', opacity: !settingsReady || !settingsKey || voiceProfiles.length >= MAX_VOICE_PROFILES ? .55 : 1 }}>
              <Copy size={12} /> Duplicar
            </button>
            <button type="button" onClick={deleteActiveProfile} disabled={!settingsReady || !settingsKey || voiceProfiles.length <= 1} title="Apagar guião" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 8px', border: '1px solid #FECACA', borderRadius: 8, color: '#B91C1C', fontSize: 11, fontWeight: 700, cursor: 'pointer', opacity: !settingsReady || !settingsKey || voiceProfiles.length <= 1 ? .5 : 1 }}>
              <Trash2 size={12} /> Apagar
            </button>
          </div>
          <div role="status" aria-live="polite" style={{ fontSize: 10.5, lineHeight: 1.4, color: profileNotice.startsWith('O navegador') ? '#B91C1C' : profileNotice ? '#15803D' : '#64748B', marginTop: 7 }}>
            {profileNotice || 'Guardado automaticamente neste dispositivo. Até 12 guiões por utilizador.'}
          </div>
        </section>

        <section style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>4. Personaliza o agente</div>
              <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 3 }}>As alterações ficam guardadas no guião selecionado.</div>
            </div>
            <button type="button" onClick={resetVoiceSettings} style={{ border: 0, background: 'transparent', color: '#64748B', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>Repor exemplo</button>
          </div>

          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 6 }}>Qualidade de voz</label>
          <select
            value={voiceSettings.voiceEngine}
            onChange={e => updateVoiceSetting('voiceEngine', e.target.value as VoiceEngine)}
            style={{ width: '100%', padding: '9px 10px', borderRadius: 9, border: '1.5px solid #E2E8F0', background: '#fff', color: '#0F172A', fontSize: 12.5 }}
          >
            <option value="piper">Local · económica (Piper)</option>
            <option value="xai">Neural PT-PT · mais natural (LiveKit)</option>
          </select>
          <div style={{ fontSize: 10.5, lineHeight: 1.4, color: '#64748B', marginTop: 5 }}>A opção neural pode gerar custos LiveKit, também nas chamadas.</div>

          <div style={{ marginTop: 13 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 6 }}>Estilo de voz</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
              {VOICE_STYLES.map(style => {
                const active = voiceSettings.voice === style.id
                return (
                  <button
                    type="button"
                    key={style.id}
                    aria-pressed={active}
                    onClick={() => updateVoiceSetting('voice', style.id)}
                    style={{ textAlign: 'left', minWidth: 0, padding: '9px 8px', borderRadius: 9, cursor: 'pointer', border: active ? '1px solid #2563EB' : '1px solid #E2E8F0', background: active ? '#EFF6FF' : '#fff', color: '#0F172A', fontSize: 11.5, fontWeight: 700 }}
                  >
                    {style.label}
                    <span style={{ display: 'block', fontSize: 9.5, lineHeight: 1.25, color: '#64748B', fontWeight: 400, marginTop: 3 }}>{style.detail}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 13 }}>
            <label style={{ display: 'block', minWidth: 0, fontSize: 11, fontWeight: 700, color: '#64748B' }}>
              Nome do agente
              <input value={voiceSettings.name} maxLength={48} onChange={e => updateVoiceSetting('name', e.target.value)} placeholder={agent.label} style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 5, padding: '9px 10px', borderRadius: 9, border: '1.5px solid #E2E8F0', color: '#0F172A', fontSize: 12.5 }} />
            </label>
            <label style={{ display: 'block', minWidth: 0, fontSize: 11, fontWeight: 700, color: '#64748B' }}>
              Empresa
              <input value={voiceSettings.company} maxLength={64} onChange={e => updateVoiceSetting('company', e.target.value)} placeholder={accountCompany || 'Nome da empresa'} style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 5, padding: '9px 10px', borderRadius: 9, border: '1.5px solid #E2E8F0', color: '#0F172A', fontSize: 12.5 }} />
            </label>
          </div>

          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', marginTop: 12 }}>
            Objetivo da conversa
            <input value={voiceSettings.objective} maxLength={180} onChange={e => updateVoiceSetting('objective', e.target.value)} placeholder="O que o agente deve alcançar nesta chamada?" style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 5, padding: '9px 10px', borderRadius: 9, border: '1.5px solid #E2E8F0', color: '#0F172A', fontSize: 12.5 }} />
          </label>

          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', marginTop: 12 }}>
            Contexto, produto ou serviço
            <textarea value={voiceSettings.product} maxLength={500} rows={2} onChange={e => updateVoiceSetting('product', e.target.value)} placeholder="O que deve saber para responder melhor?" style={{ display: 'block', width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: 58, marginTop: 5, padding: '9px 10px', borderRadius: 9, border: '1.5px solid #E2E8F0', color: '#0F172A', fontSize: 12.5 }} />
          </label>

          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', marginTop: 12 }}>
            Frase de abertura
            <input value={voiceSettings.opening} maxLength={180} onChange={e => updateVoiceSetting('opening', e.target.value)} placeholder="Ex.: Olá, sou o Lumin da sua empresa..." style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 5, padding: '9px 10px', borderRadius: 9, border: '1.5px solid #E2E8F0', color: '#0F172A', fontSize: 12.5 }} />
          </label>
          <div style={{ fontSize: 10.5, lineHeight: 1.4, color: '#64748B', marginTop: 9 }}>Os campos vazios mantêm as instruções do agente selecionado.</div>
        </section>
      </div>

      <div className="lumin-call-status" style={{
        background: 'linear-gradient(160deg,#0F172A,#111827 60%,#312E81)',
        color: '#fff', borderRadius: 16, padding: 20, minHeight: 270,
        boxShadow: '0 12px 32px rgba(15,23,42,.16)',
      }}>
        <div style={{ fontSize: 11, color: '#A5B4FC', fontWeight: 800, letterSpacing: '.08em' }}>LUMIN VOICE</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 8 }}>{selected?.nome || 'Escolhe uma lead'}</div>
        <div style={{ fontSize: 13, color: '#CBD5E1', marginTop: 3 }}>{selected?.telefone || 'A chamada sai pelo número autorizado do Lumin.'}</div>

        <div style={{ marginTop: 15, padding: '11px 12px', borderRadius: 10, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.08)' }}>
          <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 4 }}>AGENTE CONFIGURADO</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{voiceSettings.name.trim() || agent.label}</div>
          <div style={{ fontSize: 11, color: '#CBD5E1', marginTop: 3 }}>{voiceSettings.company.trim() || accountCompany || 'Empresa por definir'} · {voiceSettings.voice.toUpperCase()} · {voiceSettings.voiceEngine === 'xai' ? 'NEURAL PT-PT' : 'PIPER PT-PT'}</div>
        </div>

        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" onClick={playVoiceSample} disabled={previewing} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 10px', border: '1px solid rgba(255,255,255,.18)', borderRadius: 9, background: 'rgba(255,255,255,.08)', color: '#fff', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {previewing ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />} {previewing ? 'A gerar amostra…' : 'Ouvir amostra'}
          </button>
          <span style={{ fontSize: 10, lineHeight: 1.35, color: '#94A3B8' }}>A amostra usa o motor e o estilo configurados para a chamada; o áudio pode soar ligeiramente diferente no telefone.</span>
        </div>

        {error && <div role="alert" style={{ fontSize: 11, color: '#FCA5A5', marginTop: 8 }}>{error}</div>}

        <div style={{ marginTop: 24, padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.08)' }}>
          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 5 }}>ESTADO</div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: callStatus === 'failed' ? '#FCA5A5' : callStatus === 'connected' ? '#86EFAC' : '#fff' }}>
            {callMessage}
          </div>
        </div>

        <button
          onClick={startCall}
          disabled={!canStartCall || callIsBusy}
          style={{
            width: '100%', marginTop: 18, minHeight: 48, borderRadius: 11, border: 'none',
            background: canStartCall ? 'linear-gradient(135deg,#C4B5FD,#818CF8)' : '#334155',
            color: canStartCall ? '#111827' : '#94A3B8', fontSize: 14, fontWeight: 900,
            cursor: canStartCall ? 'pointer' : 'not-allowed',
          }}
        >
          {callStatus === 'connected' ? 'CHAMADA EM CURSO' : callIsBusy ? 'A LIGAR...' : '📞 LIGAR COM LUMIN'}
        </button>

        <div style={{ fontSize: 10.5, lineHeight: 1.5, color: '#94A3B8', marginTop: 12 }}>
          O Lumin identifica-se como assistente virtual de IA. Leads marcadas como não interessadas, desligadas ou com número inválido ficam bloqueadas; números manuais exigem confirmação de autorização.
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
