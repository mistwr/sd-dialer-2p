'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { ChevronDown, ChevronUp, Loader2, PhoneCall, RefreshCw } from 'lucide-react'

type VoiceTranscriptLine = {
  id: string
  speaker: string
  text: string
  is_interruption: boolean
  spoken_at: string
}

type VoiceCall = {
  id: string
  client_name: string | null
  phone_number: string
  status: string
  duration_seconds: number | null
  transcript_consent_status: 'pending' | 'granted' | 'denied' | 'not_requested' | 'unavailable' | string
  transcript_consent_at: string | null
  ended_at: string | null
  created_at: string
  transcripts: VoiceTranscriptLine[]
}

async function fetcher(url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Erro ao carregar o histórico')
  return response.json() as Promise<{ calls: VoiceCall[]; total: number }>
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('pt-PT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDuration(seconds: number | null) {
  if (seconds == null) return '—'
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return minutes ? `${minutes} min ${remainder} s` : `${remainder} s`
}

function formatTranscriptTime(spokenAt: string, callStartedAt: string) {
  const spokenMs = Date.parse(spokenAt)
  const startedMs = Date.parse(callStartedAt)
  if (!Number.isFinite(spokenMs)) return 'Hora indisponível'
  const clock = new Date(spokenMs).toLocaleTimeString('pt-PT', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  if (!Number.isFinite(startedMs) || spokenMs < startedMs) return clock
  const elapsed = Math.floor((spokenMs - startedMs) / 1000)
  const minutes = Math.floor(elapsed / 60)
  const seconds = String(elapsed % 60).padStart(2, '0')
  return `${clock} · +${minutes}:${seconds}`
}

function consentLabel(status: VoiceCall['transcript_consent_status']) {
  if (status === 'granted') return 'Transcrição autorizada'
  if (status === 'denied') return 'Transcrição não autorizada'
  if (status === 'pending') return 'Sem autorização confirmada'
  return 'Sem transcrição'
}

function callStatusLabel(status: string, endedAt: string | null) {
  const terminalLabels: Record<string, string> = {
    failed: 'Falhada',
    voicemail: 'Correio de voz',
    not_interested: 'Sem interesse',
    do_not_call: 'Não voltar a ligar',
  }
  if (terminalLabels[status]) return terminalLabels[status]
  if (endedAt) return 'Terminada'
  const labels: Record<string, string> = {
    queued: 'A aguardar',
    ringing: 'A tocar',
    answered: 'Atendida',
    active: 'Em curso',
    interested: 'Interessado',
    follow_up: 'Pedir novo contacto',
    transferred: 'Transferida',
    sale: 'Venda',
    callback: 'Pedir retorno',
  }
  return labels[status] ?? status
}

export default function VoiceCallHistory() {
  const [openCallId, setOpenCallId] = useState<string | null>(null)
  const { data, error, isLoading, mutate } = useSWR('/api/voice-calls?limit=50', fetcher, {
    refreshInterval: 15000,
    revalidateOnFocus: true,
  })

  const calls = data?.calls ?? []

  return (
    <section style={{
      background: '#fff',
      border: '1px solid #E2E8F0',
      borderRadius: 14,
      padding: 18,
      marginBottom: 22,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
        marginBottom: 14,
      }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, margin: '0 0 5px', color: '#0F172A' }}>
            <PhoneCall size={18} color="#2563EB" />
            Chamadas da Lumin
          </h2>
          <p style={{ margin: 0, color: '#64748B', fontSize: 12.5, lineHeight: 1.5 }}>
            O áudio não é gravado. A transcrição em texto só é guardada após autorização da pessoa.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void mutate()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            border: '1px solid #CBD5E1',
            background: '#fff',
            borderRadius: 8,
            padding: '7px 10px',
            color: '#334155',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={14} />
          Atualizar
        </button>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '24px 0', color: '#64748B', fontSize: 13 }}>
          <Loader2 size={18} style={{ animation: 'spin 0.75s linear infinite' }} />
          A carregar chamadas...
        </div>
      ) : error ? (
        <div style={{ padding: '14px 0', color: '#B91C1C', fontSize: 13 }}>
          Não foi possível carregar as chamadas. Atualize para tentar novamente.
        </div>
      ) : calls.length === 0 ? (
        <div style={{ padding: '18px 0', color: '#64748B', fontSize: 13 }}>
          Ainda não há chamadas da Lumin registadas. As chamadas feitas antes desta atualização não podem ser recuperadas.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {calls.map((call) => {
            const expanded = openCallId === call.id
            return (
              <div key={call.id} style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpenCallId(expanded ? null : call.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                    width: '100%',
                    padding: '12px 14px',
                    border: 'none',
                    background: expanded ? '#F8FAFC' : '#fff',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ minWidth: 140, flex: '1 1 180px' }}>
                    <span style={{ display: 'block', color: '#0F172A', fontSize: 13.5, fontWeight: 700 }}>
                      {call.client_name || call.phone_number}
                    </span>
                    <span style={{ display: 'block', color: '#64748B', fontSize: 12, marginTop: 3 }}>
                      {call.phone_number} · {formatDate(call.created_at)}
                    </span>
                  </span>
                  <span style={{ color: '#475569', fontSize: 12 }}>
                    {callStatusLabel(call.status, call.ended_at)} · {formatDuration(call.duration_seconds)}
                  </span>
                  <span style={{
                    color: call.transcript_consent_status === 'granted' ? '#166534' : '#64748B',
                    background: call.transcript_consent_status === 'granted' ? '#DCFCE7' : '#F1F5F9',
                    padding: '4px 8px',
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 600,
                  }}>
                    {consentLabel(call.transcript_consent_status)}
                  </span>
                  {expanded ? <ChevronUp size={16} color="#64748B" /> : <ChevronDown size={16} color="#64748B" />}
                </button>

                {expanded && (
                  <div style={{ padding: '12px 14px', borderTop: '1px solid #E2E8F0', background: '#fff' }}>
                    {call.transcript_consent_status === 'granted' && call.transcripts.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {call.transcripts.map((line) => (
                          <div key={line.id} style={{ display: 'grid', gridTemplateColumns: '70px minmax(0, 1fr)', gap: 9 }}>
                            <span style={{ color: '#64748B', fontSize: 12, fontWeight: 700 }}>
                              {line.speaker === 'agent' ? 'Lumin' : 'Contacto'}
                              <span style={{ display: 'block', fontSize: 10, fontWeight: 500, marginTop: 3, fontVariantNumeric: 'tabular-nums' }} title="Hora da intervenção e tempo desde o início da chamada">
                                {formatTranscriptTime(line.spoken_at, call.created_at)}
                              </span>
                            </span>
                            <p style={{ margin: 0, color: '#1E293B', fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                              {line.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ margin: 0, color: '#64748B', fontSize: 12.5, lineHeight: 1.5 }}>
                        {call.transcript_consent_status === 'denied'
                          ? 'A chamada foi registada, mas a pessoa não autorizou guardar a transcrição.'
                          : call.transcript_consent_status === 'granted'
                            ? 'A autorização foi dada, mas não há texto disponível para esta chamada.'
                            : 'A chamada foi registada. Não foi recebida uma autorização clara para guardar a transcrição.'}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
