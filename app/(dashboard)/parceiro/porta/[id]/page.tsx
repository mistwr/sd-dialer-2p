'use client'
import { useState, useRef, use as usePromise } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import {
  ArrowLeft, Phone, MapPin, Mail, Flame, Thermometer, Snowflake,
  Upload, FileText, Image as ImageIcon, ExternalLink, Clock, CheckCircle2,
} from 'lucide-react'
import { doorCaptureService } from '@/lib/services'
import { createClient } from '@/lib/supabase/client'
import { PageSpinner } from '@/components/ui/Spinner'
import { RESULTADO_PORTA_LABELS, TEMPERATURA_COLORS, TEMPERATURA_LABELS, PROBLEMA_TELECOM_LABELS } from '@/lib/types'

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F1F5F9', fontSize: 13 }}>
      <span style={{ color: '#64748B' }}>{label}</span>
      <span style={{ color: '#0F172A', fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

export default function CaptacaoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params)
  const [uploading, setUploading] = useState<'fatura_telecom' | 'fatura_energia' | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingTipo = useRef<'fatura_telecom' | 'fatura_energia' | 'outro'>('outro')

  const { data: capture, isLoading, mutate } = useSWR(['door-capture', id], () => doorCaptureService.getById(id))
  const { data: attachments = [], mutate: mutateAttachments } = useSWR(['door-capture-attachments', id], () => doorCaptureService.getAttachments(id))
  const { data: timeline = [] } = useSWR(
    capture?.lead_id ? ['lead-timeline', capture.lead_id] : null,
    () => doorCaptureService.getLeadTimeline(capture!.lead_id!)
  )

  if (isLoading || !capture) return <PageSpinner />

  const TempIcon = capture.temperatura === 'quente' ? Flame : capture.temperatura === 'morna' ? Thermometer : Snowflake

  const triggerUpload = (tipo: 'fatura_telecom' | 'fatura_energia') => {
    pendingTipo.current = tipo
    fileInputRef.current?.click()
  }

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(pendingTipo.current as 'fatura_telecom' | 'fatura_energia')
    setUploadError(null)
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      const fd = new FormData()
      fd.append('file', file)
      fd.append('door_capture_id', id)
      fd.append('tipo', pendingTipo.current)
      const res = await fetch('/api/door-captures/upload', {
        method: 'POST',
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
        body: fd,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao enviar ficheiro')
      mutateAttachments()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Erro ao enviar ficheiro')
    } finally {
      setUploading(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const openAttachment = async (path: string) => {
    const res = await fetch(`/api/door-captures/upload?path=${encodeURIComponent(path)}`)
    const json = await res.json()
    if (json.url) window.open(json.url, '_blank')
  }

  return (
    <div style={{ maxWidth: 620, margin: '0 auto', paddingBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <Link href="/parceiro/porta" style={{ background: '#F1F5F9', borderRadius: 10, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ArrowLeft size={18} color="#0F172A" />
        </Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', margin: 0 }}>{capture.nome}</h1>
          <p style={{ fontSize: 12, color: '#64748B', margin: '2px 0 0' }}>
            {new Date(capture.created_at).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, background: '#F8FAFC', border: `1.5px solid ${TEMPERATURA_COLORS[capture.temperatura ?? 'fria']}` }}>
          <TempIcon size={14} color={TEMPERATURA_COLORS[capture.temperatura ?? 'fria']} />
          <span style={{ fontSize: 12, fontWeight: 700, color: TEMPERATURA_COLORS[capture.temperatura ?? 'fria'] }}>{capture.score}/100</span>
        </div>
      </div>

      {/* Score motivos */}
      {capture.score_motivos.length > 0 && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 14, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#92400E', marginBottom: 8 }}>
            Porquê {TEMPERATURA_LABELS[capture.temperatura ?? 'fria']}?
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: '#78350F', lineHeight: 1.6 }}>
            {capture.score_motivos.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        </div>
      )}

      {/* Contacto */}
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 16, marginBottom: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#374151' }}><Phone size={14} /> {capture.telefone}</div>
          {capture.email && <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#374151' }}><Mail size={14} /> {capture.email}</div>}
          {capture.morada && <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#374151' }}><MapPin size={14} /> {capture.morada}, {capture.localidade}</div>}
        </div>
        <InfoRow label="Resultado" value={capture.resultado ? RESULTADO_PORTA_LABELS[capture.resultado] : null} />
        <InfoRow label="Interesse" value={capture.interesse} />
        <InfoRow label="Melhor horário" value={capture.melhor_horario} />
        {capture.notas && (
          <div style={{ marginTop: 10, padding: 10, background: '#F8FAFC', borderRadius: 10, fontSize: 13, color: '#374151' }}>
            {capture.notas}
          </div>
        )}
      </div>

      {/* Telecom */}
      {(capture.tc_operador_atual || capture.tc_mensalidade) && (
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>Telecomunicações</div>
          <InfoRow label="Operador atual" value={capture.tc_operador_atual} />
          <InfoRow label="Mensalidade" value={capture.tc_mensalidade ? `€${capture.tc_mensalidade}` : null} />
          <InfoRow label="Fim fidelização" value={capture.tc_fim_fidelizacao} />
          <InfoRow label="Satisfação" value={capture.tc_satisfacao ? `${capture.tc_satisfacao}/5` : null} />
          <InfoRow label="Problemas" value={capture.tc_problemas.length ? capture.tc_problemas.map(p => PROBLEMA_TELECOM_LABELS[p]).join(', ') : null} />
        </div>
      )}

      {/* Energia */}
      {(capture.en_comercializador_atual || capture.en_valor_medio_mensal) && (
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>Energia</div>
          <InfoRow label="Comercializador atual" value={capture.en_comercializador_atual} />
          <InfoRow label="Tipo" value={capture.en_tipo} />
          <InfoRow label="Valor médio mensal" value={capture.en_valor_medio_mensal ? `€${capture.en_valor_medio_mensal}` : null} />
          <InfoRow label="Fim de contrato" value={capture.en_fim_contrato} />
        </div>
      )}

      {/* Anexos */}
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 16, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 10 }}>Faturas / Anexos</div>
        <input ref={fileInputRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={handleFileSelected} />
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button onClick={() => triggerUpload('fatura_telecom')} disabled={!!uploading} style={{
            flex: 1, padding: '11px', borderRadius: 10, border: '1.5px dashed #CBD5E1', background: '#F8FAFC',
            fontSize: 12.5, fontWeight: 600, color: '#374151', cursor: uploading ? 'wait' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <Upload size={14} /> {uploading === 'fatura_telecom' ? 'A enviar...' : 'Fatura Telecom'}
          </button>
          <button onClick={() => triggerUpload('fatura_energia')} disabled={!!uploading} style={{
            flex: 1, padding: '11px', borderRadius: 10, border: '1.5px dashed #CBD5E1', background: '#F8FAFC',
            fontSize: 12.5, fontWeight: 600, color: '#374151', cursor: uploading ? 'wait' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <Upload size={14} /> {uploading === 'fatura_energia' ? 'A enviar...' : 'Fatura Energia'}
          </button>
        </div>
        {uploadError && <div style={{ fontSize: 12, color: '#DC2626', marginBottom: 10 }}>{uploadError}</div>}
        {attachments.length === 0 ? (
          <div style={{ fontSize: 12.5, color: '#94A3B8' }}>Sem anexos ainda.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {attachments.map(a => (
              <button key={a.id} onClick={() => openAttachment(a.storage_path)} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 10,
                background: '#F8FAFC', border: '1px solid #E2E8F0', cursor: 'pointer', textAlign: 'left', fontSize: 12.5, color: '#374151',
              }}>
                {a.content_type?.includes('pdf') ? <FileText size={14} color="#64748B" /> : <ImageIcon size={14} color="#64748B" />}
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.file_name}</span>
                <ExternalLink size={13} color="#94A3B8" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Timeline */}
      {timeline.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 10 }}>Histórico da lead</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {timeline.map(t => (
              <div key={t.id} style={{ display: 'flex', gap: 10 }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {t.tipo === 'porta' ? <MapPin size={12} color="#2563EB" /> : t.tipo === 'chamada' ? <Phone size={12} color="#2563EB" /> : <CheckCircle2 size={12} color="#2563EB" />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, color: '#374151' }}>{t.descricao}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <Clock size={10} /> {new Date(t.created_at).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {t.usuario?.full_name ? ` · ${t.usuario.full_name}` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
