'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Bot, PhoneCall, ShoppingBag, Users, UserPlus, AudioLines, Send, RefreshCw, Sparkles, Lock } from 'lucide-react'
import { PageSpinner } from '@/components/ui/Spinner'
import { StatCard } from '@/components/ui/StatCard'

type Msg = { role: 'user' | 'assistant'; content: string }

const SUGESTOES = [
  'Como está a equipa esta semana?',
  'Onde estamos a perder vendas?',
  'Que leads devíamos trabalhar hoje?',
  'Quem precisa de apoio na equipa?',
]

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return <>{parts.map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p.replace(/\*\*/g, '')}</span>))}</>
}

function Markdown({ text }: { text: string }) {
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      {text.replace(/\r/g, '').split('\n').map((line, i) => {
        const t = line.trim()
        if (!t) return <div key={i} style={{ height: 4 }} />
        const b = t.match(/^[-*•]\s+(.*)$/) || t.match(/^\d+[.)]\s+(.*)$/)
        if (b) return <div key={i} style={{ display: 'flex', gap: 8 }}><span style={{ color: '#2563EB' }}>•</span><span><Inline text={b[1]} /></span></div>
        const h = t.match(/^#{1,4}\s+(.*)$/)
        if (h) return <div key={i} style={{ fontWeight: 700, marginTop: 4 }}><Inline text={h[1]} /></div>
        return <div key={i}><Inline text={t} /></div>
      })}
    </div>
  )
}

const nf = (n: number) => new Intl.NumberFormat('pt-PT').format(Number(n || 0))
const card: CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }

