'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import useSWR from 'swr'
import { Send, Plus, ArrowLeft, MessageCircle, Users, X, Search } from 'lucide-react'
import { chatService, usuarioService } from '@/lib/services'
import { useAuth } from '@/lib/hooks/useAuth'
import { PageSpinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Conversa, Mensagem, Usuario } from '@/lib/types'

function initials(name?: string | null) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function Avatar({ name, size = 38 }: { name?: string | null; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: '#2563EB', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35,
      fontWeight: 700, flexShrink: 0,
    }}>
      {initials(name)}
    </div>
  )
}

function conversaTitulo(conversa: Conversa, myId: string) {
  if (conversa.tipo === 'grupo') return conversa.nome ?? 'Grupo'
  const outro = conversa.participantes?.find(p => p.id !== myId)
  return outro?.full_name ?? 'Conversa'
}

export default function ChatPage() {
  const { user, profile } = useAuth()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showNewChat, setShowNewChat] = useState(false)
  const [search, setSearch] = useState('')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [messages, setMessages] = useState<Mensagem[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data: conversas = [], isLoading: loadingConversas, mutate: mutateConversas } = useSWR(
    user?.id ? ['conversas', user.id] : null,
    () => chatService.getConversas(user!.id),
    { refreshInterval: 15000 }
  )
  const { data: colegas = [] } = useSWR(
    profile?.company_id ? ['colegas', profile.company_id] : null,
    () => usuarioService.getByCompany(profile!.company_id!)
  )

  const activeConversa = conversas.find(c => c.id === activeId)

  // Carrega mensagens + subscreve em tempo real quando a conversa ativa muda
  useEffect(() => {
    if (!activeId || !user?.id) return
    let unsubscribed = false
    chatService.getMensagens(activeId).then(msgs => { if (!unsubscribed) setMessages(msgs) })
    chatService.markAsRead(activeId, user.id).then(() => mutateConversas())

    const unsubscribe = chatService.subscribeToConversa(activeId, (msg) => {
      setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
      if (msg.usuario_id !== user.id) chatService.markAsRead(activeId, user.id).then(() => mutateConversas())
    })
    return () => { unsubscribed = true; unsubscribe() }
  }, [activeId, user?.id])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const handleSend = useCallback(async () => {
    if (!text.trim() || !activeId || !user?.id || sending) return
    setSending(true)
    const content = text.trim()
    setText('')
    try {
      await chatService.sendMensagem(activeId, user.id, content)
    } finally {
      setSending(false)
    }
  }, [text, activeId, user?.id, sending])

  const startDirectChat = async (otherUserId: string) => {
    if (!profile?.company_id || !user?.id) return
    const conversa = await chatService.getOrCreateDirectConversa(profile.company_id, user.id, otherUserId)
    setShowNewChat(false)
    await mutateConversas()
    setActiveId(conversa.id)
  }

  const filteredColegas = colegas.filter(c => c.id !== user?.id && c.full_name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 100px)', maxHeight: 720, border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden', background: '#fff' }}>
      {/* Lista de conversas */}
      <div className={activeId ? 'chat-list-mobile-hidden' : ''} style={{ width: 300, flexShrink: 0, borderRight: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9' }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', margin: 0 }}>Mensagens</h2>
          <button onClick={() => setShowNewChat(true)} style={{ background: '#2563EB', border: 'none', borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Plus size={16} color="#fff" />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loadingConversas ? <PageSpinner /> : conversas.length === 0 ? (
            <EmptyState icon={MessageCircle} title="Sem conversas" description="Toca no + para começares uma conversa." />
          ) : conversas.map(c => (
            <button key={c.id} onClick={() => setActiveId(c.id)} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 16px',
              border: 'none', borderBottom: '1px solid #F8FAFC', background: activeId === c.id ? '#EFF6FF' : 'transparent',
              cursor: 'pointer', textAlign: 'left',
            }}>
              {c.tipo === 'grupo'
                ? <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Users size={16} color="#64748B" /></div>
                : <Avatar name={conversaTitulo(c, user?.id ?? '')} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {conversaTitulo(c, user?.id ?? '')}
                </div>
                <div style={{ fontSize: 12, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.ultima_mensagem?.conteudo ?? 'Sem mensagens ainda'}
                </div>
              </div>
              {!!c.nao_lidas && (
                <div style={{ minWidth: 18, height: 18, borderRadius: 9, background: '#DC2626', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>
                  {c.nao_lidas}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Thread */}
      <div className={activeId ? '' : 'chat-thread-mobile-hidden'} style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {!activeConversa ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <EmptyState icon={MessageCircle} title="Escolhe uma conversa" description="Ou inicia uma nova pelo botão +." />
          </div>
        ) : (
          <>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => setActiveId(null)} className="chat-back-btn" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'none', padding: 4 }}>
                <ArrowLeft size={18} color="#0F172A" />
              </button>
              <Avatar name={conversaTitulo(activeConversa, user?.id ?? '')} size={32} />
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{conversaTitulo(activeConversa, user?.id ?? '')}</div>
            </div>

            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {messages.map(m => {
                const mine = m.usuario_id === user?.id
                return (
                  <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                    <div style={{ maxWidth: '72%' }}>
                      {!mine && <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2, marginLeft: 4 }}>{m.usuario?.full_name}</div>}
                      <div style={{
                        padding: '9px 13px', borderRadius: mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                        background: mine ? '#2563EB' : '#F1F5F9', color: mine ? '#fff' : '#0F172A',
                        fontSize: 14, lineHeight: 1.4, wordBreak: 'break-word',
                      }}>
                        {m.conteudo}
                      </div>
                      <div style={{ fontSize: 10, color: '#CBD5E1', marginTop: 2, textAlign: mine ? 'right' : 'left' }}>
                        {new Date(m.created_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ padding: 14, borderTop: '1px solid #F1F5F9', display: 'flex', gap: 8 }}>
              <input
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                placeholder="Escreve uma mensagem..."
                style={{ flex: 1, padding: '11px 14px', borderRadius: 999, border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none' }}
              />
              <button onClick={handleSend} disabled={!text.trim() || sending} style={{
                width: 40, height: 40, borderRadius: '50%', border: 'none', flexShrink: 0,
                background: text.trim() ? '#2563EB' : '#E2E8F0', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: text.trim() ? 'pointer' : 'default',
              }}>
                <Send size={16} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Nova conversa modal */}
      {showNewChat && (
        <div onClick={() => setShowNewChat(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 380, maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: 16, borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>Nova conversa</div>
              <button onClick={() => setShowNewChat(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} color="#64748B" /></button>
            </div>
            <div style={{ padding: 12 }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar colega..." style={{ width: '100%', padding: '9px 12px 9px 32px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
              {filteredColegas.map((c: Usuario) => (
                <button key={c.id} onClick={() => startDirectChat(c.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 8px',
                  border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', borderRadius: 10,
                }}>
                  <Avatar name={c.full_name} size={32} />
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0F172A' }}>{c.full_name}</div>
                    <div style={{ fontSize: 11.5, color: '#94A3B8', textTransform: 'capitalize' }}>{c.role}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 720px) {
          .chat-list-mobile-hidden { display: none !important; }
          .chat-thread-mobile-hidden { display: none !important; }
          .chat-back-btn { display: flex !important; }
        }
      `}</style>
    </div>
  )
}
