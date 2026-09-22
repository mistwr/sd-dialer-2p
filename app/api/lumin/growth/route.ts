import { NextRequest, NextResponse } from 'next/server'
import { createClient as createBrowserlessClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function privateJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('Cache-Control', 'private, no-store, max-age=0, must-revalidate')
  headers.set('Pragma', 'no-cache')
  headers.set('X-Robots-Tag', 'noindex, nofollow')
  return privateJson(body, { ...init, headers })
}

function maskEmail(value: unknown) {
  const email = String(value || '').trim()
  const at = email.indexOf('@')
  if (at <= 0) return null
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  const visible = local.slice(0, Math.min(2, local.length))
  return visible + '***@' + domain
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase server credentials missing')
  return createBrowserlessClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return privateJson({ error: 'Nao autenticado' }, { status: 401 })
    }

    const { data: me } = await supabase
      .from('usuarios')
      .select('role, company_id, is_super_admin')
      .eq('id', user.id)
      .maybeSingle()

    if (!me || !['admin', 'supervisor'].includes(me.role)) {
      return privateJson({ error: 'Sem permissao' }, { status: 403 })
    }

    const admin = adminClient()
    let luminCompanyId = process.env.LUMIN_DEFAULT_COMPANY_ID || process.env.REBORN_DEFAULT_COMPANY_ID || ''
    if (!luminCompanyId) {
      const { data: company } = await admin
        .from('companies')
        .select('id')
        .ilike('name', 'LUMIN AI')
        .limit(1)
        .maybeSingle()
      luminCompanyId = company?.id || ''
    }
    if (!luminCompanyId) {
      return privateJson({ error: 'LUMIN AI company not configured' }, { status: 500 })
    }

    if (!me.is_super_admin && me.company_id !== luminCompanyId) {
      return privateJson({ error: 'Sem permissao para dados LUMIN' }, { status: 403 })
    }

    const url = new URL(req.url)
    const rawDays = Number(url.searchParams.get('days') || 7)
    const days = [1, 7, 14, 30, 90].includes(rawDays) ? rawDays : 7
    const since = new Date(Date.now() - days * 86400000).toISOString()

    const [
      { data: events, error: eventsError },
      { data: leads, error: leadsError },
      { data: revenueEvents, error: revenueError },
    ] = await Promise.all([
      admin
        .from('lumin_events')
        .select('event_type,page_path,utm_source,utm_medium,utm_campaign,utm_content,referrer_domain,session_id,event_data,created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(5000),
      admin
        .from('leads')
        .select('id,nome,status,created_at,custom_fields')
        .eq('company_id', luminCompanyId)
        .contains('custom_fields', { source: 'luminai.pt' })
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(100),
      admin
        .from('lumin_revenue_events')
        .select('id,event_type,status,amount,currency,customer_email,lead_id,occurred_at')
        .gte('occurred_at', since)
        .order('occurred_at', { ascending: false })
        .limit(500),
    ])

    if (eventsError) throw eventsError
    if (leadsError) throw leadsError
    if (revenueError) throw revenueError

    const counts: Record<string, number> = {}
    const sessions = new Set<string>()
    const stageSessions: Record<string, Set<string>> = {}
    const sourceMap: Record<string, {
      source: string
      pageViews: number
      simulationClicks: number
      simulationResults: number
      leadSubmits: number
      whatsappClicks: number
      robotClicks: number
      sessions: Set<string>
    }> = {}
    const creativeMap: Record<string, {
      source: string
      campaign: string
      content: string
      pageViews: number
      simulationClicks: number
      simulationResults: number
      leadSubmits: number
      sessions: Set<string>
    }> = {}

    const sourceOf = (e: any) =>
      e.utm_source || e.referrer_domain || '(direct)'

    for (const e of events ?? []) {
      counts[e.event_type] = (counts[e.event_type] || 0) + 1
      if (e.session_id) {
        sessions.add(e.session_id)
        if (!stageSessions[e.event_type]) stageSessions[e.event_type] = new Set<string>()
        stageSessions[e.event_type].add(e.session_id)
      }

      const source = sourceOf(e)
      if (!sourceMap[source]) {
        sourceMap[source] = {
          source,
          pageViews: 0,
          simulationClicks: 0,
          simulationResults: 0,
          leadSubmits: 0,
          whatsappClicks: 0,
          robotClicks: 0,
          sessions: new Set<string>(),
        }
      }
      const row = sourceMap[source]
      if (e.session_id) row.sessions.add(e.session_id)
      if (e.event_type === 'page_view') row.pageViews++
      if (e.event_type === 'simulation_click') row.simulationClicks++
      if (e.event_type === 'simulation_result') row.simulationResults++
      if (e.event_type === 'lead_submit') row.leadSubmits++
      if (e.event_type === 'whatsapp_click') row.whatsappClicks++
      if (e.event_type === 'robot_click') row.robotClicks++

      const campaign = e.utm_campaign || '(sem campanha)'
      const content = e.utm_content || '(sem conteúdo)'
      const creativeKey = [source, campaign, content].join('::')
      if (!creativeMap[creativeKey]) {
        creativeMap[creativeKey] = {
          source,
          campaign,
          content,
          pageViews: 0,
          simulationClicks: 0,
          simulationResults: 0,
          leadSubmits: 0,
          sessions: new Set<string>(),
        }
      }
      const creative = creativeMap[creativeKey]
      if (e.session_id) creative.sessions.add(e.session_id)
      if (e.event_type === 'page_view') creative.pageViews++
      if (e.event_type === 'simulation_click') creative.simulationClicks++
      if (e.event_type === 'simulation_result') creative.simulationResults++
      if (e.event_type === 'lead_submit') creative.leadSubmits++
    }

    const confirmedLeadSessions = new Set<string>()
    for (const lead of leads ?? []) {
      const sessionId = (lead.custom_fields as any)?.session_id
      if (sessionId) confirmedLeadSessions.add(String(sessionId))
    }

    const sourceRows = Object.values(sourceMap)
      .map(row => ({
        source: row.source,
        sessions: row.sessions.size,
        pageViews: row.pageViews,
        simulationClicks: row.simulationClicks,
        simulationResults: row.simulationResults,
        leadSubmits: row.leadSubmits,
        whatsappClicks: row.whatsappClicks,
        robotClicks: row.robotClicks,
        resultRate: row.simulationClicks > 0 ? Number(((row.simulationResults / row.simulationClicks) * 100).toFixed(1)) : 0,
        leadRate: row.simulationResults > 0 ? Number(((row.leadSubmits / row.simulationResults) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.leadSubmits - a.leadSubmits || b.simulationResults - a.simulationResults || b.pageViews - a.pageViews)

    const creativeRows = Object.values(creativeMap)
      .filter(row => row.source !== '(direct)' || row.campaign !== '(sem campanha)' || row.content !== '(sem conteúdo)')
      .map(row => ({
        source: row.source,
        campaign: row.campaign,
        content: row.content,
        sessions: row.sessions.size,
        pageViews: row.pageViews,
        simulationClicks: row.simulationClicks,
        simulationResults: row.simulationResults,
        leadSubmits: row.leadSubmits,
        resultRate: row.simulationClicks > 0 ? Number(((row.simulationResults / row.simulationClicks) * 100).toFixed(1)) : 0,
        leadRate: row.simulationResults > 0 ? Number(((row.leadSubmits / row.simulationResults) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.leadSubmits - a.leadSubmits || b.simulationResults - a.simulationResults || b.simulationClicks - a.simulationClicks || b.pageViews - a.pageViews)
      .slice(0, 30)

    const recentLeads = (leads ?? []).slice(0, 20).map((lead: any) => ({
      id: lead.id,
      nome: lead.nome,
      empresa: lead.custom_fields?.empresa || '',
      status: lead.status,
      created_at: lead.created_at,
      source: lead.custom_fields?.utm_source || (() => {
        try {
          const p = new URLSearchParams(String(lead.custom_fields?.utm || ''))
          return p.get('utm_source') || '(direct)'
        } catch { return '(direct)' }
      })(),
      campaign: lead.custom_fields?.utm_campaign || (() => {
        try {
          const p = new URLSearchParams(String(lead.custom_fields?.utm || ''))
          return p.get('utm_campaign') || ''
        } catch { return '' }
      })(),
      content: lead.custom_fields?.utm_content || (() => {
        try {
          const p = new URLSearchParams(String(lead.custom_fields?.utm || ''))
          return p.get('utm_content') || ''
        } catch { return '' }
      })(),
      problem: lead.custom_fields?.problema || '',
      result: lead.custom_fields?.resultado || '',
      session_id: lead.custom_fields?.session_id || null,
    }))

    const successfulPayments = (revenueEvents ?? []).filter((event: any) =>
      event.event_type === 'payment' && ['succeeded', 'paid', 'complete'].includes(String(event.status).toLowerCase())
    )
    const activeSubscriptions = (revenueEvents ?? []).filter((event: any) =>
      event.event_type === 'subscription' && String(event.status).toLowerCase() === 'active'
    )
    const revenueByCurrency: Record<string, number> = {}
    for (const event of successfulPayments) {
      const currency = String(event.currency || 'eur').toUpperCase()
      revenueByCurrency[currency] = Number(((revenueByCurrency[currency] || 0) + Number(event.amount || 0)).toFixed(2))
    }

    const recentRevenue = (revenueEvents ?? []).slice(0, 20).map((event: any) => ({
      id: event.id,
      event_type: event.event_type,
      status: event.status,
      amount: event.amount == null ? null : Number(event.amount),
      currency: String(event.currency || '').toUpperCase(),
      customer_email_masked: maskEmail(event.customer_email),
      occurred_at: event.occurred_at,
      matched_to_lead: Boolean(event.lead_id),
    }))

    return privateJson({
      days,
      since,
      totals: {
        sessions: sessions.size,
        pageViews: counts.page_view || 0,
        simulationClicks: counts.simulation_click || 0,
        simulationResults: counts.simulation_result || 0,
        leadSubmits: counts.lead_submit || 0,
        confirmedLeads: leads?.length || 0,
        confirmedLeadSessions: confirmedLeadSessions.size,
        whatsappClicks: counts.whatsapp_click || 0,
        robotClicks: counts.robot_click || 0,
        proClicks: counts.pro_click || 0,
        checkoutClicks: counts.checkout_click || 0,
        verifiedPayments: successfulPayments.length,
        activeSubscriptions: activeSubscriptions.length,
      },
      revenue: {
        byCurrency: revenueByCurrency,
        recent: recentRevenue,
      },
      funnel: [
        { key: 'page_view', label: 'Visitas', value: counts.page_view || 0, sessions: stageSessions.page_view?.size || 0 },
        { key: 'simulation_click', label: 'Entraram na simulação', value: counts.simulation_click || 0, sessions: stageSessions.simulation_click?.size || 0 },
        { key: 'simulation_result', label: 'Viram resultado', value: counts.simulation_result || 0, sessions: stageSessions.simulation_result?.size || 0 },
        { key: 'lead_submit', label: 'Enviaram contacto', value: counts.lead_submit || 0, sessions: stageSessions.lead_submit?.size || 0 },
        { key: 'confirmed_lead', label: 'Leads no CRM', value: leads?.length || 0, sessions: confirmedLeadSessions.size },
      ],
      sources: sourceRows,
      creatives: creativeRows,
      recentLeads,
    })
  } catch (error: any) {
    console.error('LUMIN growth dashboard error', error)
    return privateJson({ error: error?.message ?? 'Erro interno' }, { status: 500 })
  }
}
