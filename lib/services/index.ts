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
      .select('*')
      .order('full_name')
    if (error) throw error
    return (data ?? []) as Usuario[]
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
  async getAll(filters?: { campanha_id?: string; status?: string; assigned_to?: string; origem?: string }) {
    const sb = createClient()
    let q = sb
      .from('leads')
      .select('*, campanhas(id,name), parceiro:assigned_to(id,full_name,avatar_url)')
      .order('created_at', { ascending: false })
    if (filters?.campanha_id) q = q.eq('campanha_id', filters.campanha_id)
    if (filters?.status)      q = q.eq('status', filters.status)
    if (filters?.assigned_to) q = q.eq('assigned_to', filters.assigned_to)
    if (filters?.origem)      q = q.eq('origem', filters.origem)
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
    ai_summary?: string | null
    ai_sentiment?: string | null
    ai_next_best_action?: string | null
    ai_objections_detected?: string[]
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
    // No date filter: return ALL non-done follow-ups (overdue + upcoming)
    // Order ascending so overdue (oldest) appear first
    const { data, error } = await sb
      .from('follow_ups')
      .select('*, lead:lead_id(id,nome,telefone)')
      .eq('parceiro_id', userId)
      .eq('done', false)
      .order('scheduled_at', { ascending: true })
    if (error) throw error
    return (data ?? []) as FollowUp[]
  },
  async markDone(id: string) {
    const sb = createClient()
    const { error } = await sb.from('follow_ups').update({ done: true }).eq('id', id)
    if (error) throw error
  },
}

// -------------------------------------------------------
// DOOR CAPTURES (Porta → Lead)
// -------------------------------------------------------
import type { DoorCapture, DoorCaptureAttachment, LeadTimelineEntry } from '@/lib/types'
import { calculateDoorCaptureScore, scoreParaTemperatura } from '@/lib/utils/calculations'

