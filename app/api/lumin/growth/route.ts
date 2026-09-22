import { NextRequest, NextResponse } from 'next/server'
import { createClient as createBrowserlessClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

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
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const { data: me } = await supabase
      .from('usuarios')
      .select('role, company_id, is_super_admin')
      .eq('id', user.id)
      .maybeSingle()

    if (!me || !['admin', 'supervisor'].includes(me.role)) {
      return NextResponse.json({ error: 'Sem permissao' }, { status: 403 })
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
      return NextResponse.json({ error: 'LUMIN AI company not configured' }, { status: 500 })
    }

    if (!me.is_super_admin && me.company_id !== luminCompanyId) {
      return NextResponse.json({ error: 'Sem permissao para dados LUMIN' }, { status: 403 })
    }

    const url = new URL(req.url)
    const rawDays = Number(url.searchParams.get('days') || 7)
    const days = [1, 7, 14, 30, 90].includes(rawDays) ? rawDays : 7
    const since = new Date(Date.now() - days * 86400000).toISOString()

    const [{ data: events, error: eventsError }, { data: leads, error: leadsError }] = await Promise.all([
      admin
        .from('lumin_events')
        .select('event_type,page_path,utm_source,utm_medium,utm_campaign,utm_content,referrer_domain,session_id,event_data,created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(5000),
      admin
        .from('leads')
        .select('id,nome,email,telefone,status,created_at,custom_fields')
        .eq('company_id', luminCompanyId)
        .contains('custom_fields', { source: 'luminai.pt' })
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(100),
    ])

    if (eventsError) throw eventsError
    if (leadsError) throw leadsError

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
      source: (() => {
        try {
          const p = new URLSearchParams(String(lead.custom_fields?.utm || ''))
          return p.get('utm_source') || '(direct)'
        } catch { return '(direct)' }
      })(),
      campaign: (() => {
        try {
          const p = new URLSearchParams(String(lead.custom_fields?.utm || ''))
          return p.get('utm_campaign') || ''
        } catch { return '' }
      })(),
      content: (() => {
        try {
          const p = new URLSearchParams(String(lead.custom_fields?.utm || ''))
          return p.get('utm_content') || ''
        } catch { return '' }
      })(),
      problem: lead.custom_fields?.problema || '',
      result: lead.custom_fields?.resultado || '',
      session_id: lead.custom_fields?.session_id || null,
    }))

    return NextResponse.json({
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
    return NextResponse.json({ error: error?.message ?? 'Erro interno' }, { status: 500 })
  }
}
