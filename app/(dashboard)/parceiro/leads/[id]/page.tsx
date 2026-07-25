'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { use } from 'react'
import useSWR from 'swr'
import {
  Phone, MessageCircle, MapPin, ChevronLeft, Clock,
  User, MapPinned, Hash, Wifi, FileText, CheckCircle2,
  PhoneOff, PhoneMissed, AlertCircle, Calendar,
  HelpCircle, Plus, History, X,
} from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { useAuth } from '@/lib/hooks/useAuth'
import { leadService, callHistoryService, followUpService } from '@/lib/services'
import type { Lead, CallResult, CallHistory } from '@/lib/types'
import Link from 'next/link'

// ---- Call Results Config ----
const RESULTS: { key: CallResult; label: string; color: string; bg: string; Icon: React.ElementType }[] = [
  { key: 'venda',          label: 'Venda',          color: '#16A34A', bg: '#F0FDF4', Icon: CheckCircle2 },
  { key: 'nao_interessado',label: 'Nao Interessado', color: '#DC2626', bg: '#FEF2F2', Icon: PhoneOff },
  { key: 'nao_atende',     label: 'Nao Atende',      color: '#6B7280', bg: '#F9FAFB', Icon: PhoneMissed },
  { key: 'numero_errado',  label: 'Numero Errado',   color: '#7C3AED', bg: '#F5F3FF', Icon: AlertCircle },
  { key: 'ligar_depois',   label: 'Ligar Depois',    color: '#0891B2', bg: '#ECFEFF', Icon: Calendar },
  { key: 'sem_cobertura',  label: 'Sem Cobertura',   color: '#EA580C', bg: '#FFF7ED', Icon: Wifi },
  { key: 'outro',          label: 'Outro',           color: '#6B7280', bg: '#F9FAFB', Icon: HelpCircle },
]

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function LeadCallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user, profile } = useAuth()

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

  // Result modal
  const [showResult, setShowResult] = useState(false)
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
  const [tab, setTab] = useState<'info' | 'history'>('info')

  // Timer: start on call, stop when page regains visibility
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

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && timerActive) {
        stopTimer()
        setShowResult(true)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [timerActive, stopTimer])

  const handleCall = () => {
    if (!lead) return
    const phone = lead.telefone.replace(/\s/g, '')
    const telUrl = `tel:${phone}`
    startTimer()
    window.location.href = telUrl
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

  const handleSaveResult = async () => {
    if (!selectedResult || !lead || !user || !profile) return
    setSaving(true)
    try {
      await callHistoryService.create({
        lead_id: lead.id,
        parceiro_id: user.id,
        company_id: profile.company_id!,
        result: selectedResult,
        duration_sec: elapsed,
        notes: notes.trim() || undefined,
      })

      // Map call result to lead status
      const statusMap: Record<CallResult, Lead['status']> = {
        venda:          'vendido',
        nao_interessado:'nao_interessado',
        nao_atende:     'nao_atende',
        numero_errado:  'numero_errado',
        ligar_depois:   'ligar_depois',
        sem_cobertura:  'sem_cobertura',
        outro:          'contactado',
      }
      await leadService.update(lead.id, { status: statusMap[selectedResult] })
      await mutateLead()
      await mutateHistory()

      setShowResult(false)
      setSelectedResult(null)
      setNotes('')
      setElapsed(0)

      // If "ligar_depois", show follow-up dialog
      if (selectedResult === 'ligar_depois') setShowFollowUp(true)
    } finally {
      setSaving(false)
    }
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
          transition: 'color 0.15s',
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
              {/* Status badge */}
              <div style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                background: 'rgba(255,255,255,0.1)', color: '#E2E8F0',
                textTransform: 'capitalize', whiteSpace: 'nowrap',
              }}>
                {lead.status.replace(/_/g, ' ')}
              </div>
            </div>

            {/* Timer */}
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

          {/* Action Buttons */}
          <div style={{ padding: '16px 20px', display: 'flex', gap: 10 }}>
            <button
              onClick={handleCall}
              style={{
                flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: '#16A34A', color: '#fff', border: 'none', borderRadius: 12,
                padding: '14px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(22,163,74,0.3)',
                transition: 'transform 0.1s, box-shadow 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)'
                ;(e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(22,163,74,0.4)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(1)'
                ;(e.currentTarget as HTMLElement).style.boxShadow = '0 4px 14px rgba(22,163,74,0.3)'
              }}
            >
              <Phone size={20} />
              Chamar
            </button>
            <button
              onClick={handleWhatsApp}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0',
                borderRadius: 12, padding: '14px 0', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#DCFCE7' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#F0FDF4' }}
            >
              <MessageCircle size={18} />
              WhatsApp
            </button>
            <button
              onClick={handleNavigate}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE',
                borderRadius: 12, padding: '14px 0', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#DBEAFE' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#EFF6FF' }}
            >
              <MapPin size={18} />
              Navegar
            </button>
          </div>

          {/* Register result manually */}
          {!timerActive && (
            <div style={{ padding: '0 20px 16px' }}>
              <button
                onClick={() => setShowResult(true)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: 10,
                  padding: '10px 0', fontSize: 13, fontWeight: 500, color: '#64748B',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#2563EB'
                  ;(e.currentTarget as HTMLElement).style.color = '#2563EB'
                  ;(e.currentTarget as HTMLElement).style.background = '#EFF6FF'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#CBD5E1'
                  ;(e.currentTarget as HTMLElement).style.color = '#64748B'
                  ;(e.currentTarget as HTMLElement).style.background = '#F8FAFC'
                }}
              >
                <Plus size={15} />
                Registar resultado manualmente
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', borderRadius: 10, padding: 4, marginBottom: 16 }}>
          {(['info', 'history'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 7, border: 'none',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                background: tab === t ? '#fff' : 'transparent',
                color: tab === t ? '#0F172A' : '#64748B',
                boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {t === 'info' ? 'Informacao' : `Historico (${history.length})`}
            </button>
          ))}
        </div>

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

      {/* ---- Result Modal ---- */}
      {showResult && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'flex-end',
        }}>
          <div style={{
            width: '100%', background: '#fff',
            borderRadius: '20px 20px 0 0',
            padding: '24px 20px 32px',
            maxHeight: '85vh', overflowY: 'auto',
          }} className="anim-scale-in">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', margin: 0 }}>Resultado da Chamada</h2>
                {elapsed > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, color: '#64748B', fontSize: 12 }}>
                    <Clock size={12} />
                    Duracao: {formatDuration(elapsed)}
                  </div>
                )}
              </div>
              <button onClick={() => setShowResult(false)} style={{
                background: '#F1F5F9', border: 'none', borderRadius: 8, cursor: 'pointer',
                width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <X size={16} color="#64748B" />
              </button>
            </div>

            {/* Result options */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
              {RESULTS.map(r => {
                const selected = selectedResult === r.key
                const Icon = r.Icon
                return (
                  <button
                    key={r.key}
                    onClick={() => setSelectedResult(r.key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '13px 14px', borderRadius: 12, cursor: 'pointer',
                      border: `2px solid ${selected ? r.color : '#E2E8F0'}`,
                      background: selected ? r.bg : '#fff',
                      transition: 'all 0.15s',
                    }}
                  >
                    <Icon size={18} color={r.color} />
                    <span style={{ fontSize: 13, fontWeight: selected ? 700 : 500, color: selected ? r.color : '#374151' }}>
                      {r.label}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Notes */}
            <textarea
              placeholder="Notas adicionais (opcional)..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #E2E8F0',
                fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'inherit',
                boxSizing: 'border-box', color: '#0F172A', marginBottom: 16,
              }}
            />

            {/* Save */}
            <button
              onClick={handleSaveResult}
              disabled={!selectedResult || saving}
              style={{
                width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                background: selectedResult ? '#2563EB' : '#E2E8F0',
                color: selectedResult ? '#fff' : '#9CA3AF',
                fontSize: 15, fontWeight: 700, cursor: selectedResult ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'background 0.15s',
              }}
            >
              {saving ? <Spinner size={18} color="#fff" /> : 'Guardar Resultado'}
            </button>
          </div>
        </div>
      )}

      {/* ---- Follow-up Modal ---- */}
      {showFollowUp && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
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
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  Data
                </label>
                <input
                  type="date"
                  value={followUpDate}
                  onChange={e => setFollowUpDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    border: '1px solid #E2E8F0', fontSize: 13, outline: 'none',
                    boxSizing: 'border-box', color: '#0F172A',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  Hora
                </label>
                <input
                  type="time"
                  value={followUpTime}
                  onChange={e => setFollowUpTime(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    border: '1px solid #E2E8F0', fontSize: 13, outline: 'none',
                    boxSizing: 'border-box', color: '#0F172A',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  Nota (opcional)
                </label>
                <textarea
                  value={followUpNotes}
                  onChange={e => setFollowUpNotes(e.target.value)}
                  rows={2}
                  placeholder="Ex: Cliente pede para ligar depois das 18h"
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    border: '1px solid #E2E8F0', fontSize: 13, resize: 'none',
                    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', color: '#0F172A',
                  }}
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
                  fontSize: 13, fontWeight: 700, cursor: followUpDate && followUpTime ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {savingFollowUp ? <Spinner size={16} color="#fff" /> : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