export const doorCaptureService = {
  async getAll(filters?: {
    company_id?: string
    comercial_id?: string
    campanha_id?: string
    resultado?: string
    distrito?: string
    localidade?: string
    interesse?: string
    from?: string
    to?: string
  }) {
    const sb = createClient()
    let q = sb
      .from('door_captures')
      .select('*, comercial:comercial_id(id,full_name,avatar_url), campanha:campanha_id(id,name), lead:lead_id(id,nome,status)')
      .order('created_at', { ascending: false })
    if (filters?.company_id) q = q.eq('company_id', filters.company_id)
    if (filters?.comercial_id) q = q.eq('comercial_id', filters.comercial_id)
    if (filters?.campanha_id) q = q.eq('campanha_id', filters.campanha_id)
    if (filters?.resultado) q = q.eq('resultado', filters.resultado)
    if (filters?.distrito) q = q.eq('distrito', filters.distrito)
    if (filters?.localidade) q = q.eq('localidade', filters.localidade)
    if (filters?.interesse) q = q.eq('interesse', filters.interesse)
    if (filters?.from) q = q.gte('created_at', filters.from)
    if (filters?.to) q = q.lte('created_at', filters.to)
    const { data, error } = await q
    if (error) throw error
    return (data ?? []) as DoorCapture[]
  },

  async getById(id: string) {
    const sb = createClient()
    const { data, error } = await sb
      .from('door_captures')
      .select('*, comercial:comercial_id(id,full_name,avatar_url), campanha:campanha_id(id,name), lead:lead_id(id,nome,status)')
      .eq('id', id)
      .single()
    if (error) throw error
    return data as DoorCapture
  },

  /**
   * Verifica duplicados por telefone, email ou morada dentro da mesma empresa.
   */
  async findDuplicateLead(companyId: string, telefone: string, email?: string | null, morada?: string | null) {
    const sb = createClient()
    let q = sb.from('leads').select('id,nome,telefone,email,morada,status').eq('company_id', companyId)
    const orParts = [`telefone.eq.${telefone}`]
    if (email) orParts.push(`email.eq.${email}`)
    if (morada) orParts.push(`morada.eq.${morada}`)
    q = q.or(orParts.join(','))
    const { data, error } = await q.limit(1)
    if (error) throw error
    return data?.[0] ?? null
  },

  /**
   * Cria uma atividade na timeline da lead.
   */
  async addTimelineEntry(entry: Pick<LeadTimelineEntry, 'company_id' | 'lead_id' | 'tipo' | 'descricao' | 'usuario_id'> & { metadata?: Record<string, unknown> }) {
    const sb = createClient()
    const { error } = await sb.from('lead_timeline').insert(entry)
    if (error) throw error
  },

  /**
   * Cria a captação de porta e executa todas as automações:
   * 1. Verifica duplicados (telefone/email/morada)
   * 2. Cria ou atualiza a lead
   * 3. Calcula o Lead Score
   * 4. Regista atividade na timeline
   * 5. Cria tarefa de follow-up se aplicável
   * 6. Notifica o responsável se a lead ficar "quente"
   */
  async createWithAutomation(input: {
    door: Omit<Partial<DoorCapture>, 'lead_id' | 'score' | 'score_motivos' | 'duplicado_de_lead_id'>
    companyId: string
    comercialId: string
    temAnexos?: boolean
  }): Promise<{ doorCapture: DoorCapture; lead: Lead; duplicado: boolean }> {
    const sb = createClient()
    const { door, companyId, comercialId, temAnexos } = input

    // 1. Deduplicação
    const existente = door.telefone
      ? await this.findDuplicateLead(companyId, door.telefone, door.email, door.morada)
      : null

    // 2. Criar ou reutilizar lead
    let lead: Lead
    if (existente) {
      const { data, error } = await sb.from('leads').update({
        nome: door.nome ?? existente.nome,
        email: door.email ?? existente.email,
        morada: door.morada ?? existente.morada,
        codigo_postal: door.codigo_postal ?? undefined,
        localidade: door.localidade ?? undefined,
        consentimento_rgpd: door.consentimento_rgpd ?? undefined,
        data_consentimento: door.data_consentimento ?? undefined,
      }).eq('id', existente.id).select().single()
      if (error) throw error
      lead = data as Lead
    } else {
      const { data, error } = await sb.from('leads').insert({
        company_id: companyId,
        campanha_id: door.campanha_id ?? null,
        assigned_to: comercialId,
        nome: door.nome,
        telefone: door.telefone,
        email: door.email ?? null,
        morada: door.morada ?? null,
        codigo_postal: door.codigo_postal ?? null,
        localidade: door.localidade ?? null,
        operador: door.tc_operador_atual ?? door.en_comercializador_atual ?? null,
        observacoes: door.notas ?? null,
        status: 'novo',
        origem: 'porta',
        consentimento_rgpd: door.consentimento_rgpd ?? false,
        data_consentimento: door.data_consentimento ?? null,
      }).select().single()
      if (error) throw error
      lead = data as Lead
    }

    // 3. Lead Score
    const { score, motivos } = calculateDoorCaptureScore({
      tc_fim_fidelizacao: door.tc_fim_fidelizacao,
      en_fim_contrato: door.en_fim_contrato,
      tc_mensalidade: door.tc_mensalidade,
      en_valor_medio_mensal: door.en_valor_medio_mensal,
      tc_satisfacao: door.tc_satisfacao,
      tc_problemas: door.tc_problemas,
      interesse: door.interesse,
      tc_tem_tv: door.tc_tem_tv,
      tc_tem_internet: door.tc_tem_internet,
      tc_tem_fixo: door.tc_tem_fixo,
      en_tipo: door.en_tipo,
      melhor_horario: door.melhor_horario,
      temAnexos,
    })
    const temperatura = door.temperatura ?? scoreParaTemperatura(score)

    // 4. Criar door_capture
    const { data: doorCapture, error: dcError } = await sb.from('door_captures').insert({
      ...door,
      company_id: companyId,
      comercial_id: comercialId,
      lead_id: lead.id,
      temperatura,
      score,
      score_motivos: motivos,
      duplicado_de_lead_id: existente ? existente.id : null,
    }).select().single()
    if (dcError) throw dcError

    // 5. Timeline
    await this.addTimelineEntry({
      company_id: companyId,
      lead_id: lead.id,
      tipo: 'porta',
      descricao: existente
        ? `Nova abordagem de porta registada (lead já existente) — resultado: ${door.resultado ?? 'n/d'}`
        : `Lead criada por captação de porta — resultado: ${door.resultado ?? 'n/d'}`,
      usuario_id: comercialId,
      metadata: { door_capture_id: doorCapture.id, score, temperatura },
    })

    // 6. Tarefa de follow-up
    if (door.resultado === 'follow_up' && door.data_proximo_contacto) {
      await sb.from('tarefas').insert({
        company_id: companyId,
        lead_id: lead.id,
        responsavel_id: comercialId,
        titulo: `Follow-up: ${door.nome}`,
        descricao: door.proxima_acao ?? 'Follow-up agendado a partir de captação de porta.',
        tipo: 'follow_up',
        data_limite: door.data_proximo_contacto,
      })
    }

    // 7. Notificar responsável se lead ficar quente
    if (temperatura === 'quente') {
      await sb.from('notificacoes').insert({
        user_id: comercialId,
        type: 'nova_lead',
        title: 'Lead quente captada na porta',
        message: `${door.nome} — score ${score}/100. ${motivos[0] ?? ''}`,
        data: { lead_id: lead.id, door_capture_id: doorCapture.id },
      })
    }

    return { doorCapture: doorCapture as DoorCapture, lead, duplicado: !!existente }
  },

  async update(id: string, payload: Partial<DoorCapture>) {
    const sb = createClient()
    const { data, error } = await sb.from('door_captures').update(payload).eq('id', id).select().single()
    if (error) throw error
    return data as DoorCapture
  },

  async addAttachment(payload: Omit<DoorCaptureAttachment, 'id' | 'created_at'>) {
    const sb = createClient()
    const { data, error } = await sb.from('door_capture_attachments').insert(payload).select().single()
    if (error) throw error
    return data as DoorCaptureAttachment
  },

  async getAttachments(doorCaptureId: string) {
    const sb = createClient()
    const { data, error } = await sb
      .from('door_capture_attachments')
      .select('*')
      .eq('door_capture_id', doorCaptureId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as DoorCaptureAttachment[]
  },

  async getLeadTimeline(leadId: string) {
    const sb = createClient()
    const { data, error } = await sb
      .from('lead_timeline')
      .select('*, usuario:usuario_id(id,full_name)')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as LeadTimelineEntry[]
  },

  /**
   * Estatísticas para o Relatório de Porta.
   */
  async getReportStats(filters?: {
    company_id?: string
    comercial_id?: string
    campanha_id?: string
    distrito?: string
    localidade?: string
    from?: string
    to?: string
  }) {
    const captures = await this.getAll(filters)
    const portasAbordadas = captures.length
    const contactosFeitos = captures.filter(c => c.nome && c.telefone).length
    const leadsQuentes = captures.filter(c => c.temperatura === 'quente').length
    const followUps = captures.filter(c => c.resultado === 'follow_up').length
    const comparacoesPedidas = captures.filter(c => c.tc_interesse_comparacao).length
    const vendas = captures.filter(c => c.resultado === 'venda').length
    const taxaConversao = portasAbordadas > 0 ? (vendas / portasAbordadas) * 100 : 0

    const porComercial: Record<string, number> = {}
    const porCampanha: Record<string, number> = {}
    const porRua: Record<string, number> = {}
    const porZona: Record<string, number> = {}
    const motivosRecusa: Record<string, number> = {}
    const porOrigem: Record<string, number> = { telecomunicacoes: 0, energia: 0, ambos: 0 }

    for (const c of captures) {
      const comercialNome = c.comercial?.full_name ?? 'Desconhecido'
      porComercial[comercialNome] = (porComercial[comercialNome] || 0) + 1

      const campanhaNome = c.campanha?.name ?? 'Sem campanha'
      porCampanha[campanhaNome] = (porCampanha[campanhaNome] || 0) + 1

      if (c.morada) porRua[c.morada] = (porRua[c.morada] || 0) + 1
      if (c.localidade) porZona[c.localidade] = (porZona[c.localidade] || 0) + 1

      if (c.resultado === 'sem_interesse' && c.notas) {
        motivosRecusa[c.notas] = (motivosRecusa[c.notas] || 0) + 1
      }

      if (c.interesse) porOrigem[c.interesse] = (porOrigem[c.interesse] || 0) + 1
    }

    return {
      portasAbordadas,
      contactosFeitos,
      leadsCriadas: portasAbordadas,
      leadsQuentes,
      followUps,
      comparacoesPedidas,
      vendas,
      taxaConversao,
      porComercial,
      porCampanha,
      porRua,
      porZona,
      motivosRecusa,
      porOrigem,
    }
  },
}
