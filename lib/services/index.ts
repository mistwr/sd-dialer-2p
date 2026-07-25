import { createClient } from '@/lib/supabase/client'
import type { Company, Usuario, Campanha, Lead, CallHistory, FollowUp } from '@/lib/types'

// -------------------------------------------------------
// COMPANIES
// -------------------------------------------------------
export const companyService = {
  async getAll() {
    const sb = createClient()
    const { data, error } = await sb.from('companies').select('*').order('name')
    if (error) throw error
    return (data ?? []) as Company[]
  },
  async create(payload: Partial<Company>) {
    const sb = createClient()
    const { data, error } = await sb.from('companies').insert(payload).select().single()
    if (error) throw error
    return data as Company
  },
  async update(id: string, payload: Partial<Company>) {
    const sb = createClient()
    const { data, error } = await sb.from('companies').update(payload).eq('id', id).select().single()
    if (error) throw error
    return data as Company
  },
  async delete(id: string) {
    const sb = createClient()
    const { error } = await sb.from('companies').delete().eq('id', id)
    if (error) throw error
  },
}

// -------------------------------------------------------
// USUARIOS (Partners)
// -------------------------------------------------------
export const usuarioService = {
  async getAll() {
    const sb = createClient()
    const { data, error } = await sb
      .from('usuarios')
      .select('*, companies(id,name)')
      .order('full_name')
    if (error) throw error
    return (data ?? []) as (Usuario & { companies: { id: string; name: string } | null })[]
  },
  async getByCompany(companyId: string) {
    const sb = createClient()
    const { data, error } = await sb
      .from('usuarios')
      .select('*')
      .eq('company_id', companyId)
      .order('full_name')
    if (error) throw error
    return (data ?? []) as Usuario[]
  },
  async update(id: string, payload: Partial<Usuario>) {
    const sb = createClient()
    const { data, error } = await sb.from('usuarios').update(payload).eq('id', id).select().single()
    if (error) throw error
    return data as Usuario
  },
}

// -------------------------------------------------------
// CAMPANHAS
// -------------------------------------------------------
export const campanhaService = {
  async getAll() {
    const sb = createClient()
    const { data, error } = await sb
      .from('campanhas')
      .select('*, usuarios!created_by(full_name)')
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as Campanha[]
  },
  async create(payload: Partial<Campanha>) {
    const sb = createClient()
    const { data, error } = await sb.from('campanhas').insert(payload).select().single()
    if (error) throw error
    return data as Campanha
  },
  async update(id: string, payload: Partial<Campanha>) {
    const sb = createClient()
    const { data, error } = await sb.from('campanhas').update(payload).eq('id', id).select().single()
    if (error) throw error
    return data as Campanha
  },
  async delete(id: string) {
    const sb = createClient()
    const { error } = await sb.from('campanhas').delete().eq('id', id)
    if (error) throw error
  },
}

// -------------------------------------------------------
// LEADS
// -------------------------------------------------------
export const leadService = {
  async getAll(filters?: { campanha_id?: string; status?: string; assigned_to?: string }) {
    const sb = createClient()
    let q = sb
      .from('leads')
      .select('*, campanhas(id,name), parceiro:assigned_to(id,full_name,avatar_url)')
      .order('created_at', { ascending: false })
    if (filters?.campanha_id) q = q.eq('campanha_id', filters.campanha_id)
    if (filters?.status)      q = q.eq('status', filters.status)
    if (filters?.assigned_to) q = q.eq('assigned_to', filters.assigned_to)
    const { data, error } = await q
    if (error) throw error
    return (data ?? []) as Lead[]
  },
  async getById(id: string) {
    const sb = createClient()
    const { data, error } = await sb
      .from('leads')
      .select('*, campanhas(id,name), parceiro:assigned_to(id,full_name,avatar_url)')
      .eq('id', id)
      .single()
    if (error) throw error
    return data as Lead
  },
  async getAssigned(userId: string) {
    const sb = createClient()
    const { data, error } = await sb
      .from('leads')
      .select('*, campanhas(id,name)')
      .eq('assigned_to', userId)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []) as Lead[]
  },
  async update(id: string, payload: Partial<Lead>) {
    const sb = createClient()
    const { data, error } = await sb.from('leads').update(payload).eq('id', id).select().single()
    if (error) throw error
    return data as Lead
  },
  async bulkInsert(leads: Partial<Lead>[]) {
    const sb = createClient()
    const { data, error } = await sb.from('leads').insert(leads).select()
    if (error) throw error
    return (data ?? []) as Lead[]
  },
  async assign(leadIds: string[], userId: string) {
    const sb = createClient()
    const { error } = await sb
      .from('leads')
      .update({ assigned_to: userId })
      .in('id', leadIds)
    if (error) throw error
  },
  async delete(id: string) {
    const sb = createClient()
    const { error } = await sb.from('leads').delete().eq('id', id)
    if (error) throw error
  },
}

