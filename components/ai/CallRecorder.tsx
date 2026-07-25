'use client'

/**
 * CallRecorder
 *
 * Adds a "Gravar Chamada" button during a call.
 * On call end, shows the post-call modal.
 *
 * Usage:
 *   <CallRecorder
 *     callActive={isCallActive}
 *     callHistoryId={historyId}
 *     leadId={lead.id}
 *     campanhaId={campanha?.id}
 *     onClose={() => {}}
 *   />
 *
 * The CRM works fully without this — it is purely additive.
 */

import { useState, useRef, useEffect } from 'react'
import { Mic, MicOff, Upload, Brain, X, CheckCircle, AlertCircle, Loader2, Download, Smartphone } from 'lucide-react'
import PostCallModal from './PostCallModal'

interface Props {
  callActive: boolean
  callHistoryId?: string | null
  leadId?: string | null
  campanhaId?: string | null
  leadName?: string
}

type RecordingState = 'idle' | 'recording' | 'stopped' | 'uploading' | 'done' | 'error'

export default function CallRecorder({ callActive, callHistoryId, leadId, campanhaId, leadName }: Props) {
  const [state, setState] = useState<RecordingState>('idle')
  const [supported, setSupported] = useState<boolean | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [duration, setDuration] = useState(0)
  const [recordingId, setRecordingId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showUnsupportedHint, setShowUnsupportedHint] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)

  // Check MediaRecorder support on mount
  useEffect(() => {
    setSupported(
      typeof window !== 'undefined' &&
      typeof MediaRecorder !== 'undefined' &&
      typeof navigator?.mediaDevices?.getUserMedia === 'function'
    )
  }, [])

  // Stop recording when call ends
  useEffect(() => {
    if (!callActive && state === 'recording') {
      stopRecording()
    }
  }, [callActive]) // eslint-disable-line

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      mediaRef.current?.stream?.getTracks().forEach(t => t.stop())
    }
  }, [])

  async function startRecording() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/ogg'

      const recorder = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        const recorded = new Blob(chunksRef.current, { type: mimeType })
        setBlob(recorded)
        setState('stopped')
        setDuration(Math.round((Date.now() - startTimeRef.current) / 1000))
      }

      recorder.start(1000) // collect chunks every 1s
      mediaRef.current = recorder
      startTimeRef.current = Date.now()
      setState('recording')
      timerRef.current = setInterval(() => {
        setDuration(Math.round((Date.now() - startTimeRef.current) / 1000))
      }, 1000)
    } catch {
      setError('Microfone não disponível. Verifique as permissões.')
      setState('error')
    }
  }

  function stopRecording() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    mediaRef.current?.stop()
  }

  async function uploadRecording() {
    if (!blob) return
    setState('uploading')
    setError(null)

    try {
      const form = new FormData()
      form.append('file', blob, `gravacao-${Date.now()}.webm`)
      if (callHistoryId) form.append('call_history_id', callHistoryId)
      if (leadId) form.append('lead_id', leadId)
      if (campanhaId) form.append('campanha_id', campanhaId)

      const res = await fetch('/api/recordings/upload', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro no upload')

      setRecordingId(json.recording?.id ?? null)
      setState('done')
      setShowModal(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro no upload')
      setState('error')
    }
  }

  function downloadRecording() {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gravacao-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`
    a.click()
    URL.revokeObjectURL(url)
  }

  function formatDuration(sec: number) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0')
    const s = (sec % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  // Not supported on this device
  if (supported === false) {
    return (
      <div>
        <button
          onClick={() => setShowUnsupportedHint(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 8, border: '1px solid #E2E8F0',
            background: '#F8FAFC', color: '#64748B', fontSize: 13,
            cursor: 'pointer', fontWeight: 500,
          }}
        >
          <Smartphone size={15} />
          Gravar Chamada
        </button>
        {showUnsupportedHint && (
          <div style={{
            marginTop: 8, padding: '10px 14px', borderRadius: 8,
            background: '#FEF3C7', border: '1px solid #FCD34D',
            fontSize: 12, color: '#92400E', maxWidth: 340,
          }}>
            Este dispositivo não suporta gravação automática. Utilize a gravação nativa do telemóvel e depois envie automaticamente a gravação.
          </div>
        )}
      </div>
    )
  }

  if (supported === null) return null // still detecting

  return (
    <>
      {/* Recording controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>

        {/* Record / Stop button — only visible during active call */}
        {callActive && state === 'idle' && (
          <button
            onClick={startRecording}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8,
              background: '#DC2626', color: '#fff',
              border: 'none', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', transition: 'background 0.15s',
            }}
          >
            <Mic size={15} />
            Gravar Chamada
          </button>
        )}

        {state === 'recording' && (
          <button
            onClick={stopRecording}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8,
              background: '#7F1D1D', color: '#fff',
              border: 'none', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', animation: 'pulseDot 1.6s ease-in-out infinite',
            }}
          >
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: '#FCA5A5', display: 'inline-block',
            }} />
            Gravar {formatDuration(duration)}
          </button>
        )}

        {state === 'stopped' && blob && (
          <>
            <span style={{ fontSize: 12, color: '#64748B' }}>
              Gravacao: {formatDuration(duration)}
            </span>
            <button onClick={uploadRecording} className="sd-btn-primary" style={{ fontSize: 13, padding: '7px 14px', gap: 6, display: 'flex', alignItems: 'center' }}>
              <Upload size={14} />
              Enviar gravacao
            </button>
            <button onClick={() => setShowModal(true)} className="sd-btn-secondary" style={{ fontSize: 13, padding: '7px 14px', gap: 6, display: 'flex', alignItems: 'center' }}>
              <Brain size={14} />
              Analisar com IA
            </button>
            <button onClick={downloadRecording} className="sd-btn-secondary" style={{ fontSize: 13, padding: '7px 14px', gap: 6, display: 'flex', alignItems: 'center' }}>
              <Download size={14} />
            </button>
            <button onClick={() => setState('idle')} style={{
              padding: '7px 10px', borderRadius: 8, border: '1px solid #E2E8F0',
              background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center',
            }}>
              <X size={14} color="#64748B" />
            </button>
          </>
        )}

        {state === 'uploading' && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#2563EB' }}>
            <Loader2 size={15} style={{ animation: 'spin 0.75s linear infinite' }} />
            A enviar...
          </span>
        )}

        {state === 'done' && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#16A34A' }}>
            <CheckCircle size={15} />
            Gravacao enviada
          </span>
        )}

        {state === 'error' && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#DC2626' }}>
            <AlertCircle size={15} />
            {error ?? 'Erro'}
          </span>
        )}
      </div>

      {/* Post-call modal */}
      {showModal && (
        <PostCallModal
          recordingId={recordingId}
          audioBlob={blob}
          leadName={leadName}
          duration={duration}
          onClose={() => {
            setShowModal(false)
            setState('idle')
            setBlob(null)
            setDuration(0)
          }}
        />
      )}
    </>
  )
}
