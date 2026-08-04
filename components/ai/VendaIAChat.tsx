'use client'
import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Brain, ShoppingCart, HelpCircle } from 'lucide-react'

interface VendaContexto {
  operador?: string
  comercializador?: string
  servicos?: Record<string, boolean>
  mensalidade?: string
  satisfacao?: number
  problemas?: string[]
  tipo?: 'telecom' | 'energia' | 'ambos'
  lead_nome?: string
  lead_telefone?: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export default function VendaIAChat({ contexto }: { contexto: VendaContexto }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [userInput, setUserInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [scriptGerado, setScriptGerado] = useState('')
  const [mostraScript, setMostraScript] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const gerarScriptInicial = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/ai/venda-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contexto,
          tipo_pedido: 'script_inicial',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setScriptGerado(data.script)
      const mensagem: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: data.script || 'Script gerado com sucesso!',
        timestamp: new Date(),
      }
      setMessages([mensagem])
      setMostraScript(true)
    } catch (err: any) {
      alert('Erro ao gerar script: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const enviarMensagem = async () => {
    if (!userInput.trim() || loading) return

    const novaMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: userInput,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, novaMsg])
    setUserInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/ai/venda-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contexto,
          tipo_pedido: 'chat',
          pergunta: userInput,
          historico: messages,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      const assistMsg: ChatMessage = {
        id: `msg-${Date.now()}-2`,
        role: 'assistant',
        content: data.resposta,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, assistMsg])
    } catch (err: any) {
      alert('Erro: ' + err.message)
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: 600 }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px', borderBottom: '1px solid #E2E8F0',
        background: '#F8FAFC', display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <Brain size={18} color="#6366F1" />
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>IA de Vendas</div>
          <div style={{ fontSize: 11, color: '#64748B' }}>
            Script personalizado para {contexto.operador || contexto.comercializador || 'esta lead'}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {messages.length === 0 && !loading ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '100%', textAlign: 'center', color: '#64748B', fontSize: 13,
          }}>
            <ShoppingCart size={32} color="#D1D5DB" style={{ marginBottom: 10 }} />
            <p>Clica para gerar um script personalizado de venda</p>
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} style={{
              display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}>
              <div style={{
                maxWidth: '85%', padding: '10px 14px', borderRadius: 12,
                background: msg.role === 'user' ? '#2563EB' : '#F1F5F9',
                color: msg.role === 'user' ? '#fff' : '#0F172A',
                fontSize: 13, lineHeight: 1.6, wordBreak: 'break-word',
              }}>
                {msg.content}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748B', fontSize: 12 }}>
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            IA a pensar...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '12px 16px', borderTop: '1px solid #E2E8F0',
        background: '#F8FAFC', display: 'flex', gap: 8,
      }}>
        {messages.length === 0 ? (
          <button
            onClick={gerarScriptInicial}
            disabled={loading}
            style={{
              flex: 1, padding: '12px', borderRadius: 10, border: 'none',
              background: '#6366F1', color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {loading ? (
              <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Gerando...</>
            ) : (
              <><Brain size={14} /> Gerar Script</>
            )}
          </button>
        ) : (
          <>
            <input
              type="text"
              placeholder="Faz uma pergunta sobre objeções, argumentos..."
              value={userInput}
              onChange={e => setUserInput(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && enviarMensagem()}
              disabled={loading}
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid #E2E8F0',
                fontSize: 12, outline: 'none', boxSizing: 'border-box',
              }}
            />
            <button
              onClick={enviarMensagem}
              disabled={loading || !userInput.trim()}
              style={{
                width: 36, height: 36, borderRadius: 10, border: 'none',
                background: userInput.trim() && !loading ? '#6366F1' : '#D1D5DB',
                cursor: userInput.trim() && !loading ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Send size={14} color="#fff" />
            </button>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
