'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { CheckCircle2, Loader2, RefreshCw, Search, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { canViewVoiceSeller, voiceLeadSearch, VOICE_BLOCKED_STATUSES, type VoiceLead, type VoiceSeller } from '@/lib/utils/voice-leads'

const PAGE_SIZE = 25
const control: CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #383228', borderRadius: 9, fontSize: 13, boxSizing: 'border-box' }
const button: CSSProperties = { padding: '9px 12px', borderRadius: 9, cursor: 'pointer', fontSize: 12, fontWeight: 700 }
const statusLabels: Record<string, string> = { novo: 'Nova', contactado: 'Contactada', nao_atende: 'Não atendeu', ligar_depois: 'Ligar depois', sem_cobertura: 'Sem cobertura', outro: 'Outro' }

export default function VoiceLeadPicker({ selectedId, onSelect, disabled = false }: {
  selectedId?: string
  onSelect: (lead: VoiceLead | null) => void
  disabled?: boolean
}) {
  const [actor, setActor] = useState<VoiceSeller | null>(null)
  const [sellers, setSellers] = useState<VoiceSeller[]>([])
  const [sellerId, setSellerId] = useState('')
  const [draft, setDraft] = useState('')
  const [term, setTerm] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)
  const [revision, setRevision] = useState(0)
  const [authRevision, setAuthRevision] = useState(0)
  const [leads, setLeads] = useState<VoiceLead[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function loadSellers() {
      const sb = createClient()
      const { data: { user }, error: authError } = await sb.auth.getUser()
      if (authError || !user) throw new Error('Sessão expirada. Entra novamente no SD Dialer.')
      const fields = 'id,company_id,full_name,role,status,supervisor_id,created_by,restricted_admin'
      const { data: me, error: profileError } = await sb.from('usuarios').select(fields).eq('id', user.id).single()
      if (profileError) throw profileError
      if (!me?.company_id || me.status !== 'active') throw new Error('A conta não tem uma empresa ativa associada.')
      let members: VoiceSeller[] = [me]
      if (me.role === 'admin' || me.role === 'supervisor') {
        const { data, error: teamError } = await sb.from('usuarios').select(fields)
          .eq('company_id', me.company_id).eq('status', 'active').order('full_name').limit(500)
        if (teamError) throw teamError
        members = [me, ...(data ?? []).filter(member => member.id !== me.id)]
      }
      if (!active) return
      const allowed = members.filter(member => canViewVoiceSeller(me, member))
      setActor(me)
      setSellers(allowed)
      setSellerId(allowed.length > 1 ? 'team' : me.id)
    }
    loadSellers().catch(err => {
      if (active) { setError(err.message || 'Não foi possível carregar os vendedores.'); setLoading(false) }
    })
    return () => { active = false }
  }, [authRevision])

  useEffect(() => {
    if (!actor || !sellerId || !sellers.length) return
    const controller = new AbortController()
    let active = true
    async function loadLeads() {
      setLoading(true)
      setError('')
      setLeads([])
      const allowed = sellers.filter(seller => canViewVoiceSeller(actor!, seller))
      const ids = sellerId === 'team' ? allowed.map(seller => seller.id) : allowed.filter(seller => seller.id === sellerId).map(seller => seller.id)
      if (!ids.length) throw new Error('Sem acesso às leads deste vendedor.')
      const sb = createClient()
      let query = sb.from('leads').select('id,nome,telefone,status,assigned_to')
        .eq('company_id', actor!.company_id!).in('assigned_to', ids)
        .not('telefone', 'is', null).neq('telefone', '')
        .not('status', 'in', '(' + VOICE_BLOCKED_STATUSES.join(',') + ')')
      if (status) query = query.eq('status', status)
      if (term) query = query.or(`nome.ilike.%${term}%,telefone.ilike.%${term}%`)
      const { data, error: listError } = await query.order('created_at', { ascending: false }).order('id')
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).abortSignal(controller.signal)
      if (listError) throw listError
      if (!active) return
      setHasMore((data?.length ?? 0) > PAGE_SIZE)
      setLeads((data ?? []).slice(0, PAGE_SIZE))
    }
    loadLeads().catch(err => {
      if (active) setError(err.message || 'Não foi possível carregar as leads.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false; controller.abort() }
  }, [actor, sellers, sellerId, term, status, page, revision])

  function resetSelection() { onSelect(null); setLeads([]); setPage(0) }
  const manager = actor?.role === 'admin' || actor?.role === 'supervisor'
  const sellerName = (id?: string | null) => sellers.find(seller => seller.id === id)?.full_name || 'Vendedor'

  return <section aria-label="Leads para chamadas IA" style={{ marginTop: 4 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <strong style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 7 }}><Users size={16} />1. Leads do vendedor</strong>
      <button type="button" style={button} disabled={loading || disabled} aria-label="Atualizar leads" onClick={() => { resetSelection(); actor ? setRevision(value => value + 1) : setAuthRevision(value => value + 1) }}><RefreshCw size={14} /></button>
    </div>
    {manager && <label style={{ display: 'block', fontSize: 12, marginBottom: 10 }}>Vendedor
      <select style={{ ...control, marginTop: 5 }} value={sellerId} disabled={!actor || disabled} onChange={event => { resetSelection(); setSellerId(event.target.value) }}>
        {sellers.length > 1 && <option value="team">Toda a equipa</option>}
        {sellers.map(seller => <option key={seller.id} value={seller.id}>{seller.id === actor?.id ? 'As minhas leads' : seller.full_name}</option>)}
      </select>
    </label>}
    <div style={{ display: 'flex', gap: 7, marginBottom: 9 }}>
      <input aria-label="Pesquisar leads por nome ou telefone" style={{ ...control, flex: 1, minWidth: 0 }} placeholder="Nome ou telefone (opcional)" value={draft} disabled={disabled}
        onChange={event => setDraft(event.target.value)} onKeyDown={event => {
          if (event.key === 'Enter') { resetSelection(); setTerm(voiceLeadSearch(draft)); setRevision(value => value + 1) }
        }} />
      <button type="button" aria-label="Pesquisar leads" style={button} disabled={disabled || !actor} onClick={() => { resetSelection(); setTerm(voiceLeadSearch(draft)); setRevision(value => value + 1) }}><Search size={16} /></button>
    </div>
    <select aria-label="Estado das leads" style={{ ...control, marginBottom: 10 }} value={status} disabled={disabled} onChange={event => { resetSelection(); setStatus(event.target.value) }}>
      <option value="">Todos os estados disponíveis para chamada</option>
      {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
    {error && <p role="alert" style={{ color: '#FCA5A5', fontSize: 12 }}>{error} <button type="button" style={button} onClick={() => actor ? setRevision(value => value + 1) : setAuthRevision(value => value + 1)}>Tentar novamente</button></p>}
    {loading ? <p role="status" style={{ display: 'flex', gap: 7, fontSize: 12 }}><Loader2 size={15} />A carregar leads…</p> : !error && <>
      <p role="status" style={{ fontSize: 11, margin: '4px 0 10px', color: '#CDBFA3' }}>{leads.length ? `Página ${page + 1} · ${leads.length} leads. Escolhe uma para preparar a chamada.` : 'Sem leads disponíveis com estes filtros.'}</p>
      <div style={{ display: 'grid', gap: 7, maxHeight: 360, overflowY: 'auto' }}>
        {leads.map(lead => <button type="button" key={lead.id} disabled={disabled} aria-pressed={selectedId === lead.id} onClick={() => onSelect(lead)}
          style={{ padding: '12px', borderRadius: 10, textAlign: 'left', cursor: disabled ? 'default' : 'pointer', border: '1px solid #393329', opacity: disabled ? .6 : 1 }}>
          <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontWeight: 700, fontSize: 13 }}>{lead.nome || 'Sem nome'}{selectedId === lead.id && <CheckCircle2 size={16} />}</span>
          <span style={{ display: 'block', fontSize: 12, marginTop: 4 }}>{lead.telefone} · {statusLabels[lead.status] || lead.status}</span>
          {manager && <span style={{ display: 'block', fontSize: 11, marginTop: 4, opacity: .75 }}>{sellerName(lead.assigned_to)}</span>}
        </button>)}
      </div>
      {(page > 0 || hasMore) && <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 10 }}>
        <button type="button" style={button} disabled={page === 0 || disabled} onClick={() => { onSelect(null); setLeads([]); setPage(value => value - 1) }}>Anterior</button>
        <button type="button" style={button} disabled={!hasMore || disabled} onClick={() => { onSelect(null); setLeads([]); setPage(value => value + 1) }}>Seguinte</button>
      </div>}
    </>}
  </section>
}
