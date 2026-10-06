'use client'

import { useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { CheckCircle2, FileText, LockKeyhole, ShieldCheck, Trash2, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type SaleSummary = {
  client_name: string | null
  service_type: string | null
  operator: string | null
  plano: string | null
  amount: number | string | null
  contract_type: string | null
}
type SelectedFile = { key: string; file: File; file_type: string }
type UploadedFile = { key: string; path: string }

const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'])
const inputStyle = {
  width: '100%',
  boxSizing: 'border-box' as const,
  border: '1px solid #CBD5E1',
  borderRadius: 10,
  padding: '11px 12px',
  background: '#fff',
  color: '#0F172A',
  fontSize: 14,
}
const labelStyle = { display: 'block', color: '#334155', fontSize: 13, fontWeight: 700, marginBottom: 6 }

function money(value: number | string | null) {
  if (value === null || value === '') return null
  const amount = Number(value)
  if (!Number.isFinite(amount)) return null
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(amount)
}

export default function AssinarVendaPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [token, setToken] = useState('')
  const [sale, setSale] = useState<SaleSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [attachments, setAttachments] = useState<SelectedFile[]>([])
  const [uploaded, setUploaded] = useState<UploadedFile[]>([])
  const [accepted, setAccepted] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [drawing, setDrawing] = useState(false)

  useEffect(() => {
    const linkToken = window.location.hash.slice(1)
    if (!linkToken) {
      setError('Este link não contém um código de assinatura. Pede um novo link ao comercial.')
      setLoading(false)
      return
    }
    setToken(linkToken)
    fetch('/api/vendas/signature-requests/public', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'preview', token: linkToken }),
      cache: 'no-store',
    }).then(async (response) => {
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Este link já não está ativo.')
      setSale(data.sale)
      setCompleted(Boolean(data.completed))
    }).catch((reason) => {
      setError(reason instanceof Error ? reason.message : 'Não foi possível abrir este pedido.')
    }).finally(() => setLoading(false))
  }, [])

  const startDrawing = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || completed || success) return
    const context = canvas.getContext('2d')
    if (!context) return
    const rect = canvas.getBoundingClientRect()
    context.beginPath()
    context.moveTo(
      ((event.clientX - rect.left) / rect.width) * canvas.width,
      ((event.clientY - rect.top) / rect.height) * canvas.height,
    )
    context.lineWidth = 4
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.strokeStyle = '#0F172A'
    canvas.setPointerCapture(event.pointerId)
    setDrawing(true)
    setHasSignature(true)
  }

  const continueDrawing = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing) return
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const rect = canvas.getBoundingClientRect()
    context.lineTo(
      ((event.clientX - rect.left) / rect.width) * canvas.width,
      ((event.clientY - rect.top) / rect.height) * canvas.height,
    )
    context.stroke()
  }

  const stopDrawing = () => setDrawing(false)

  const clearSignature = () => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }

  const addFiles = (fileType: string, fileList: FileList | null) => {
    setError('')
    const incoming = Array.from(fileList || [])
    if (attachments.length + incoming.length > 6) {
      setError('Podes anexar até seis ficheiros.')
      return
    }
    const invalid = incoming.find((file) => !allowedTypes.has(file.type) || file.size > 10 * 1024 * 1024 || file.size === 0)
    if (invalid) {
      setError('Usa PDF, JPEG, PNG, WebP ou HEIC. Cada ficheiro pode ter até 10 MB.')
      return
    }
    const additions = incoming.map((file, index) => ({
      key: String(Date.now()) + '-' + Math.random().toString(36).slice(2) + '-' + String(index) + '-' + file.name + '-' + String(file.size),
      file,
      file_type: fileType,
    }))
    setAttachments((current) => [...current, ...additions])
  }

  const removeFile = (key: string) => {
    setAttachments((current) => current.filter((item) => item.key !== key))
    setUploaded((current) => current.filter((item) => item.key !== key))
  }

  const submitSignature = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!token || !sale) return
    if (!hasSignature || !canvasRef.current) {
      setError('Assina dentro do campo antes de continuar.')
      return
    }
    if (!accepted) {
      setError('Confirma a declaração para enviar a assinatura.')
      return
    }

    setSubmitting(true)
    try {
      let currentUploads = [...uploaded]
      const client = createClient()

      for (const attachment of attachments) {
        if (currentUploads.some((item) => item.key === attachment.key)) continue

        const preparation = await fetch('/api/vendas/signature-requests/public', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'upload-url',
            token,
            file_type: attachment.file_type,
            file_name: attachment.file.name,
            content_type: attachment.file.type,
            file_size: attachment.file.size,
          }),
          cache: 'no-store',
        })
        const upload = await preparation.json()
        if (!preparation.ok) throw new Error(upload.error || 'Não foi possível preparar o anexo.')

        const { error: uploadError } = await client.storage
          .from('venda-assinaturas')
          .uploadToSignedUrl(upload.path, upload.upload_token, attachment.file, {
            contentType: attachment.file.type,
            upsert: false,
          })
        if (uploadError) throw uploadError

        currentUploads = [...currentUploads, { key: attachment.key, path: upload.path }]
        setUploaded(currentUploads)
      }

      const filePaths = attachments.map((item) => currentUploads.find((file) => file.key === item.key)?.path)
      if (filePaths.some((path) => !path)) throw new Error('Um dos anexos ainda não foi carregado.')

      const response = await fetch('/api/vendas/signature-requests/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete',
          token,
          accepted: true,
          signature_data: canvasRef.current.toDataURL('image/png'),
          file_paths: filePaths,
        }),
        cache: 'no-store',
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Não foi possível concluir o pedido.')
      setSuccess(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'O envio falhou. Tenta novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  const heading = (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: '#2563EB', fontWeight: 800, fontSize: 12, letterSpacing: 0.4 }}>
        <LockKeyhole size={15} /> SD DIALER · ÁREA SEGURA
      </div>
      <h1 style={{ color: '#0F172A', fontSize: 24, lineHeight: 1.2, margin: '9px 0 5px', fontWeight: 800 }}>Confirmação e assinatura</h1>
      <p style={{ color: '#64748B', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
        Confirma os dados do pedido, assina com o dedo e, se necessário, anexa os documentos.
      </p>
    </div>
  )

  return (
    <main style={{ minHeight: '100vh', background: '#F1F5F9', padding: '24px 14px 48px', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 620, margin: '0 auto' }}>
        <section style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 18, padding: '24px 20px', boxShadow: '0 12px 32px rgba(15,23,42,0.06)' }}>
          {heading}

          {loading && <p style={{ color: '#64748B', padding: '24px 0' }}>A validar o link seguro…</p>}

          {!loading && error && !sale && (
            <div role="alert" style={{ background: '#FEF2F2', color: '#991B1B', padding: 14, borderRadius: 10, fontSize: 14 }}>
              {error}
            </div>
          )}

          {!loading && sale && (success || completed) && (
            <div style={{ textAlign: 'center', padding: '22px 8px 8px' }}>
              <CheckCircle2 size={46} color="#16A34A" style={{ margin: '0 auto 12px' }} />
              <h2 style={{ color: '#0F172A', fontSize: 19, margin: '0 0 8px' }}>
                {success ? 'Assinatura enviada com sucesso' : 'Este pedido já foi assinado'}
              </h2>
              <p style={{ color: '#64748B', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                {success
                  ? 'A assinatura e os anexos foram enviados de forma privada para a equipa comercial.'
                  : 'A equipa comercial já recebeu a assinatura e os anexos deste pedido.'}
              </p>
            </div>
          )}

          {!loading && sale && !success && !completed && (
            <>
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 15, marginBottom: 20 }}>
                <div style={{ color: '#64748B', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Resumo do pedido</div>
                <div style={{ color: '#0F172A', fontSize: 16, fontWeight: 800 }}>{sale.client_name || 'Cliente'}</div>
                {[sale.service_type, sale.operator, sale.plano, sale.contract_type].filter(Boolean).map((value, index) => (
                  <div key={index} style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>{value}</div>
                ))}
                {money(sale.amount) && <div style={{ color: '#0F172A', fontSize: 14, fontWeight: 700, marginTop: 7 }}>{money(sale.amount)} / mês</div>}
              </div>

              <form onSubmit={submitSignature} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7, gap: 8 }}>
                    <label style={{ ...labelStyle, margin: 0 }}>Assina aqui com o dedo</label>
                    <button type="button" onClick={clearSignature} disabled={submitting} style={{ border: 0, background: 'transparent', color: '#2563EB', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                      Limpar
                    </button>
                  </div>
                  <canvas
                    ref={canvasRef}
                    width={720}
                    height={220}
                    onPointerDown={startDrawing}
                    onPointerMove={continueDrawing}
                    onPointerUp={stopDrawing}
                    onPointerCancel={stopDrawing}
                    style={{ display: 'block', width: '100%', height: 180, border: '1.5px dashed #94A3B8', borderRadius: 12, background: '#fff', touchAction: 'none', cursor: 'crosshair' }}
                  />
                  <p style={{ color: '#94A3B8', fontSize: 11, margin: '6px 0 0' }}>Usa o dedo, uma caneta ou o rato. A assinatura fica associada a este pedido.</p>
                </div>

                <div>
                  <label style={labelStyle}>Anexar documentos (opcional, até 6 ficheiros)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                    {[
                      ['identificacao', 'Documento de identificação'],
                      ['comprovativo_morada', 'Comprovativo de morada'],
                      ['fatura', 'Fatura ou comprovativo'],
                      ['outro', 'Outro documento'],
                    ].map(([fileType, label]) => (
                      <label key={fileType} style={{ display: 'flex', alignItems: 'center', gap: 7, minHeight: 42, border: '1px solid #E2E8F0', borderRadius: 9, padding: '8px 10px', color: '#334155', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                        <Upload size={14} color="#2563EB" /> {label}
                        <input
                          type="file"
                          accept=".pdf,image/jpeg,image/png,image/webp,image/heic"
                          multiple
                          hidden
                          disabled={submitting || attachments.length >= 6}
                          onChange={(event) => {
                            addFiles(fileType, event.target.files)
                            event.target.value = ''
                          }}
                        />
                      </label>
                    ))}
                  </div>
                  {attachments.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                      {attachments.map((item) => (
                        <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: '#F8FAFC', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: '#475569' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}><FileText size={14} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.file.name}</span></span>
                          <button type="button" aria-label="Remover ficheiro" onClick={() => removeFile(item.key)} style={{ border: 0, background: 'transparent', color: '#DC2626', cursor: 'pointer', padding: 3 }}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p style={{ color: '#94A3B8', fontSize: 11, margin: '6px 0 0' }}>PDF, JPEG, PNG, WebP ou HEIC. Máximo de 10 MB por ficheiro.</p>
                </div>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: 12, borderRadius: 10, background: '#EFF6FF', color: '#1E3A8A', fontSize: 13, lineHeight: 1.5, cursor: 'pointer' }}>
                  <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} style={{ marginTop: 3 }} />
                  <span>{'Confirmo que revi os dados apresentados e que pretendo assinar este pedido. A assinatura e os anexos serão enviados de forma privada para o comercial responsável.'}</span>
                </label>

                {error && (
                  <div role="alert" style={{ background: '#FEF2F2', color: '#991B1B', padding: 12, borderRadius: 9, fontSize: 13 }}>
                    {error}
                  </div>
                )}

                <button type="submit" disabled={submitting || !accepted || !hasSignature} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: 14, border: 0, borderRadius: 11, background: submitting || !accepted || !hasSignature ? '#94A3B8' : '#2563EB', color: '#fff', fontWeight: 800, fontSize: 14, cursor: submitting || !accepted || !hasSignature ? 'not-allowed' : 'pointer' }}>
                  {submitting ? 'A enviar assinatura e anexos…' : <><ShieldCheck size={17} /> Confirmar e enviar</>}
                </button>
              </form>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#64748B', fontSize: 11, marginTop: 16 }}>
                <LockKeyhole size={13} /> Ficheiros guardados num espaço privado, acessível à equipa autorizada.
              </div>
            </>
          )}
        </section>
        <p style={{ color: '#94A3B8', fontSize: 11, textAlign: 'center', margin: '13px 0 0' }}>Link individual, válido por sete dias.</p>
      </div>
    </main>
  )
}
