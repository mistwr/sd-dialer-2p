'use client'

/**
 * PostCallModal
 * Shown automatically after a call ends if a recording exists.
 * Options: Upload, Analyse with AI, Ignore.
 */

import { useState } from 'react'
import { Upload, Brain, X, Loader2, CheckCircle, AlertCircle, Download } from 'lucide-react'

interface Props {
  recordingId: string | null    // null if not yet uploaded
  audioBlob: Blob | null
  leadName?: string
  duration?: number
  onClose: () => void
}

type Phase = 'menu' | 'analysing' | 'result' | 'error'

export default function PostCallModal({ recordingId, audioBlob, leadName, duration, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>('menu')
  const [analysis, setAnalysis] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [currentRecordingId, setCurrentRecordingId] = useState(recordingId)

  function formatDuration(sec?: number) {
    if (!sec) return '--:--'
    const m = Math.floor(sec / 60).toString().padStart(2, '0')
    const s = (sec % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  async function uploadAndAnalyse() {
    let rid = currentRecordingId

    // Upload first if not yet done
    if (!rid && audioBlob) {
      setUploading(true)
      try {
        const form = new FormData()
        form.append('file', audioBlob, `gravacao-${Date.now()}.webm`)
        const res = await fetch('/api/recordings/upload', { method: 'POST', body: form })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error)
        rid = json.recording?.id
        setCurrentRecordingId(rid ?? null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro no upload')
        setPhase('error')
        setUploading(false)
        return
      }
      setUploading(false)
    }

    if (!rid) { setError('Sem gravacao para analisar.'); setPhase('error'); return }

    setPhase('analysing')
    try {
      const res = await fetch('/api/recordings/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recording_id: rid }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setAnalysis(json.analysis)
      setPhase('result')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro na analise')
      setPhase('error')
    }
  }

  function downloadBlob() {
    if (!audioBlob) return
    const url = URL.createObjectURL(audioBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gravacao-${new Date().toISOString().slice(0, 10)}.webm`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div className="anim-scale-in" style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 20px', borderBottom: '1px solid #E2E8F0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#0F172A' }}>
              Chamada Terminada
            </div>
            {leadName && (
              <div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                {leadName} &middot; {formatDuration(duration)}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 8, border: '1px solid #E2E8F0',
            background: 'transparent', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={16} color="#64748B" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20 }}>

          {/* MENU phase */}
          {phase === 'menu' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {!currentRecordingId && audioBlob && (
                <button
                  onClick={async () => {
                    setUploading(true)
                    const form = new FormData()
                    form.append('file', audioBlob, 'gravacao.webm')
                    const res = await fetch('/api/recordings/upload', { method: 'POST', body: form })
                    const json = await res.json()
                    setCurrentRecordingId(json.recording?.id ?? null)
                    setUploading(false)
                  }}
                  disabled={uploading}
                  className="sd-btn-primary"
                  style={{ width: '100%', justifyContent: 'flex-start', gap: 10, padding: '12px 16px' }}
                >
                  {uploading ? <Loader2 size={18} style={{ animation: 'spin 0.75s linear infinite' }} /> : <Upload size={18} />}
                  Enviar gravacao
                </button>
              )}

              {currentRecordingId && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 14px', borderRadius: 8,
                  background: '#DCFCE7', color: '#14532D', fontSize: 13,
                }}>
                  <CheckCircle size={16} />
                  Gravacao guardada com sucesso
                </div>
              )}

              <button
                onClick={uploadAndAnalyse}
                disabled={uploading}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 16px', borderRadius: 10,
                  background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
                  color: '#fff', border: 'none', cursor: 'pointer',
                  fontWeight: 600, fontSize: 14,
                }}
              >
                <Brain size={18} />
                Analisar com IA
              </button>

              {audioBlob && (
                <button
                  onClick={downloadBlob}
                  className="sd-btn-secondary"
                  style={{ width: '100%', justifyContent: 'flex-start', gap: 10, padding: '12px 16px' }}
                >
                  <Download size={18} />
                  Descarregar gravacao
                </button>
              )}

              <button
                onClick={onClose}
                style={{
                  width: '100%', padding: '11px 16px', borderRadius: 10,
                  border: '1px solid #E2E8F0', background: 'transparent',
                  color: '#64748B', cursor: 'pointer', fontSize: 14,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                <X size={16} />
                Ignorar
              </button>
            </div>
          )}

          {/* ANALYSING phase */}
          {phase === 'analysing' && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'linear-gradient(135deg, #2563EB, #7C3AED)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                <Brain size={28} color="#fff" />
              </div>
              <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>A analisar com IA...</div>
              <div style={{ fontSize: 13, color: '#64748B', marginBottom: 20 }}>
                Transcrever audio, identificar objecoes e gerar relatorio
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                {['Transcrever', 'Analisar', 'Gerar relatorio'].map((step, i) => (
                  <div key={i} style={{
                    padding: '4px 10px', borderRadius: 99, fontSize: 11,
                    background: '#EFF6FF', color: '#2563EB', fontWeight: 500,
                  }}>
                    <Loader2 size={10} style={{ animation: 'spin 0.75s linear infinite', marginRight: 4, display: 'inline' }} />
                    {step}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* RESULT phase — mini preview */}
          {phase === 'result' && analysis && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle size={18} color="#16A34A" />
                <span style={{ fontWeight: 600, color: '#0F172A' }}>Analise concluida</span>
              </div>

              {/* Score */}
              <div style={{
                padding: '12px 16px', borderRadius: 10,
                background: analysis.score >= 70 ? '#DCFCE7' : analysis.score >= 40 ? '#FEF3C7' : '#FEE2E2',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Score IA</span>
                <span style={{
                  fontWeight: 800, fontSize: 22,
                  color: analysis.score >= 70 ? '#14532D' : analysis.score >= 40 ? '#92400E' : '#7F1D1D',
                }}>
                  {analysis.score}<span style={{ fontSize: 13 }}>/100</span>
                </span>
              </div>

              {/* Summary */}
              {analysis.summary && (
                <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                  {analysis.summary}
                </div>
              )}

              {/* Next action */}
              {analysis.next_action && (
                <div style={{
                  padding: '10px 14px', borderRadius: 8,
                  background: '#EFF6FF', border: '1px solid #BFDBFE',
                  fontSize: 13, color: '#1E40AF', fontWeight: 500,
                }}>
                  Proxima acao: {analysis.next_action}
                </div>
              )}

              {/* Coach phrase */}
              {analysis.coach_phrase && (
                <div style={{
                  padding: '10px 14px', borderRadius: 8,
                  background: '#F5F3FF', border: '1px solid #DDD6FE',
                  fontSize: 13, color: '#5B21B6', fontStyle: 'italic',
                }}>
                  {analysis.coach_phrase}
                </div>
              )}

              <button onClick={onClose} className="sd-btn-primary" style={{ marginTop: 4 }}>
                Fechar e ver historico
              </button>
            </div>
          )}

          {/* ERROR phase */}
          {phase === 'error' && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <AlertCircle size={40} color="#DC2626" style={{ margin: '0 auto 12px', display: 'block' }} />
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Erro na analise</div>
              <div style={{ fontSize: 13, color: '#64748B', marginBottom: 20 }}>{error}</div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button onClick={() => { setPhase('menu'); setError(null) }} className="sd-btn-secondary">
                  Voltar
                </button>
                <button onClick={onClose} className="sd-btn-primary">Fechar</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
