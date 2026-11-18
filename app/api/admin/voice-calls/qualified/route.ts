import { NextRequest, NextResponse } from 'next/server'
import { errorResponse, requireSdDialerSuperAdmin, SdDialerError } from '@/lib/server/sd-dialer-livekit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET: leads qualificados pelo robot (interesse alto/médio), um por lead, mais recente primeiro.
export async function GET(request: NextRequest) {
  try {
    const { admin } = await requireSdDialerSuperAdmin(request)
    const url = new URL(request.url)
    const days = Math.max(1, Math.min(90, Number(url.searchParams.get('days')) || 14))
    const companyId = url.searchParams.get('companyId') || ''
    const since = new Date(Date.now() - days * 86_400_000).toISOString()

    let q = admin
      .from('voice_calls')
      .select('id,lead_id,company_id,client_name,phone_number,interest_level,summary,next_action,duration_seconds,created_at,extracted_facts')
      .in('interest_level', ['alto', 'medio'])
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(500)
    if (companyId) q = q.eq('company_id', companyId)
    const { data: calls, error } = await q
    if (error) throw new SdDialerError('Não foi possível carregar os qualificados.', 500)

    const latestByLead = new Map<string, any>()
    for (const c of calls || []) {
      const key = String(c.lead_id || c.phone_number || c.id)
      if (!latestByLead.has(key)) latestByLead.set(key, c)
    }
    const leadIds = Array.from(latestByLead.values()).map(c => c.lead_id).filter(Boolean)
    const leadsById = new Map<string, any>()
    if (leadIds.length) {
      const { data: leads } = await admin.from('leads').select('id,nome,telefone,status,assigned_to,operador').in('id', leadIds)
      for (const l of leads || []) leadsById.set(String(l.id), l)
    }

    const rows = Array.from(latestByLead.values()).map(c => {
      const lead = c.lead_id ? leadsById.get(String(c.lead_id)) : null
      const info = (c.extracted_facts && c.extracted_facts.call_info) || {}
      const missing = ['operadora_atual', 'valor_atual', 'consultor_agendado'].filter(k => !info[k]).length
      return {
        callId: c.id,
        leadId: c.lead_id || null,
        companyId: c.company_id,
        name: lead?.nome || c.client_name || 'Sem nome',
        phone: lead?.telefone || c.phone_number,
        level: c.interest_level,
        summary: c.summary || '',
        nextAction: c.next_action || '',
        durationSeconds: c.duration_seconds || 0,
        createdAt: c.created_at,
        assignedTo: lead?.assigned_to || null,
        leadStatus: lead?.status || null,
        operator: info.operadora_atual || lead?.operador || null,
        currentValue: info.valor_atual || null,
        scheduled: info.consultor_agendado || null,
        missingFields: missing,
      }
    })
    rows.sort((a, b) => (a.level === b.level ? 0 : a.level === 'alto' ? -1 : 1) || a.missingFields - b.missingFields)
    return NextResponse.json({ rows })
  } catch (error) {
    return errorResponse(error, 'admin voice calls qualified GET')
  }
}

// POST: atribui leads a um vendedor. Só altera assigned_to (com WHERE) e só na mesma empresa do vendedor.
export async function POST(request: NextRequest) {
  try {
    const { admin } = await requireSdDialerSuperAdmin(request)
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const userId = String(body.userId || '')
    const leadIds = Array.isArray(body.leadIds) ? body.leadIds.map(String).filter(Boolean).slice(0, 200) : []
    if (!userId || !leadIds.length) throw new SdDialerError('Escolhe o vendedor e pelo menos um lead.', 400)

    const { data: target, error: userError } = await admin.from('usuarios').select('id,company_id,status').eq('id', userId).maybeSingle()
    if (userError || !target) throw new SdDialerError('Vendedor não encontrado.', 404)

    const { data: updated, error } = await admin
      .from('leads')
      .update({ assigned_to: userId, updated_at: new Date().toISOString() })
      .in('id', leadIds)
      .eq('company_id', target.company_id)
      .select('id')
    if (error) throw new SdDialerError('Não foi possível atribuir os leads.', 500)
    return NextResponse.json({ ok: true, assigned: (updated || []).length, requested: leadIds.length })
  } catch (error) {
    return errorResponse(error, 'admin voice calls qualified POST')
  }
}
