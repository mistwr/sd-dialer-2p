'use client'

/**
 * AIAnalysisPanel
 *
 * Full expanded view of a single ai_analyses row.
 * Used inside the Historico de Chamadas tab.
 */

import { useState } from 'react'
import {
  FileText, Star, Lightbulb, Target, Calendar,
  TrendingUp, MessageSquare, ChevronDown, ChevronUp,
  BookOpen, Award, BarChart2, Bot,
} from 'lucide-react'
import AIChat from './AIChat'

interface Props {
  analysis: any  // ai_analyses row from API
  recordingId?: string
  leadName?: string | null
}

type Tab = 'resumo' | 'transcricao' | 'comercial' | 'treinador' | 'chat'

export default function AIAnalysisPanel({ analysis, recordingId, leadName }: Props) {
  const [tab, setTab] = useState<Tab>('resumo')
  const [showFull, setShowFull] = useState(false)

  if (!analysis) return null

  const score = analysis.score ?? 0
  const scoreColor = score >= 70 ? '#16A34A' : score >= 40 ? '#D97706' : '#DC2626'
  const scoreBg = score >= 70 ? '#DCFCE7' : score >= 40 ? '#FEF3C7' : '#FEE2E2'

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'resumo',      label: 'Resumo',      icon: <FileText size={13} /> },
    { key: 'transcricao', label: 'Transcricao',  icon: <BookOpen size={13} /> },
    { key: 'comercial',   label: 'Comercial',    icon: <BarChart2 size={13} /> },
    { key: 'treinador',   label: 'Treinador IA', icon: <Award size={13} /> },
    { key: 'chat',        label: 'Chat IA',      icon: <Bot size={13} /> },
  ]

  return (
    <div style={{
      border: '1px solid #E2E8F0', borderRadius: 12,
      background: '#fff', overflow: 'hidden',
    }}>
      {/* Header with score */}
      <div style={{
        padding: '12px 16px',
        background: 'linear-gradient(135deg, #0F172A, #1E293B)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'rgba(37,99,235,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Star size={14} color="#93C5FD" />
          </div>
          <span style={{ color: '#F1F5F9', fontWeight: 600, fontSize: 13 }}>
            Analise IA
          </span>
          <span style={{ fontSize: 10, color: '#64748B', background: '#1E293B', padding: '2px 6px', borderRadius: 4 }}>
            {analysis.engine ?? 'mock'}
          </span>
        </div>
        <div style={{
          padding: '4px 12px', borderRadius: 99, fontWeight: 800, fontSize: 18,
          background: scoreBg, color: scoreColor,
        }}>
          {score}<span style={{ fontSize: 11, fontWeight: 500 }}>/100</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', borderBottom: '1px solid #E2E8F0',
        background: '#F8FAFC',
      }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              padding: '9px 4px', fontSize: 11, fontWeight: 600,
              border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              borderBottom: tab === t.key ? '2px solid #2563EB' : '2px solid transparent',
              background: tab === t.key ? '#fff' : 'transparent',
              color: tab === t.key ? '#2563EB' : '#64748B',
            }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ padding: 16 }}>

        {/* ── RESUMO ── */}
        {tab === 'resumo' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {analysis.summary && (
              <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, margin: 0 }}>
                {analysis.summary}
              </p>
            )}

            {/* Quick pills row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {analysis.urgency && (
                <span style={{
                  padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                  background: analysis.urgency === 'alta' ? '#FEE2E2' : analysis.urgency === 'media' ? '#FEF3C7' : '#DCFCE7',
                  color: analysis.urgency === 'alta' ? '#DC2626' : analysis.urgency === 'media' ? '#D97706' : '#16A34A',
                }}>
                  Urgencia: {analysis.urgency}
                </span>
              )}
              {analysis.competitor && (
                <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: '#F5F3FF', color: '#7C3AED' }}>
                  Concorrente: {analysis.competitor}
                </span>
              )}
              {analysis.current_operator && (
                <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: '#EFF6FF', color: '#2563EB' }}>
                  Operador: {analysis.current_operator}
                </span>
              )}
              {analysis.sale_probability != null && (
                <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: '#F0FDF4', color: '#16A34A' }}>
                  Prob. venda: {Math.round(analysis.sale_probability)}%
                </span>
              )}
            </div>

            {/* Objections */}
            {Array.isArray(analysis.objections) && analysis.objections.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                  Objecoes
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {analysis.objections.map((o: string, i: number) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 8,
                      padding: '6px 10px', borderRadius: 7,
                      background: '#FEF2F2', border: '1px solid #FECACA',
                      fontSize: 12, color: '#7F1D1D',
                    }}>
                      <Target size={12} style={{ marginTop: 2, flexShrink: 0 }} />
                      {o}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Interests */}
            {Array.isArray(analysis.interests) && analysis.interests.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                  Interesses
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {analysis.interests.map((interest: string, i: number) => (
                    <span key={i} style={{
                      padding: '4px 10px', borderRadius: 6, fontSize: 12,
                      background: '#DCFCE7', color: '#14532D', fontWeight: 500,
                    }}>
                      {interest}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Emotions */}
            {analysis.emotions && (analysis.emotions.client || analysis.emotions.comercial) && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                  Emocoes
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {analysis.emotions.client && (
                    <div style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: '#F0F9FF', border: '1px solid #BAE6FD', fontSize: 12 }}>
                      <div style={{ fontWeight: 600, color: '#0369A1', marginBottom: 2, fontSize: 11 }}>Cliente</div>
                      {analysis.emotions.client}
                    </div>
                  )}
                  {analysis.emotions.comercial && (
                    <div style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: '#FFF7ED', border: '1px solid #FED7AA', fontSize: 12 }}>
                      <div style={{ fontWeight: 600, color: '#C2410C', marginBottom: 2, fontSize: 11 }}>Comercial</div>
                      {analysis.emotions.comercial}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Next action */}
            {analysis.next_action && (
              <div style={{
                padding: '10px 14px', borderRadius: 8,
                background: '#EFF6FF', border: '1px solid #BFDBFE',
                display: 'flex', gap: 8, alignItems: 'flex-start',
              }}>
                <Calendar size={14} color="#2563EB" style={{ marginTop: 1, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1E40AF', marginBottom: 2 }}>Proxima acao</div>
                  <div style={{ fontSize: 13, color: '#1E40AF' }}>{analysis.next_action}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TRANSCRICAO ── */}
        {tab === 'transcricao' && (
          <div>
            {analysis.transcript ? (
              <>
                <div style={{
                  fontSize: 13, color: '#374151', lineHeight: 1.8,
                  maxHeight: showFull ? 'none' : 200,
                  overflow: 'hidden', position: 'relative',
                }}>
                  {analysis.transcript}
                  {!showFull && (
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0, height: 60,
                      background: 'linear-gradient(transparent, #fff)',
                    }} />
                  )}
                </div>
                <button
                  onClick={() => setShowFull(v => !v)}
                  style={{
                    marginTop: 10, display: 'flex', alignItems: 'center', gap: 4,
                    background: 'none', border: 'none', color: '#2563EB',
                    fontSize: 12, cursor: 'pointer', fontWeight: 600,
                  }}
                >
                  {showFull ? <><ChevronUp size={14} /> Ver menos</> : <><ChevronDown size={14} /> Ver transcricao completa</>}
                </button>
              </>
            ) : (
              <div style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
                Transcricao nao disponivel
              </div>
            )}
          </div>
        )}

        {/* ── COMERCIAL ── */}
        {tab === 'comercial' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Talk ratio */}
            {analysis.talk_ratio_comercial != null && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  Racio de fala
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <div style={{
                    flex: analysis.talk_ratio_comercial, height: 10, borderRadius: 99,
                    background: '#2563EB',
                  }} />
                  <div style={{
                    flex: analysis.talk_ratio_client, height: 10, borderRadius: 99,
                    background: '#E2E8F0',
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: '#2563EB', fontWeight: 600 }}>Comercial {Math.round(analysis.talk_ratio_comercial)}%</span>
                  <span style={{ color: '#64748B' }}>Cliente {Math.round(analysis.talk_ratio_client)}%</span>
                </div>
              </div>
            )}

            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'Perguntas feitas', value: analysis.questions_count ?? 0 },
                { label: 'Prob. venda', value: `${Math.round(analysis.sale_probability ?? 0)}%` },
                { label: 'Score', value: `${analysis.score ?? 0}/100` },
              ].map(item => (
                <div key={item.label} style={{
                  padding: '10px 12px', borderRadius: 8,
                  background: '#F8FAFC', border: '1px solid #E2E8F0',
                }}>
                  <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 2 }}>{item.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A' }}>{item.value}</div>
                </div>
              ))}
            </div>

            {/* Arguments used */}
            {Array.isArray(analysis.arguments) && analysis.arguments.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                  Argumentos utilizados
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {analysis.arguments.map((a: string, i: number) => (
                    <span key={i} style={{
                      padding: '3px 8px', borderRadius: 6, fontSize: 11,
                      background: '#EFF6FF', color: '#2563EB', fontWeight: 500,
                    }}>
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Top words */}
            {Array.isArray(analysis.top_words) && analysis.top_words.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                  Palavras mais usadas
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {analysis.top_words.map((w: { word: string; count: number }, i: number) => (
                    <span key={i} style={{
                      padding: '3px 8px', borderRadius: 6, fontSize: 11,
                      background: '#F3F4F6', color: '#374151',
                    }}>
                      {w.word} <strong>×{w.count}</strong>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Loss reason */}
            {analysis.loss_reason && (
              <div style={{
                padding: '8px 12px', borderRadius: 8,
                background: '#FEF2F2', border: '1px solid #FECACA',
                fontSize: 12, color: '#7F1D1D',
              }}>
                <strong>Motivo perda:</strong> {analysis.loss_reason}
              </div>
            )}
          </div>
        )}

        {/* ── TREINADOR IA ── */}
        {tab === 'treinador' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'O que fez bem', value: analysis.coach_well, color: '#16A34A', bg: '#DCFCE7', border: '#BBF7D0', icon: <TrendingUp size={14} /> },
              { label: 'O que podia melhorar', value: analysis.coach_improve, color: '#D97706', bg: '#FEF3C7', border: '#FDE68A', icon: <MessageSquare size={14} /> },
              { label: 'Argumento recomendado', value: analysis.coach_argument, color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', icon: <Target size={14} /> },
              { label: 'Frase para aumentar conversao', value: analysis.coach_phrase, color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', icon: <Lightbulb size={14} /> },
            ].map(item => item.value ? (
              <div key={item.label} style={{
                padding: '12px 14px', borderRadius: 10,
                background: item.bg, border: `1px solid ${item.border}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: item.color, fontWeight: 700, fontSize: 12 }}>
                  {item.icon}
                  {item.label}
                </div>
                <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, fontStyle: item.label.includes('Frase') ? 'italic' : 'normal' }}>
                  {item.value}
                </div>
              </div>
            ) : null)}
          </div>
        )}

        {/* ── CHAT IA ── */}
        {tab === 'chat' && (
          <AIChat
            recordingId={recordingId ?? analysis.recording_id ?? ''}
            leadName={leadName ?? null}
            score={analysis.score ?? null}
            hasAnalysis={true}
          />
        )}
      </div>
    </div>
  )
}
