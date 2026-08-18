'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { use } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import {
  Phone, MessageCircle, MapPin, ChevronLeft, Clock,
  User, MapPinned, Hash, Wifi, FileText, CheckCircle2,
  PhoneOff, PhoneMissed, AlertCircle, Calendar,
  HelpCircle, Plus, History, X, Sparkles, Brain, Trash2, Pencil,
} from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { useAuth } from '@/lib/hooks/useAuth'
import { leadService, callHistoryService, followUpService } from '@/lib/services'
import { createClient } from '@/lib/supabase/client'
import { CustomFieldsRenderer, fetchCustomFieldDefs, type CustomFieldDef } from '@/components/common/CustomFields'
import type { Lead, CallResult, CallHistory } from '@/lib/types'
import Link from 'next/link'
import CallRecorder from '@/components/ai/CallRecorder'
import AssistenteIA from '@/components/ai/AssistenteIA'
import VendaIAChat from '@/components/ai/VendaIAChat'

// ---- Call Results Config ----
const RESULTS: { key: CallResult; label: string; color: string; bg: string; Icon: React.ElementType }[] = [
  { key: 'venda',          label: 'Venda',           color: '#16A34A', bg: '#F0FDF4', Icon: CheckCircle2 },
  { key: 'nao_interessado',label: 'Nao Interessado',  color: '#DC2626', bg: '#FEF2F2', Icon: PhoneOff },
  { key: 'nao_atende',     label: 'Nao Atende',       color: '#6B7280', bg: '#F9FAFB', Icon: PhoneMissed },
  { key: 'numero_errado',  label: 'Numero Errado',    color: '#7C3AED', bg: '#F5F3FF', Icon: AlertCircle },
  { key: 'ligar_depois',   label: 'Ligar Depois',     color: '#0891B2', bg: '#ECFEFF', Icon: Calendar },
  { key: 'sem_cobertura',  label: 'Sem Cobertura',    color: '#EA580C', bg: '#FFF7ED', Icon: Wifi },
  { key: 'desligado',              label: 'Desligado',              color: '#991B1B', bg: '#FEF2F2', Icon: PhoneOff },
  { key: 'numero_nao_atribuido',   label: 'Nº Não Atribuído',        color: '#991B1B', bg: '#FEF2F2', Icon: AlertCircle },
  { key: 'pertence_outra_pessoa',  label: 'Pertence a Outra Pessoa', color: '#991B1B', bg: '#FEF2F2', Icon: AlertCircle },
  { key: 'outro',          label: 'Outro',            color: '#6B7280', bg: '#F9FAFB', Icon: HelpCircle },
]

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function LeadCallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user, profile } = useAuth()
  const router = useRouter()

  const [showEdit, setShowEdit] = useState(false)
  const [editObs, setEditObs] = useState('')
  const [editCustom, setEditCustom] = useState<Record<string, any>>({})
  const [editDefs, setEditDefs] = useState<CustomFieldDef[]>([])
  const [savingEdit, setSavingEdit] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { data: lead, mutate: mutateLead } = useSWR(
    ['lead', id],
    () => leadService.getById(id),
    { revalidateOnFocus: false }
  )
  const { data: history = [], mutate: mutateHistory } = useSWR(
    ['call-history', id],
    () => callHistoryService.getByLead(id),
    { revalidateOnFocus: false }
  )

  // Timer state
  const [timerActive, setTimerActive] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)
  // Track whether call was initiated (so returning forces feedback)
  const callInitiated = useRef(false)

  // Result sheet
  const [showResult, setShowResult] = useState(false)
  const [resultForced, setResultForced] = useState(false) // if forced, cannot dismiss
  const [selectedResult, setSelectedResult] = useState<CallResult | null>(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Follow-up
  const [showFollowUp, setShowFollowUp] = useState(false)
  const [followUpDate, setFollowUpDate] = useState('')
  const [followUpTime, setFollowUpTime] = useState('')
  const [followUpNotes, setFollowUpNotes] = useState('')
  const [savingFollowUp, setSavingFollowUp] = useState(false)

  // Tab
  const [tab, setTab] = useState<'info' | 'history' | 'assistente' | 'porta' | 'venda-ia'>('info')

  // AI summary state — populated AFTER save
  const [lastSavedHistoryId, setLastSavedHistoryId] = useState<string | null>(null)
  const [aiSummary, setAiSummary] = useState('')
  const [aiSentiment, setAiSentiment] = useState('')
  const [aiNextAction, setAiNextAction] = useState('')
  const [aiObjections, setAiObjections] = useState<string[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [resultSaved, setResultSaved] = useState(false)

  // Porta (door knock) state
  const [portaOperador, setPortaOperador] = useState('')
  const [portaServiços, setPortaServiços] = useState({ tv: false, internet: false, fixo: false, movel: false })
  const [portaMensalidade, setPortaMensalidade] = useState('')
  const [portaSatisfacao, setPortaSatisfacao] = useState<1 | 2 | 3 | 4 | 5 | null>(null)
  const [portaProblemas, setPortaProblemas] = useState<string[]>([])
  const [portaResultado, setPortaResultado] = useState('')
  const [portaNotas, setPortaNotas] = useState('')
  const [portaSalving, setPortaSaving] = useState(false)
  const [portaSalvo, setPortaSalvo] = useState(false)

  // VendaIAChat context
  const [mostrarVendaIA, setMostrarVendaIA] = useState(false)
  const [vendaContexto, setVendaContexto] = useState({
    operador: '',
    comercializador: '',
    servicos: {},
    mensalidade: '',
    satisfacao: undefined as number | undefined,
    problemas: [] as string[],
    tipo: 'telecom' as 'telecom' | 'energia',
    lead_nome: lead?.nome,
    lead_telefone: lead?.telefone,
  })

  const startTimer = useCallback(() => {
    setElapsed(0)
    startTimeRef.current = Date.now()
    setTimerActive(true)
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 500)
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    setTimerActive(false)
  }, [])

  // When user returns from phone app → force feedback sheet
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && callInitiated.current) {
        stopTimer()
        callInitiated.current = false
        setResultForced(true)
        setShowResult(true)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [stopTimer])

  const handleCall = () => {
    if (!lead) return
    const phone = lead.telefone.replace(/\s/g, '')
    callInitiated.current = true
    startTimer()
    window.location.href = `tel:${phone}`
  }

  const handleWhatsApp = () => {
    if (!lead) return
    const phone = lead.telefone.replace(/[^0-9]/g, '')
    window.open(`https://wa.me/351${phone}`, '_blank')
  }

  const handleNavigate = () => {
    if (!lead) return
    const address = [lead.morada, lead.localidade, lead.codigo_postal].filter(Boolean).join(', ')
    window.open(`https://maps.google.com/?q=${encodeURIComponent(address)}`, '_blank')
  }

  const handleAiSummary = async () => {
    if (!lastSavedHistoryId || !profile) return
    setAiLoading(true)
    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_history_id: lastSavedHistoryId,
          notes: notes.trim(),
          company_id: profile.company_id!,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro da IA')
      setAiSummary(data.ai_summary ?? '')
      setAiSentiment(data.ai_sentiment ?? 'neutro')
      setAiNextAction(data.ai_next_best_action ?? '')
      setAiObjections(data.ai_objections_detected ?? [])
    } catch (err: any) {
      alert('Erro ao gerar resumo: ' + err.message)
    } finally {
      setAiLoading(false)
    }
  }

  const handleSaveResult = async () => {
    if (!selectedResult || !lead || !user || !profile) return
    setSaving(true)
    try {
      const saved = await callHistoryService.create({
        lead_id: lead.id,
        parceiro_id: user.id,
        company_id: profile.company_id!,
        result: selectedResult,
        duration_sec: elapsed,
        notes: notes.trim() || undefined,
      })

      setLastSavedHistoryId(saved.id)
      setResultSaved(true)

      // Ativar VendaIA se houver operador/notes relevantes
      if (lead?.operador || notes.trim()) {
        setVendaContexto({
          operador: lead?.operador || '',
          comercializador: '',
          servicos: {},
          mensalidade: '',
          satisfacao: undefined,
          problemas: [],
          tipo: 'telecom',
          lead_nome: lead?.nome,
          lead_telefone: lead?.telefone,
        })
        setMostrarVendaIA(true)
        setTab('venda-ia')
      }

      const statusMap: Record<CallResult, Lead['status']> = {
        venda:          'vendido',
        nao_interessado:'nao_interessado',
        nao_atende:     'nao_atende',
        numero_errado:  'numero_errado',
        ligar_depois:   'ligar_depois',
        sem_cobertura:  'sem_cobertura',
        desligado:              'desligado',
        numero_nao_atribuido:   'numero_nao_atribuido',
        pertence_outra_pessoa:  'pertence_outra_pessoa',
        outro:          'contactado',
      }
      await leadService.update(lead.id, { status: statusMap[selectedResult] })
      await mutateLead()
      await mutateHistory()
    } finally {
      setSaving(false)
    }
  }

  const handleCloseResult = () => {
    const wasLigarDepois = selectedResult === 'ligar_depois' && resultSaved
    setShowResult(false)
    setResultForced(false)
    setSelectedResult(null)
    setNotes('')
    setElapsed(0)
    setAiSummary('')
    setAiSentiment('')
    setAiNextAction('')
    setAiObjections([])
    setLastSavedHistoryId(null)
    setResultSaved(false)
    if (wasLigarDepois) setShowFollowUp(true)
  }

  const handleSaveFollowUp = async () => {
    if (!followUpDate || !followUpTime || !lead || !user || !profile) return
    setSavingFollowUp(true)
    try {
      await followUpService.create({
        lead_id: lead.id,
        parceiro_id: user.id,
        company_id: profile.company_id!,
        scheduled_at: new Date(`${followUpDate}T${followUpTime}`).toISOString(),
        notes: followUpNotes.trim() || undefined,
      })
      setShowFollowUp(false)
    } finally {
      setSavingFollowUp(false)
    }
  }

  const openEdit = async () => {
    if (!lead || !profile?.company_id) return
    setEditObs(lead.observacoes ?? '')
    setEditCustom((lead as any).custom_fields ?? {})
    try {
      const defs = await fetchCustomFieldDefs(profile.company_id, (lead as any).pipeline_etapa_id ?? null)
      setEditDefs(defs)
    } catch {
      setEditDefs([])
    }
    setShowEdit(true)
  }

  const handleSaveEdit = async () => {
    if (!lead) return
    setSavingEdit(true)
    try {
      const sb = createClient()
      const { error } = await sb.from('leads').update({
        observacoes: editObs.trim() || null,
        custom_fields: editCustom,
      }).eq('id', lead.id)
      if (error) throw error
      setShowEdit(false)
      mutateLead()
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDeleteLead = async () => {
    if (!lead) return
    setDeleting(true)
    try {
      const sb = createClient()
      const { error } = await sb.from('leads').delete().eq('id', lead.id)
      if (error) throw error
      router.push('/parceiro')
    } finally {
      setDeleting(false)
    }
  }

  if (!lead) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <Spinner size={32} />
      </div>
    )
  }

  return (
    <>
      <div style={{ maxWidth: 600, margin: '0 auto' }} className="anim-fade-in">

        {/* Back */}
        <Link href="/parceiro" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          color: '#64748B', textDecoration: 'none', fontSize: 13, marginBottom: 20,
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#2563EB' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#64748B' }}
        >
          <ChevronLeft size={16} /> Voltar
        </Link>

        {/* Lead Card */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'hidden', marginBottom: 16 }}>

          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
            padding: '22px 24px',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: 0 }}>{lead.nome}</h1>
                <div style={{ fontSize: 15, color: '#94A3B8', marginTop: 6, fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                  {lead.telefone}
                </div>
              </div>
              <div style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                background: 'rgba(255,255,255,0.1)', color: '#E2E8F0',
                textTransform: 'capitalize', whiteSpace: 'nowrap',
              }}>
                {lead.status.replace(/_/g, ' ')}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button
                onClick={() => setShowFollowUp(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.06)', color: '#E2E8F0', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                }}
              >
                📅 Agendar Follow-up
              </button>
              <button
                onClick={openEdit}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.06)', color: '#E2E8F0', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                }}
              >
                <Pencil size={13} /> Editar
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)',
                  background: 'rgba(239,68,68,0.1)', color: '#FCA5A5', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                }}
              >
                <Trash2 size={13} /> Eliminar
              </button>
            </div>

            {/* Active call timer */}
            {timerActive && (
              <div style={{
                marginTop: 14, display: 'flex', alignItems: 'center', gap: 8,
                background: 'rgba(37,99,235,0.3)', borderRadius: 8, padding: '8px 12px', width: 'fit-content',
              }}>
                <div className="anim-pulse" style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E' }} />
                <span style={{ color: '#fff', fontFamily: 'monospace', fontSize: 16, fontWeight: 700 }}>
                  {formatDuration(elapsed)}
                </span>
                <span style={{ color: '#94A3B8', fontSize: 12 }}>Em chamada</span>
              </div>
            )}
          </div>

          {/* ---- CALL BUTTON (main CTA) ---- */}
          <div style={{ padding: '20px 20px 8px' }}>
            <button
              onClick={handleCall}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                background: timerActive ? '#15803D' : '#16A34A',
                color: '#fff', border: 'none', borderRadius: 14,
                padding: '18px 0', fontSize: 17, fontWeight: 700, cursor: 'pointer',
                boxShadow: timerActive ? 'none' : '0 6px 20px rgba(22,163,74,0.35)',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!timerActive) (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 28px rgba(22,163,74,0.45)' }}
              onMouseLeave={e => { if (!timerActive) (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(22,163,74,0.35)' }}
            >
              <Phone size={22} />
              {timerActive ? `Em chamada — ${formatDuration(elapsed)}` : `Chamar  ${lead.telefone}`}
            </button>
          </div>

          {/* Secondary actions */}
          <div style={{ padding: '8px 20px 16px', display: 'flex', gap: 8 }}>
            <button
              onClick={handleWhatsApp}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0',
                borderRadius: 10, padding: '10px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#DCFCE7' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#F0FDF4' }}
            >
              <MessageCircle size={16} />
              WhatsApp
            </button>
            <button
              onClick={handleNavigate}
              disabled={!lead.morada && !lead.localidade}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE',
                borderRadius: 10, padding: '10px 0', fontSize: 13, fontWeight: 600,
                cursor: (!lead.morada && !lead.localidade) ? 'not-allowed' : 'pointer',
                opacity: (!lead.morada && !lead.localidade) ? 0.5 : 1,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (lead.morada || lead.localidade) (e.currentTarget as HTMLElement).style.background = '#DBEAFE' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#EFF6FF' }}
            >
              <MapPin size={16} />
              Navegar
            </button>
            {/* Registar manually */}
            <button
              onClick={() => { setResultForced(false); setShowResult(true) }}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0',
                borderRadius: 10, padding: '10px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = '#2563EB'
                ;(e.currentTarget as HTMLElement).style.color = '#2563EB'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = '#E2E8F0'
                ;(e.currentTarget as HTMLElement).style.color = '#64748B'
              }}
            >
              <Plus size={15} />
              Registar
            </button>
          </div>

          {/* ── Chamada Inteligente IA (additive module — CRM unaffected) ── */}
          <div style={{ padding: '0 20px 16px' }}>
            <CallRecorder
              callActive={timerActive}
              leadId={lead.id}
              leadName={lead.nome}
              campanhaId={lead.campanha_id ?? null}
            />
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', borderRadius: 10, padding: 4, marginBottom: 16 }}>
          {[
            { key: 'info'       as const, label: 'Informacao' },
            { key: 'assistente' as const, label: 'Assistente IA' },
            { key: 'porta'      as const, label: 'Relatório Porta' },
            ...(mostrarVendaIA ? [{ key: 'venda-ia' as const, label: 'Venda IA' }] : []),
            { key: 'history'    as const, label: `Historico (${history.length})` },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 7, border: 'none',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                background: tab === t.key ? '#fff' : 'transparent',
                color: tab === t.key ? '#0F172A' : '#64748B',
                boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Assistente IA Tab */}
        {tab === 'assistente' && profile?.company_id && (
          <AssistenteIA companyId={profile.company_id} />
        )}

        {/* Porta Tab */}
        {tab === 'porta' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Operador Atual */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Operador Atual</label>
              <input
                type="text"
                placeholder="MEO, Vodafone, NOS, Outros..."
                value={portaOperador}
                onChange={e => setPortaOperador(e.target.value)}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #E2E8F0',
                  fontSize: 13, outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Serviços Contratados */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Serviços Contratados</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { key: 'tv' as const, label: 'TV' },
                  { key: 'internet' as const, label: 'Internet' },
                  { key: 'fixo' as const, label: 'Telefone Fixo' },
                  { key: 'movel' as const, label: 'Telemóvel' },
                ].map(s => (
                  <button
                    key={s.key}
                    onClick={() => setPortaServiços({ ...portaServiços, [s.key]: !portaServiços[s.key] })}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                      borderRadius: 10, border: `2px solid ${portaServiços[s.key] ? '#2563EB' : '#E2E8F0'}`,
                      background: portaServiços[s.key] ? '#EFF6FF' : '#fff',
                      cursor: 'pointer', textAlign: 'left', fontSize: 13, color: '#374151',
                      fontWeight: portaServiços[s.key] ? 600 : 500,
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: 4, border: `2px solid ${portaServiços[s.key] ? '#2563EB' : '#D1D5DB'}`,
                      background: portaServiços[s.key] ? '#2563EB' : '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {portaServiços[s.key] && <div style={{ width: 6, height: 6, borderRadius: 1, background: '#fff' }} />}
                    </div>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Mensalidade */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Mensalidade Atual (€)</label>
              <input
                type="number"
                placeholder="Ex: 45.50"
                value={portaMensalidade}
                onChange={e => setPortaMensalidade(e.target.value)}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #E2E8F0',
                  fontSize: 13, outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Satisfação */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Nível de Satisfação</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => setPortaSatisfacao(n as 1 | 2 | 3 | 4 | 5)}
                    style={{
                      flex: 1, padding: '12px', borderRadius: 10, border: `2px solid ${portaSatisfacao === n ? '#FBBF24' : '#E2E8F0'}`,
                      background: portaSatisfacao === n ? '#FFFBEB' : '#fff',
                      cursor: 'pointer', fontSize: 13, fontWeight: portaSatisfacao === n ? 700 : 500,
                      color: portaSatisfacao === n ? '#D97706' : '#9CA3B8',
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Problemas */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Problemas Identificados</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['Preço', 'Cobertura', 'Velocidade', 'Avarias', 'Apoio'].map(p => {
                  const isSelected = portaProblemas.includes(p)
                  return (
                    <button
                      key={p}
                      onClick={() =>
                        setPortaProblemas(isSelected
                          ? portaProblemas.filter(x => x !== p)
                          : [...portaProblemas, p]
                        )
                      }
                      style={{
                        padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${isSelected ? '#DC2626' : '#D1D5DB'}`,
                        background: isSelected ? '#FEF2F2' : '#fff',
                        cursor: 'pointer', fontSize: 12, fontWeight: isSelected ? 600 : 500,
                        color: isSelected ? '#DC2626' : '#6B7280',
                      }}
                    >
                      {p}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Resultado */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Resultado da Abordagem</label>
              <select
                value={portaResultado}
                onChange={e => setPortaResultado(e.target.value)}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #E2E8F0',
                  fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#374151',
                }}
              >
                <option value="">Escolhe um resultado...</option>
                <option value="interessado">Interessado</option>
                <option value="follow-up">Follow-up</option>
                <option value="sem-interesse">Sem Interesse</option>
                <option value="cliente">Já é Cliente</option>
                <option value="venda">Venda</option>
              </select>
            </div>

            {/* Notas */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Notas</label>
              <textarea
                placeholder="Observações adicionais sobre a abordagem..."
                value={portaNotas}
                onChange={e => setPortaNotas(e.target.value)}
                rows={3}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #E2E8F0',
                  fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'inherit',
                  boxSizing: 'border-box', color: '#0F172A',
                }}
              />
            </div>

            {/* Save Porta Button */}
            <button
              onClick={async () => {
                if (!portaResultado || !profile || !user) return
                setPortaSaving(true)
                try {
                  const sb = (await import('@/lib/supabase/client')).createClient()
                  await sb.from('door_reports').insert({
                    seller_id: user.id,
                    created_by: user.id,
                    numero_porta: '',
                    morada: lead.morada || '',
                    codigo_postal: lead.codigo_postal || '',
                    cliente_nome: lead.nome,
                    cliente_telefone: lead.telefone,
                    operadora: portaOperador,
                    observacoes: portaNotas,
                    adesao: portaResultado,
                    estado: 'registado',
                    data: new Date().toISOString().split('T')[0],
                  })
                  alert('Relatório de Porta guardado com sucesso!')
                  setPortaSalvo(true)
                  
                  // Ativar VendaIA com contexto da porta
                  setVendaContexto({
                    operador: portaOperador,
                    comercializador: '',
                    servicos: portaServiços,
                    mensalidade: portaMensalidade,
                    satisfacao: portaSatisfacao || undefined,
                    problemas: portaProblemas,
                    tipo: 'telecom',
                    lead_nome: lead.nome,
                    lead_telefone: lead.telefone,
                  })
                  setMostrarVendaIA(true)
                  setTab('venda-ia')
                  
                  // Limpar formulário
                  setPortaOperador('')
                  setPortaServiços({ tv: false, internet: false, fixo: false, movel: false })
                  setPortaMensalidade('')
                  setPortaSatisfacao(null)
                  setPortaProblemas([])
                  setPortaResultado('')
                  setPortaNotas('')
                } catch (err: any) {
                  alert('Erro ao guardar: ' + err.message)
                } finally {
                  setPortaSaving(false)
                }
              }}
              disabled={!portaResultado || portaSalving}
              style={{
                width: '100%', padding: '15px', borderRadius: 12, border: 'none',
                background: portaResultado ? '#10B981' : '#E2E8F0',
                color: portaResultado ? '#fff' : '#9CA3AF',
                fontSize: 15, fontWeight: 700,
                cursor: portaResultado ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {portaSalving ? <><Spinner size={18} color="#fff" /> Guardando...</> : 'Guardar Relatório de Porta'}
            </button>
          </div>
        )}

        {/* VendaIA Tab */}
        {tab === 'venda-ia' && mostrarVendaIA && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            <VendaIAChat contexto={vendaContexto} />
          </div>
        )}

        {/* Info Tab */}
        {tab === 'info' && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            {[
              { Icon: User,      label: 'Nome',          value: lead.nome },
              { Icon: Phone,     label: 'Telefone',      value: lead.telefone },
              { Icon: MapPinned, label: 'Morada',        value: lead.morada },
              { Icon: Hash,      label: 'Cod. Postal',   value: lead.codigo_postal },
              { Icon: MapPin,    label: 'Localidade',    value: lead.localidade },
              { Icon: Wifi,      label: 'Operador',      value: lead.operador },
              { Icon: FileText,  label: 'Observacoes',   value: lead.observacoes },
            ]
              .filter(f => f.value)
              .map((field, i, arr) => (
                <div key={field.label} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 20px',
                  borderBottom: i < arr.length - 1 ? '1px solid #F1F5F9' : 'none',
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 8, background: '#F8FAFC',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
                  }}>
                    <field.Icon size={15} color="#64748B" />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginBottom: 2 }}>{field.label}</div>
                    <div style={{ fontSize: 14, color: '#0F172A', fontWeight: 500 }}>{field.value}</div>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* History Tab */}
        {tab === 'history' && (
          <div>
            {history.length === 0 ? (
              <div style={{
                background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0',
                padding: 32, textAlign: 'center',
              }}>
                <History size={32} color="#CBD5E1" style={{ margin: '0 auto 12px' }} />
                <p style={{ color: '#94A3B8', fontSize: 13, margin: 0 }}>Sem historico de chamadas</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {history.map(h => {
                  const res = RESULTS.find(r => r.key === h.result)
                  const Icon = res?.Icon ?? HelpCircle
                  const d = new Date(h.called_at)
                  return (
                    <div key={h.id} style={{
                      background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0',
                      padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'flex-start',
                    }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: 9, flexShrink: 0,
                        background: res?.bg ?? '#F9FAFB',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon size={17} color={res?.color ?? '#6B7280'} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ fontWeight: 600, fontSize: 13, color: res?.color ?? '#6B7280' }}>
                            {res?.label ?? h.result}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94A3B8', fontSize: 11 }}>
                            <Clock size={11} />
                            {formatDuration(h.duration_sec)}
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>
                          {d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}
                          {' '}
                          {d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {h.notes && (
                          <div style={{ fontSize: 12, color: '#64748B', marginTop: 6, fontStyle: 'italic' }}>
                            {h.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ---- Result Sheet (bottom sheet, forced after call) ---- */}
      {showResult && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: resultForced ? 'rgba(15,23,42,0.75)' : 'rgba(15,23,42,0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'flex-end',
        }}>
          <div style={{
            width: '100%', background: '#fff',
            borderRadius: '20px 20px 0 0',
            padding: '24px 20px 36px',
            maxHeight: '88vh', overflowY: 'auto',
          }} className="anim-scale-in">

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', margin: 0 }}>
                  {resultForced ? 'Como correu a chamada?' : 'Resultado da Chamada'}
                </h2>
                {elapsed > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, color: '#64748B', fontSize: 12 }}>
                    <Clock size={12} />
                    Duracao: {formatDuration(elapsed)}
                  </div>
                )}
                {resultForced && (
                  <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748B' }}>
                    Preenche o resultado antes de continuar.
                  </p>
                )}
              </div>
              {/* Only show X if not forced OR if already saved */}
              {(!resultForced || resultSaved) && (
                <button onClick={handleCloseResult} style={{
                  background: '#F1F5F9', border: 'none', borderRadius: 8, cursor: 'pointer',
                  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <X size={16} color="#64748B" />
                </button>
              )}
            </div>

            {/* Result lead info */}
            <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '10px 14px', marginBottom: 16, marginTop: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{lead.nome}</div>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{lead.telefone}</div>
            </div>

            {/* Result options */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {RESULTS.map(r => {
                const isSelected = selectedResult === r.key
                const Icon = r.Icon
                return (
                  <button
                    key={r.key}
                    onClick={() => setSelectedResult(r.key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '13px 14px', borderRadius: 12, cursor: 'pointer',
                      border: `2px solid ${isSelected ? r.color : '#E2E8F0'}`,
                      background: isSelected ? r.bg : '#fff',
                      transition: 'all 0.15s',
                    }}
                  >
                    <Icon size={18} color={r.color} />
                    <span style={{ fontSize: 13, fontWeight: isSelected ? 700 : 500, color: isSelected ? r.color : '#374151' }}>
                      {r.label}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Notes */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Notas adicionais <span style={{ fontWeight: 400, color: '#94A3B8' }}>(opcional)</span>
              </label>
              <textarea
                placeholder="Ex: Cliente interessado, pedir proposta..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #E2E8F0',
                  fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'inherit',
                  boxSizing: 'border-box', color: '#0F172A',
                }}
                onFocus={e => e.target.style.borderColor = '#2563EB'}
                onBlur={e => e.target.style.borderColor = '#E2E8F0'}
              />
            </div>

            {/* Save / AI section */}
            {!resultSaved ? (
              <button
                onClick={handleSaveResult}
                disabled={!selectedResult || saving}
                style={{
                  width: '100%', padding: '15px', borderRadius: 12, border: 'none',
                  background: selectedResult ? '#2563EB' : '#E2E8F0',
                  color: selectedResult ? '#fff' : '#9CA3AF',
                  fontSize: 15, fontWeight: 700,
                  cursor: selectedResult ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'background 0.15s',
                }}
              >
                {saving ? <Spinner size={18} color="#fff" /> : 'Guardar Resultado'}
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Success confirmation */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                  borderRadius: 10, background: '#F0FDF4', border: '1px solid #BBF7D0',
                  color: '#16A34A', fontSize: 13, fontWeight: 600,
                }}>
                  <CheckCircle2 size={16} />
                  Resultado guardado com sucesso!
                </div>

                {/* Resumir com IA */}
                {notes.trim() && !aiSummary && (
                  <button
                    onClick={handleAiSummary}
                    disabled={aiLoading}
                    style={{
                      width: '100%', padding: '13px', borderRadius: 12, border: 'none',
                      background: '#4F46E5', color: '#fff', fontSize: 14, fontWeight: 700,
                      cursor: aiLoading ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      opacity: aiLoading ? 0.7 : 1,
                    }}
                  >
                    {aiLoading
                      ? <><Spinner size={16} color="#fff" /> A analisar com IA...</>
                      : <><Brain size={16} /> Resumir com IA (Groq)</>
                    }
                  </button>
                )}

                {/* AI results */}
                {aiSummary && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ padding: '12px 14px', borderRadius: 10, background: '#F0F7FF', border: '1px solid #BFDBFE' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#2563EB', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resumo</div>
                      <div style={{ fontSize: 13, color: '#1E293B', lineHeight: 1.6 }}>{aiSummary}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', marginBottom: 4, textTransform: 'uppercase' }}>Sentimento</div>
                        <div style={{
                          fontSize: 13, fontWeight: 700,
                          color: aiSentiment === 'positivo' ? '#16A34A' : aiSentiment === 'negativo' ? '#DC2626' : '#D97706',
                        }}>
                          {aiSentiment === 'positivo' ? 'Positivo' : aiSentiment === 'negativo' ? 'Negativo' : 'Neutro'}
                        </div>
                      </div>
                      {aiNextAction && (
                        <div style={{ flex: 2, padding: '10px 12px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', marginBottom: 4, textTransform: 'uppercase' }}>Proxima Acao</div>
                          <div style={{ fontSize: 12, color: '#0F172A', lineHeight: 1.5 }}>{aiNextAction}</div>
                        </div>
                      )}
                    </div>
                    {aiObjections.length > 0 && (
                      <div style={{ padding: '10px 12px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#DC2626', marginBottom: 6, textTransform: 'uppercase' }}>Objecoes Detetadas</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {aiObjections.map((o, i) => (
                            <span key={i} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: '#FEE2E2', color: '#991B1B', fontWeight: 500 }}>
                              {o}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Close / follow-up */}
                <button
                  onClick={handleCloseResult}
                  style={{
                    width: '100%', padding: '13px', borderRadius: 12, border: '1px solid #E2E8F0',
                    background: '#F8FAFC', color: '#374151', fontSize: 14, fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Fechar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- Follow-up Modal ---- */}
      {showFollowUp && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 110,
          background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div style={{
            background: '#fff', borderRadius: 18, padding: '28px 24px',
            width: '100%', maxWidth: 400,
          }} className="anim-scale-in">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#0F172A', margin: 0 }}>Agendar Follow-up</h2>
              <button onClick={() => setShowFollowUp(false)} style={{
                background: '#F1F5F9', border: 'none', borderRadius: 8, cursor: 'pointer',
                width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <X size={16} color="#64748B" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Data</label>
                <input
                  type="date"
                  value={followUpDate}
                  onChange={e => setFollowUpDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#0F172A' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Hora</label>
                <input
                  type="time"
                  value={followUpTime}
                  onChange={e => setFollowUpTime(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#0F172A' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  Nota <span style={{ fontWeight: 400, color: '#94A3B8' }}>(opcional)</span>
                </label>
                <textarea
                  value={followUpNotes}
                  onChange={e => setFollowUpNotes(e.target.value)}
                  rows={2}
                  placeholder="Ex: Ligar depois das 18h"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', color: '#0F172A' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowFollowUp(false)} style={{
                flex: 1, padding: '12px', borderRadius: 10, border: '1px solid #E2E8F0',
                background: '#F8FAFC', fontSize: 13, fontWeight: 600, color: '#64748B', cursor: 'pointer',
              }}>
                Saltar
              </button>
              <button
                onClick={handleSaveFollowUp}
                disabled={!followUpDate || !followUpTime || savingFollowUp}
                style={{
                  flex: 2, padding: '12px', borderRadius: 10, border: 'none',
                  background: followUpDate && followUpTime ? '#2563EB' : '#E2E8F0',
                  color: followUpDate && followUpTime ? '#fff' : '#9CA3AF',
                  fontSize: 13, fontWeight: 700,
                  cursor: followUpDate && followUpTime ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {savingFollowUp ? <Spinner size={16} color="#fff" /> : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal: custom fields + observacoes */}
      {showEdit && (
        <div onClick={() => !savingEdit && setShowEdit(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, maxHeight: '85vh', overflowY: 'auto', padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', margin: 0 }}>Editar Lead</h3>
              <button onClick={() => setShowEdit(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} color="#64748B" /></button>
            </div>

            {editDefs.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 14 }}>
                <CustomFieldsRenderer
                  defs={editDefs}
                  values={editCustom}
                  onChange={(k, v) => setEditCustom(cv => ({ ...cv, [k]: v }))}
                />
              </div>
            )}

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Notas / Observações</label>
              <textarea
                value={editObs}
                onChange={e => setEditObs(e.target.value)}
                rows={4}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 14, boxSizing: 'border-box', outline: 'none', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowEdit(false)} disabled={savingEdit} style={{ padding: '10px 18px', borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
                Cancelar
              </button>
              <button onClick={handleSaveEdit} disabled={savingEdit} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: '#2563EB', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', opacity: savingEdit ? 0.7 : 1 }}>
                {savingEdit ? 'A guardar...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div onClick={() => !deleting && setConfirmDelete(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 340, padding: 22 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>Eliminar esta lead?</div>
            <div style={{ fontSize: 13, color: '#64748B', marginBottom: 18 }}>Esta ação não pode ser desfeita. O histórico de chamadas associado também será removido.</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDelete(false)} disabled={deleting} style={{ padding: '9px 18px', borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>Cancelar</button>
              <button onClick={handleDeleteLead} disabled={deleting} style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: '#DC2626', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', opacity: deleting ? 0.7 : 1 }}>
                {deleting ? 'A eliminar...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
