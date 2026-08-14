'use client'
import { useState, useMemo } from 'react'
import { MessageSquare, Send, Users, ChevronRight, CheckCircle2, Layers, User } from 'lucide-react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { PageSpinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'

interface LeadContact {
  id: string
  nome: string
  telefone: string
}

async function fetchLeads(userId: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('leads')
    .select('id, nome, telefone')
    .eq('assigned_to', userId)
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw error
  return (data ?? []) as LeadContact[]
}

function normalizePhone(raw: string) {
  const digits = raw.replace(/[^\d]/g, '')
  if (digits.length === 9) return `+351${digits}`
  if (digits.startsWith('351')) return `+${digits}`
  return `+${digits}`
}

export default function SmsMassaPage() {
  const { user, loading: authLoading } = useAuth()
  const { data: leads = [], isLoading } = useSWR(user?.id ? ['sms-leads', user.id] : null, () => fetchLeads(user!.id))

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState('')
  const [mode, setMode] = useState<'generica' | 'personalizada'>('generica')
  const [batchSize, setBatchSize] = useState(20)
  const [step, setStep] = useState<'compor' | 'enviar'>('compor')
  const [progress, setProgress] = useState(0)

  const selectableLeads = useMemo(() => leads.filter(l => l.telefone), [leads])
  const allSelected = selectableLeads.length > 0 && selectableLeads.every(l => selected.has(l.id))
  const selectedLeads = useMemo(() => leads.filter(l => selected.has(l.id) && l.telefone), [leads, selected])

  const toggleAll = () => {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(selectableLeads.map(l => l.id)))
  }
  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Modo generico: agrupa TODOS os numeros do lote no mesmo link (mensagem igual para todos, sem {nome})
  const genericBatches = useMemo(() => {
    if (mode !== 'generica') return []
    const phones = selectedLeads.map(l => normalizePhone(l.telefone))
    const batches: string[][] = []
    for (let i = 0; i < phones.length; i += batchSize) batches.push(phones.slice(i, i + batchSize))
    return batches.map(group => ({
      numbers: group,
      url: `sms:${group.join(',')}?body=${encodeURIComponent(message)}`,
    }))
  }, [mode, selectedLeads, batchSize, message])

  // Modo personalizado: um link por pessoa, com {nome} substituido
  const personalLinks = useMemo(() => {
    if (mode !== 'personalizada') return []
    return selectedLeads.map(l => ({
      id: l.id,
      nome: l.nome,
      telefone: normalizePhone(l.telefone),
      url: `sms:${normalizePhone(l.telefone)}?body=${encodeURIComponent(message.replace(/\{nome\}/gi, l.nome || 'Cliente'))}`,
    }))
  }, [mode, selectedLeads, message])

  if (authLoading || isLoading) return <PageSpinner />

  return (
    <div className="anim-fade-in" style={{ maxWidth: 640 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <MessageSquare size={20} /> SMS em Massa
        </h1>
        <p style={{ fontSize: 13, color: '#64748B', margin: '4px 0 0' }}>Envia SMS às tuas leads usando a app de mensagens do telemóvel</p>
      </div>

      {step === 'compor' && (
        <>
          {/* Modo */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            <button onClick={() => setMode('generica')} style={{
              flex: 1, padding: '12px', borderRadius: 12, border: `1.5px solid ${mode === 'generica' ? '#2563EB' : '#E2E8F0'}`,
              background: mode === 'generica' ? '#EFF6FF' : '#fff', cursor: 'pointer', textAlign: 'left',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: mode === 'generica' ? '#2563EB' : '#0F172A' }}>
                <Layers size={14} /> Mensagem Geral
              </div>
              <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 3 }}>Mesma mensagem para todos, em lotes — menos toques</div>
            </button>
            <button onClick={() => setMode('personalizada')} style={{
              flex: 1, padding: '12px', borderRadius: 12, border: `1.5px solid ${mode === 'personalizada' ? '#2563EB' : '#E2E8F0'}`,
              background: mode === 'personalizada' ? '#EFF6FF' : '#fff', cursor: 'pointer', textAlign: 'left',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: mode === 'personalizada' ? '#2563EB' : '#0F172A' }}>
                <User size={14} /> Personalizada
              </div>
              <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 3 }}>Com {'{nome}'} — um toque por pessoa</div>
            </button>
          </div>

          {/* Mensagem */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Mensagem</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={3}
              placeholder={mode === 'personalizada' ? 'Ola {nome}, temos uma proposta especial para ti!' : 'Ola, temos uma proposta especial para ti!'}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 14, boxSizing: 'border-box', outline: 'none', resize: 'vertical' }}
            />
            {mode === 'personalizada' && (
              <p style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 4 }}>Usa <code style={{ background: '#F1F5F9', padding: '1px 5px', borderRadius: 4 }}>{'{nome}'}</code> para inserir o nome de cada lead automaticamente.</p>
            )}
          </div>

          {mode === 'generica' && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Tamanho do lote</label>
              <select value={batchSize} onChange={e => setBatchSize(Number(e.target.value))}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', background: '#fff' }}>
                {[5, 10, 20, 30, 50].map(n => <option key={n} value={n}>{n} por lote</option>)}
              </select>
            </div>
          )}

          {/* Seleção de leads */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Destinatários ({selected.size})</label>
              <button onClick={toggleAll} style={{ fontSize: 12.5, color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                {allSelected ? 'Limpar seleção' : 'Selecionar todos'}
              </button>
            </div>
            {leads.length === 0 ? (
              <EmptyState icon={Users} title="Sem leads" description="Não tens leads atribuídas ainda." />
            ) : (
              <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: 10 }}>
                {leads.map(l => (
                  <label key={l.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                    borderBottom: '1px solid #F1F5F9', cursor: l.telefone ? 'pointer' : 'not-allowed', opacity: l.telefone ? 1 : 0.4,
                  }}>
                    <input type="checkbox" checked={selected.has(l.id)} disabled={!l.telefone} onChange={() => toggle(l.id)} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{l.nome}</div>
                      <div style={{ fontSize: 11.5, color: '#94A3B8' }}>{l.telefone || 'Sem telefone'}</div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => { setProgress(0); setStep('enviar') }}
            disabled={!message.trim() || selectedLeads.length === 0}
            style={{
              width: '100%', padding: '13px', borderRadius: 10, border: 'none',
              background: '#2563EB', color: '#fff', fontWeight: 700, fontSize: 14,
              cursor: (!message.trim() || selectedLeads.length === 0) ? 'not-allowed' : 'pointer',
              opacity: (!message.trim() || selectedLeads.length === 0) ? 0.5 : 1,
            }}
          >
            Gerar SMS para {selectedLeads.length} contacto{selectedLeads.length !== 1 ? 's' : ''}
          </button>
        </>
      )}

      {step === 'enviar' && (
        <div>
          <button onClick={() => setStep('compor')} style={{ fontSize: 12.5, color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, marginBottom: 14 }}>
            ← Voltar a editar
          </button>

          {mode === 'generica' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 12.5, color: '#64748B', marginBottom: 4 }}>
                {genericBatches.length} lote{genericBatches.length !== 1 ? 's' : ''} — abre cada um e carrega em "Enviar" na app de SMS (envia a todo o lote de uma vez).
              </p>
              {genericBatches.map((b, i) => (
                <a key={i} href={b.url} onClick={() => setProgress(p => Math.max(p, i + 1))} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                  background: progress > i ? '#F0FDF4' : '#fff', border: `1.5px solid ${progress > i ? '#BBF7D0' : '#E2E8F0'}`,
                  borderRadius: 12, textDecoration: 'none',
                }}>
                  {progress > i ? <CheckCircle2 size={17} color="#16A34A" /> : <MessageSquare size={17} color="#2563EB" />}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Lote {i + 1}</div>
                    <div style={{ fontSize: 11.5, color: '#94A3B8' }}>{b.numbers.length} números</div>
                  </div>
                  <ChevronRight size={15} color="#CBD5E1" />
                </a>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ fontSize: 12.5, color: '#64748B', marginBottom: 4 }}>
                {personalLinks.length} mensagens personalizadas — abre uma de cada vez e carrega em "Enviar".
              </p>
              {personalLinks.map((l, i) => (
                <a key={l.id} href={l.url} onClick={() => setProgress(p => Math.max(p, i + 1))} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
                  background: progress > i ? '#F0FDF4' : '#fff', border: `1.5px solid ${progress > i ? '#BBF7D0' : '#E2E8F0'}`,
                  borderRadius: 12, textDecoration: 'none',
                }}>
                  {progress > i ? <CheckCircle2 size={16} color="#16A34A" /> : <User size={16} color="#2563EB" />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{l.nome}</div>
                    <div style={{ fontSize: 11.5, color: '#94A3B8' }}>{l.telefone}</div>
                  </div>
                  <ChevronRight size={15} color="#CBD5E1" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
