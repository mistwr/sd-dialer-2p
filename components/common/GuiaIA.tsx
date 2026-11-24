'use client'

import { useEffect, useRef, useState } from 'react'
import { Sparkles, X, Send } from 'lucide-react'

type Msg = { role: 'user' | 'assistant'; content: string }

const SUGESTOES = [
  'Por onde começo hoje?',
  'Como faço a minha primeira chamada?',
  'Como respondo a "já tenho contrato"?',
  'Explica-me a venda do início ao fim',
]

function Inline({ text }: { text: string }) {
  return <>{text.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p.replace(/\*\*/g, '')}</span>))}</>
}

function Texto({ text }: { text: string }) {
  return (
    <div style={{ display: 'grid', gap: 3 }}>
      {text.replace(/\r/g, '').split('\n').map((line, i) => {
        const t = line.trim()
        if (!t) return <div key={i} style={{ height: 3 }} />
        const b = t.match(/^[-*•]\s+(.*)$/) || t.match(/^\d+[.)]\s+(.*)$/)
        if (b) return <div key={i} style={{ display: 'flex', gap: 8 }}><span style={{ color: '#2563EB' }}>•</span><span><Inline text={b[1]} /></span></div>
        return <div key={i}><Inline text={t.replace(/^#{1,4}\s+/, '')} /></div>
      })}
    </div>
  )
}

export default function GuiaIA({ userId, verComo }: { userId?: string | null; verComo?: string }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const started = useRef(false)

  async function send(text: string, primeiraVez = false, base: Msg[] = messages) {
    const q = text.trim()
    if (!q || thinking) return
    const next: Msg[] = primeiraVez ? base : [...base, { role: 'user', content: q }]
    setMessages(next); setInput(''); setThinking(true)
    try {
      const r = await fetch('/api/sd-dialer/guia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: q, messages: base, primeiraVez, verComo }) })
      const d = await r.json().catch(() => ({}))
      setMessages([...next, { role: 'assistant', content: r.ok ? d.reply : d?.error || 'Sem resposta agora.' }])
    } catch { setMessages([...next, { role: 'assistant', content: 'Falhou a ligação. Tenta outra vez.' }]) } finally { setThinking(false) }
  }

  // Primeiro acesso: abre sozinho uma vez e apresenta-se.
  useEffect(() => {
    if (!userId || started.current) return
    let visto = true
    try { visto = localStorage.getItem(`guia-ia-visto-${userId}`) === '1' } catch { /* sem storage */ }
    if (!visto) {
      started.current = true
      try { localStorage.setItem(`guia-ia-visto-${userId}`, '1') } catch { /* sem storage */ }
      setOpen(true)
      void send('Acabei de entrar no SD Dialer pela primeira vez. Apresenta-te e diz-me por onde começar.', true, [])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, thinking, open])

  if (!userId) return null

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} aria-label="Abrir o Guia IA" title="Guia IA — pergunta-me o que quiseres"
          style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 60, display: 'inline-flex', alignItems: 'center', gap: 8, background: '#2563EB', color: '#fff', border: 0, borderRadius: 999, padding: '12px 18px', fontWeight: 700, boxShadow: '0 8px 24px rgba(37,99,235,.35)', cursor: 'pointer' }}>
          <Sparkles size={18} /> Guia IA
        </button>
      )}
      {open && (
        <div role="dialog" aria-label="Guia IA" style={{ position: 'fixed', right: 12, bottom: 12, zIndex: 70, width: 'min(400px, calc(100vw - 24px))', height: 'min(560px, calc(100vh - 24px))', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, boxShadow: '0 20px 50px rgba(15,23,42,.25)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#2563EB', color: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800 }}><Sparkles size={18} /> Guia IA <span style={{ fontWeight: 500, fontSize: 12, opacity: .85 }}>sempre pronto a ajudar</span></div>
            <button onClick={() => setOpen(false)} aria-label="Fechar" style={{ background: 'none', border: 0, color: '#fff', cursor: 'pointer' }}><X size={18} /></button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'grid', alignContent: 'start', gap: 10, background: '#F8FAFC' }}>
            {!messages.length && !thinking && <div style={{ color: '#475569' }}>Olá! Sou o Guia IA. Explico como usar o SD Dialer e ensino a vender, do primeiro contacto ao fecho. Pergunta o que quiseres.</div>}
            {messages.map((m, i) => (
              <div key={i} style={m.role === 'user'
                ? { marginLeft: 'auto', maxWidth: '85%', background: '#DBEAFE', borderRadius: 14, padding: '8px 12px' }
                : { maxWidth: '95%', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: '10px 12px', lineHeight: 1.5, fontSize: 14 }}>
                {m.role === 'assistant' ? <Texto text={m.content} /> : m.content}
              </div>
            ))}
            {thinking && <div style={{ color: '#64748B', fontSize: 14 }}>A pensar…</div>}
            {!messages.length && !thinking && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {SUGESTOES.map(s => <button key={s} onClick={() => void send(s)} style={{ border: '1px solid #CBD5E1', background: '#fff', borderRadius: 999, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>{s}</button>)}
              </div>
            )}
            <div ref={endRef} />
          </div>
          <form onSubmit={e => { e.preventDefault(); void send(input) }} style={{ display: 'flex', gap: 8, padding: 10, borderTop: '1px solid #E2E8F0' }}>
            <input value={input} onChange={e => setInput(e.target.value)} placeholder="Pergunta ao Guia IA…" style={{ flex: 1, border: '1px solid #CBD5E1', borderRadius: 999, padding: '10px 14px', outline: 'none' }} />
            <button disabled={thinking || !input.trim()} aria-label="Enviar" style={{ background: '#2563EB', color: '#fff', border: 0, borderRadius: 999, padding: '0 14px', cursor: 'pointer', opacity: thinking || !input.trim() ? .5 : 1 }}><Send size={16} /></button>
          </form>
        </div>
      )}
    </>
  )
}
