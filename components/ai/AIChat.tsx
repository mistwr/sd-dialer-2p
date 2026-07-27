'use client'

/**
 * AIChat
 * Inline chat panel for discussing a specific call recording with the AI coach.
 * Works with mock engine (no external deps) and any OpenAI-compatible LLM.
 */

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { Send, Bot, User, Loader2, Sparkles, RotateCcw } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  recordingId: string
  leadName?: string | null
  score?: number | null
  hasAnalysis: boolean
}

const SUGGESTIONS = [
  'Como posso superar as objeções identificadas?',
  'Dá-me um script melhorado para o próximo contacto',
  'O que fiz bem nesta chamada?',
  'Como fechar melhor este tipo de cliente?',
]

export default function AIChat({ recordingId, leadName, score, hasAnalysis }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function sendMessage(content: string) {
    if (!content.trim() || loading) return

    const userMsg: Message = { role: 'user', content: content.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    setError(null)

    // Auto-resize textarea back to single line
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    try {
      const res = await fetch('/api/recordings/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recording_id: recordingId, messages: newMessages }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro na resposta')

      // Handle both streaming (future) and plain JSON (mock) responses
      const reply = json.reply ?? json.message ?? 'Sem resposta.'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro de ligação')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  function handleTextareaInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    // Auto-resize
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  function reset() {
    setMessages([])
    setError(null)
  }

  const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark')

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      borderRadius: 12, overflow: 'hidden',
      border: '1px solid #E2E8F0',
      background: '#F8FAFC',
      minHeight: 320,
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #E2E8F0',
        background: 'linear-gradient(135deg, #1E40AF 0%, #6D28D9 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles size={14} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>
              Coach IA
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>
              {leadName ? `Chamada com ${leadName}` : 'Analise esta chamada'}
              {score != null && ` · Score ${score}/100`}
            </div>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={reset}
            title="Nova conversa"
            style={{
              width: 28, height: 28, borderRadius: 6,
              background: 'rgba(255,255,255,0.15)',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <RotateCcw size={13} color="#fff" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '14px 16px',
        display: 'flex', flexDirection: 'column', gap: 12,
        maxHeight: 360,
      }}>
        {/* Welcome state */}
        {messages.length === 0 && (
          <div style={{ padding: '8px 0' }}>
            <div style={{
              display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 16,
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                background: 'linear-gradient(135deg, #1E40AF, #6D28D9)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Bot size={15} color="#fff" />
              </div>
              <div style={{
                background: '#fff', border: '1px solid #E2E8F0',
                borderRadius: '0 12px 12px 12px', padding: '10px 14px',
                fontSize: 13, color: '#374151', lineHeight: 1.6,
                maxWidth: 380,
              }}>
                {hasAnalysis
                  ? `Olá! Analisei a chamada${leadName ? ` com ${leadName}` : ''}. Posso ajudar-te a melhorar. O que queres explorar?`
                  : 'Para conversar sobre esta chamada precisas de a analisar primeiro. Usa o botão "Analisar IA" acima.'}
              </div>
            </div>

            {/* Suggestion chips */}
            {hasAnalysis && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginLeft: 40 }}>
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    style={{
                      padding: '5px 12px', borderRadius: 99,
                      border: '1px solid #BFDBFE', background: '#EFF6FF',
                      color: '#1D4ED8', fontSize: 12, fontWeight: 500,
                      cursor: 'pointer', textAlign: 'left', lineHeight: 1.4,
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = '#DBEAFE'
                      ;(e.currentTarget as HTMLElement).style.borderColor = '#93C5FD'
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = '#EFF6FF'
                      ;(e.currentTarget as HTMLElement).style.borderColor = '#BFDBFE'
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Conversation */}
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
              alignItems: 'flex-start',
              gap: 8,
            }}
          >
            {/* Avatar */}
            <div style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              background: msg.role === 'user'
                ? '#E0F2FE'
                : 'linear-gradient(135deg, #1E40AF, #6D28D9)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {msg.role === 'user'
                ? <User size={14} color="#0369A1" />
                : <Bot size={14} color="#fff" />}
            </div>

            {/* Bubble */}
            <div style={{
              maxWidth: '78%',
              background: msg.role === 'user' ? '#1D4ED8' : '#fff',
              color: msg.role === 'user' ? '#fff' : '#1F2937',
              borderRadius: msg.role === 'user'
                ? '12px 0 12px 12px'
                : '0 12px 12px 12px',
              padding: '9px 13px',
              fontSize: 13,
              lineHeight: 1.65,
              border: msg.role === 'assistant' ? '1px solid #E2E8F0' : 'none',
              whiteSpace: 'pre-wrap',
            }}>
              {/* Render bold markdown **text** */}
              {renderMarkdown(msg.content)}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              background: 'linear-gradient(135deg, #1E40AF, #6D28D9)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Bot size={14} color="#fff" />
            </div>
            <div style={{
              background: '#fff', border: '1px solid #E2E8F0',
              borderRadius: '0 12px 12px 12px', padding: '12px 14px',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Loader2 size={14} color="#6D28D9" style={{ animation: 'spin 0.75s linear infinite' }} />
              <span style={{ fontSize: 12, color: '#6B7280' }}>A pensar...</span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            padding: '8px 12px', borderRadius: 8,
            background: '#FEE2E2', border: '1px solid #FECACA',
            fontSize: 12, color: '#DC2626',
          }}>
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '10px 12px',
        borderTop: '1px solid #E2E8F0',
        background: '#fff',
        display: 'flex', alignItems: 'flex-end', gap: 8,
      }}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleTextareaInput}
          onKeyDown={handleKeyDown}
          placeholder={hasAnalysis ? 'Pergunta ao coach IA...' : 'Analisa a chamada primeiro para usar o chat'}
          disabled={loading || !hasAnalysis}
          rows={1}
          style={{
            flex: 1, resize: 'none', border: '1px solid #E2E8F0',
            borderRadius: 10, padding: '8px 12px',
            fontSize: 13, lineHeight: 1.5,
            outline: 'none', background: '#F8FAFC',
            color: '#1F2937', fontFamily: 'inherit',
            transition: 'border-color 0.15s',
            minHeight: 36, maxHeight: 120,
          }}
          onFocus={e => { e.currentTarget.style.borderColor = '#6D28D9' }}
          onBlur={e => { e.currentTarget.style.borderColor = '#E2E8F0' }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim() || !hasAnalysis}
          style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: loading || !input.trim() || !hasAnalysis
              ? '#E2E8F0'
              : 'linear-gradient(135deg, #1E40AF, #6D28D9)',
            border: 'none', cursor: loading || !input.trim() || !hasAnalysis ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}
        >
          <Send size={15} color={loading || !input.trim() || !hasAnalysis ? '#94A3B8' : '#fff'} />
        </button>
      </div>
    </div>
  )
}

// Minimal markdown renderer: **bold** and line breaks
function renderMarkdown(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  const lines = text.split('\n')
  lines.forEach((line, li) => {
    if (li > 0) parts.push(<br key={`br-${li}`} />)
    const segments = line.split(/(\*\*[^*]+\*\*)/)
    segments.forEach((seg, si) => {
      if (seg.startsWith('**') && seg.endsWith('**')) {
        parts.push(<strong key={`b-${li}-${si}`}>{seg.slice(2, -2)}</strong>)
      } else {
        parts.push(<span key={`t-${li}-${si}`}>{seg}</span>)
      }
    })
  })
  return <>{parts}</>
}
