'use client'
import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Message = { role: 'user' | 'assistant'; content: string }

async function getCallerJwt(): Promise<string> {
  const sb = createClient()
  const { data: { session } } = await sb.auth.getSession()
  if (session?.access_token) return session.access_token
  const { data: refreshed } = await sb.auth.refreshSession()
  if (refreshed?.session?.access_token) return refreshed.session.access_token
  throw new Error('Sessao expirada. Faca login novamente.')
}

export default function IAChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Ola! Sou o assistente do SD Dialer. Posso ajudar-te a perceber como criar leads, distribuir chamadas, ver relatorios ou qualquer duvida sobre o sistema. Em que posso ajudar?' },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setError(null)
    const next = [...messages, { role: 'user' as const, content: text }]
    setMessages(next)
    setLoading(true)
    try {
      const jwt = await getCallerJwt()
      const res = await fetch('/api/ia/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ messages: next }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao contactar a IA')
      setMessages(m => [...m, { role: 'assistant', content: json.reply }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)' }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={20} color="#2563EB" /> Assistente SD Dialer
        </h1>
        <p style={{ color: '#64748B', fontSize: 14, margin: '3px 0 0' }}>Tira duvidas sobre como usar o sistema</p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 2px' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: m.role === 'user' ? '#EFF6FF' : '#2563EB',
              color: m.role === 'user' ? '#2563EB' : '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {m.role === 'user' ? <User size={16} /> : <Sparkles size={16} />}
            </div>
            <div style={{
              maxWidth: '75%', padding: '10px 14px', borderRadius: 14, fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap',
              background: m.role === 'user' ? '#2563EB' : '#F1F5F9',
              color: m.role === 'user' ? '#fff' : '#0F172A',
            }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={16} color="#fff" />
            </div>
            <div style={{ padding: '10px 14px', borderRadius: 14, background: '#F1F5F9', fontSize: 14, color: '#94A3B8' }}>A escrever...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div style={{ background: '#FEE2E2', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#991B1B', marginBottom: 10 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, paddingTop: 10, borderTop: '1px solid #E2E8F0' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Escreve a tua pergunta..."
          style={{ flex: 1, padding: '11px 14px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none' }}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 44, height: 44, borderRadius: 10, border: 'none',
            background: '#2563EB', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading || !input.trim() ? 0.6 : 1, flexShrink: 0,
          }}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  )
}