export default function ComandoPage() {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const r = await fetch('/api/sd-dialer/comando', { cache: 'no-store' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d?.error || 'Não foi possível carregar.')
      setData(d)
    } catch (e: any) { setError(e?.message || 'Erro.') } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    load()
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('ativado')) {
      const t = setInterval(load, 4000)
      setTimeout(() => clearInterval(t), 40000)
      return () => clearInterval(t)
    }
  }, [load])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, thinking])

  async function ask(text: string) {
    const q = text.trim()
    if (!q || thinking) return
    const next: Msg[] = [...messages, { role: 'user', content: q }]
    setMessages(next); setInput(''); setThinking(true)
    try {
      const r = await fetch('/api/sd-dialer/comando', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: q, messages }) })
      const d = await r.json().catch(() => ({}))
      setMessages([...next, { role: 'assistant', content: r.ok ? d.reply : d?.error || 'Sem resposta.' }])
    } catch { setMessages([...next, { role: 'assistant', content: 'Falhou a ligação.' }]) } finally { setThinking(false) }
  }

  if (loading && !data) return <PageSpinner />
  if (error) return <div style={{ ...card, color: '#B91C1C' }}>{error}</div>

  if (data?.locked) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', display: 'grid', gap: 16 }}>
        <div style={{ ...card, padding: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#2563EB', fontWeight: 700, fontSize: 13, letterSpacing: '.08em' }}><Sparkles size={18} /> ADD-ON · {data.preco}</div>
          <h1 style={{ fontSize: 30, fontWeight: 800, margin: '10px 0 6px' }}>Comando IA para a {data.empresa}</h1>
          <p style={{ color: '#475569', fontSize: 16, lineHeight: 1.6 }}>Um assistente que conhece os números da tua equipa e responde em segundos: como estão as vendas, que leads trabalhar hoje, quem precisa de apoio e onde estás a perder negócio.</p>
          <ul style={{ color: '#334155', lineHeight: 2, paddingLeft: 18, margin: '14px 0 22px' }}>
            <li>Painel do dia: leads, vendas, equipa e chamadas IA num ecrã</li>
            <li>Pergunta em português e recebe a resposta com a próxima ação</li>
            <li>Só vê os dados da tua empresa · cancelas quando quiseres</li>
          </ul>
          <a href={data.checkoutUrl} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#2563EB', color: '#fff', padding: '12px 22px', borderRadius: 999, fontWeight: 700, textDecoration: 'none' }}><Lock size={16} /> Ativar Comando IA · {data.preco}</a>
          <p style={{ color: '#94A3B8', fontSize: 13, marginTop: 12 }}>Fica ativo logo após o pagamento. Dúvidas? <a href="https://wa.me/351968677320?text=Quero%20saber%20mais%20sobre%20o%20Comando%20IA%20do%20SD%20Dialer" style={{ color: '#2563EB' }}>Fala connosco</a>.</p>
        </div>
      </div>
    )
  }

  const d = data?.dados || {}
  const leads = d.leads || {}, vendas = d.vendas30d || {}, calls = d.chamadasIA30d || {}, equipa = d.equipa || {}
  const totalEquipa = Object.values(equipa).reduce((a: number, b: any) => a + Number(b || 0), 0) as number

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Comando IA</h1>
          <p style={{ color: '#64748B', margin: '4px 0 0' }}>{d.empresa?.nome} · o dia da tua equipa num ecrã</p>
        </div>
        <button onClick={load} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #E2E8F0', background: '#fff', borderRadius: 999, padding: '8px 14px', cursor: 'pointer' }}><RefreshCw size={14} /> Atualizar</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <StatCard label="Vendas (30 dias)" value={nf(vendas.total)} icon={ShoppingBag} color="#16A34A" sub={Object.entries(vendas.porEstado || {}).map(([k, v]) => `${k}: ${v}`).join(' · ')} />
        <StatCard label="Leads novas (7 dias)" value={nf(leads.novas7d)} icon={UserPlus} color="#2563EB" sub={`${nf(leads.novas30d)} em 30 dias`} />
        <StatCard label="Leads trabalhadas (7 dias)" value={nf(leads.trabalhadas7d)} icon={PhoneCall} color="#9333EA" sub={`${nf(leads.semAtribuir)} novas sem comercial`} />
        <StatCard label="Equipa ativa" value={nf(totalEquipa)} icon={Users} color="#EA580C" sub={Object.entries(equipa).map(([k, v]) => `${k}: ${v}`).join(' · ')} />
        <StatCard label="Chamadas IA (30 dias)" value={nf(calls.total)} icon={AudioLines} color="#0891B2" sub={`${nf((calls.porEstado || {}).answered || 0)} atendidas · média ${calls.duracaoMediaSeg || 0}s`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Ranking de vendas (30 dias)</div>
          {(vendas.ranking || []).length ? (vendas.ranking as any[]).map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #F1F5F9' }}><span>{i + 1}. {r.nome}</span><strong>{r.vendas}</strong></div>
          )) : <div style={{ color: '#94A3B8' }}>Ainda sem vendas registadas.</div>}
        </div>
        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Estado das leads</div>
          {Object.entries(leads.porEstado || {}).slice(0, 8).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #F1F5F9' }}><span>{k.replace(/_/g, ' ')}</span><strong>{nf(v as number)}</strong></div>
          ))}
        </div>
      </div>

      <div style={{ ...card, borderColor: '#BFDBFE' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}><Bot size={18} color="#2563EB" /> Pergunta ao Comando</div>
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {messages.map((m, i) => (
            <div key={i} style={m.role === 'user'
              ? { marginLeft: 'auto', maxWidth: '85%', background: '#EFF6FF', borderRadius: 14, padding: '8px 14px' }
              : { maxWidth: '92%', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 14, padding: '10px 14px', lineHeight: 1.55 }}>
              {m.role === 'assistant' ? <Markdown text={m.content} /> : m.content}
            </div>
          ))}
          {thinking && <div style={{ color: '#64748B' }}>A analisar…</div>}
          <div ref={endRef} />
        </div>
        {!messages.length && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {SUGESTOES.map(s => <button key={s} onClick={() => ask(s)} style={{ border: '1px solid #CBD5E1', background: '#fff', borderRadius: 999, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>{s}</button>)}
          </div>
        )}
        <form onSubmit={e => { e.preventDefault(); ask(input) }} style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ex.: quem vendeu mais esta semana?" style={{ flex: 1, border: '1px solid #CBD5E1', borderRadius: 999, padding: '10px 16px', outline: 'none' }} />
          <button disabled={thinking || !input.trim()} style={{ background: '#2563EB', color: '#fff', border: 0, borderRadius: 999, padding: '0 16px', cursor: 'pointer', opacity: thinking || !input.trim() ? 0.5 : 1 }}><Send size={16} /></button>
        </form>
      </div>
    </div>
  )
}