// -------------------------------------------------------
// CALL HISTORY
// -------------------------------------------------------
export const callHistoryService = {
  async create(payload: {
    lead_id: string
    parceiro_id: string
    company_id: string
    result: string
    duration_sec: number
    notes?: string
  }) {
    const sb = createClient()
    const { data, error } = await sb.from('call_history').insert(payload).select().single()
    if (error) throw error
    return data as CallHistory
  },
  async getByLead(leadId: string) {
    const sb = createClient()
    const { data, error } = await sb
      .from('call_history')
      .select('*, parceiro:parceiro_id(id,full_name,avatar_url)')
      .eq('lead_id', leadId)
      .order('called_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as CallHistory[]
  },
  async getByParceiro(parceiroId: string) {
    const sb = createClient()
    const { data, error } = await sb
      .from('call_history')
      .select('*, lead:lead_id(id,nome,telefone)')
      .eq('parceiro_id', parceiroId)
      .order('called_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as CallHistory[]
  },
  async getStats(companyId: string, from?: string, to?: string) {
    const sb = createClient()
    let q = sb.from('call_history').select('*').eq('company_id', companyId)
    if (from) q = q.gte('called_at', from)
    if (to)   q = q.lte('called_at', to)
    const { data, error } = await q
    if (error) throw error
    return data ?? []
  },
}

// -------------------------------------------------------
// NOTIFICATIONS
// -------------------------------------------------------
export const notificacaoService = {
  async getByUser(userId: string) {
    const sb = createClient()
    const { data, error } = await sb
      .from('notificacoes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw error
    return (data ?? []) as import('@/lib/types').Notificacao[]
  },
  async markRead(id: string) {
    const sb = createClient()
    const { error } = await sb.from('notificacoes').update({ read: true }).eq('id', id)
    if (error) throw error
  },
  async markAllRead(userId: string) {
    const sb = createClient()
    const { error } = await sb.from('notificacoes').update({ read: true }).eq('user_id', userId).eq('read', false)
    if (error) throw error
  },
  async getUnreadCount(userId: string) {
    const sb = createClient()
    const { count, error } = await sb
      .from('notificacoes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false)
    if (error) return 0
    return count ?? 0
  },
}

// -------------------------------------------------------
// FOLLOW UPS
// -------------------------------------------------------
export const followUpService = {
  async create(payload: Partial<FollowUp>) {
    const sb = createClient()
    const { data, error } = await sb.from('follow_ups').insert(payload).select().single()
    if (error) throw error
    return data as FollowUp
  },
  async getUpcoming(userId: string) {
    const sb = createClient()
    const { data, error } = await sb
      .from('follow_ups')
      .select('*, lead:lead_id(id,nome,telefone)')
      .eq('parceiro_id', userId)
      .eq('done', false)
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at')
    if (error) throw error
    return (data ?? []) as FollowUp[]
  },
  async markDone(id: string) {
    const sb = createClient()
    const { error } = await sb.from('follow_ups').update({ done: true }).eq('id', id)
    if (error) throw error
  },
}
