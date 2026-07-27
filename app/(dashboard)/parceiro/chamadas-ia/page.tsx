'use client'

/**
 * /parceiro/chamadas-ia
 * Historico de Chamadas com IA — parceiro view.
 * Lists all recordings, allows playback, download, and shows AI analysis.
 * Additive only — no existing page modified.
 */

import { useState } from 'react'
import useSWR from 'swr'
import {
  AudioLines, Play, Download, Brain, ChevronDown, ChevronUp,
  Clock, User, Megaphone, Calendar, RefreshCw, Loader2, Mic,
} from 'lucide-react'
import AIAnalysisPanel from '@/components/ai/AIAnalysisPanel'

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

export default function ChamadasIAPage() {
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
            Historico de gravacoes com analise de IA
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
    </div>
  )
}
