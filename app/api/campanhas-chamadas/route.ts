import { NextRequest, NextResponse } from 'next/server'
import { errorResponse, requireSdDialerUser, requireVoiceCallAccess, SdDialerError } from '@/lib/server/sd-dialer-livekit'

export const runtime = 'nodejs'

const OPEN = ['novo', 'nao_atende', 'ligar_depois']
const MANAGERS = new Set(['admin', 'supervisor', 'super_admin'])

function isManager(profile: any) {
  return profile.is_super_admin === true || MANAGERS.has(String(profile.role))
}

// As chamadas automáticas são só para admin/supervisor/superadmin (parceiros não têm acesso).
function assertManager(profile: any) {
  if (!isManager(profile)) throw new SdDialerError('As chamadas automáticas são só para administradores e supervisores.', 403)
}

async function chunked<T>(ids: string[], fn: (part: string[]) => Promise<T[]>) {
  const out: T[] = []
  for (let i = 0; i < ids.length; i += 150) out.push(...(await fn(ids.slice(i, i + 150))))
  return out
}

export async function GET(request: NextRequest) {
  try {
    const { admin, user, profile } = await requireSdDialerUser(request)
    assertManager(profile)
    let query = admin.from('call_campaigns').select('*').eq('company_id', profile.company_id).order('created_at', { ascending: false }).limit(10)
    if (!isManager(profile)) query = query.eq('created_by', user.id)
    const { data: campaigns, error } = await query
    if (error) throw new SdDialerError('Não foi possível carregar as campanhas.', 500)

    const result = []
    for (const c of campaigns || []) {
      const { data: rows } = await admin.from('call_campaign_leads').select('state,call_id').eq('campaign_id', c.id).limit(5000)
      const counts = { pending: 0, calling: 0, done: 0, skipped: 0 }
      const callIds: string[] = []
      for (const r of rows || []) {
        counts[r.state as keyof typeof counts]++
        if (r.call_id) callIds.push(r.call_id)
      }
      const calls = await chunked<any>(callIds, async part => (await admin.from('voice_calls').select('status,interest_level').in('id', part)).data || [])
      const outcome = { conversas: 0, caixa_voz: 0, sem_resposta: 0, interesse: 0 }
      for (const call of calls) {
        if (call.status === 'voicemail' || call.interest_level === 'correio_voz') outcome.caixa_voz++
        else if (call.status === 'failed') outcome.sem_resposta++
        else if (call.interest_level && !['indeterminado', 'em_curso'].includes(call.interest_level)) outcome.conversas++
        if (call.interest_level === 'alto' || call.interest_level === 'medio') outcome.interesse++
      }
      result.push({ ...c, counts, total: (rows || []).length, outcome })
    }
    return NextResponse.json({ campaigns: result })
  } catch (error) {
    return errorResponse(error, 'campanhas-chamadas GET')
  }
}

export async function POST(request: NextRequest) {
  try {
    const { admin, user, profile } = await requireSdDialerUser(request)
    assertManager(profile)
    await requireVoiceCallAccess(admin, user.id, profile)
    const body = await request.json().catch(() => ({})) as any
    const name = String(body.name || '').trim().slice(0, 80) || 'Campanha ' + new Date().toLocaleDateString('pt-PT')
    const statuses = (Array.isArray(body.statuses) ? body.statuses : OPEN).filter((s: string) => OPEN.includes(s))
    if (!statuses.length) throw new SdDialerError('Escolhe pelo menos um estado de lead.', 400)
    const limit = Math.min(2000, Math.max(1, Number(body.limit) || 200))
    const concurrency = Math.min(3, Math.max(1, Number(body.concurrency) || 1))
    const callsPerHour = Math.min(300, Math.max(1, Number(body.calls_per_hour) || 30))
    const windowStart = Math.min(23, Math.max(0, Number(body.window_start ?? 9)))
    const windowEnd = Math.min(24, Math.max(windowStart + 1, Number(body.window_end ?? 21)))

    const pickedIds: string[] = Array.isArray(body.lead_ids) ? body.lead_ids.map(String).slice(0, 2000) : []
    let leadsQuery = admin.from('leads').select('id,telefone').eq('company_id', profile.company_id).in('status', statuses).not('telefone', 'is', null).order('created_at', { ascending: false }).limit(limit)
    if (pickedIds.length) leadsQuery = leadsQuery.in('id', pickedIds)
    else {
      if (body.campanha_id) leadsQuery = leadsQuery.eq('campanha_id', String(body.campanha_id))
      const loc = String(body.localidade || '').trim().replace(/[%,]/g, ''); if (loc) leadsQuery = leadsQuery.ilike('localidade', '%' + loc + '%')
      const opr = String(body.operador || '').trim().replace(/[%,]/g, ''); if (opr) leadsQuery = leadsQuery.ilike('operador', '%' + opr + '%')
    }
    if (!isManager(profile)) leadsQuery = leadsQuery.eq('assigned_to', user.id)
    const { data: leads, error: leadsError } = await leadsQuery
    if (leadsError) throw new SdDialerError('Não foi possível escolher as leads.', 500)
    const seen = new Set<string>()
    const unique = (leads || []).filter((l: any) => {
      const key = String(l.telefone).replace(/\D/g, '').slice(-9)
      if (!key || seen.has(key)) return false
      seen.add(key); return true
    })
    if (!unique.length) throw new SdDialerError('Não há leads com esses estados para ligar.', 400)

    const { data: campaign, error } = await admin.from('call_campaigns').insert({
      company_id: profile.company_id, created_by: user.id, name, agent_id: 'lumin-telecom',
      status: 'paused', concurrency, calls_per_hour: callsPerHour, window_start: windowStart, window_end: windowEnd,
      last_note: 'Criada. Carrega em Play para começar.',
    }).select('*').single()
    if (error || !campaign) throw new SdDialerError('Não foi possível criar a campanha.', 500)
    for (let i = 0; i < unique.length; i += 500) {
      const part = unique.slice(i, i + 500).map((l: any, idx: number) => ({ campaign_id: campaign.id, lead_id: l.id, position: i + idx }))
      const { error: insertError } = await admin.from('call_campaign_leads').insert(part)
      if (insertError) throw new SdDialerError('Não foi possível carregar as leads na campanha.', 500)
    }
    return NextResponse.json({ campaign, leads: unique.length })
  } catch (error) {
    return errorResponse(error, 'campanhas-chamadas POST')
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { admin, user, profile } = await requireSdDialerUser(request)
    assertManager(profile)
    const body = await request.json().catch(() => ({})) as any
    const action = String(body.action || '')
    const next = ({ play: 'running', pause: 'paused', stop: 'stopped' } as Record<string, string>)[action]
    if (!next) throw new SdDialerError('Ação inválida.', 400)
    const { data: campaign } = await admin.from('call_campaigns').select('*').eq('id', String(body.id || '')).eq('company_id', profile.company_id).maybeSingle()
    if (!campaign) throw new SdDialerError('Campanha não encontrada.', 404)
    if (!isManager(profile) && campaign.created_by !== user.id) throw new SdDialerError('Sem permissão para esta campanha.', 403)
    if (campaign.status === 'done' || campaign.status === 'stopped') throw new SdDialerError('Esta campanha já terminou.', 409)
    if (next === 'running') await requireVoiceCallAccess(admin, user.id, profile)
    const note = next === 'running' ? 'Em execução. A primeira chamada sai no próximo minuto.' : next === 'paused' ? 'Em pausa. A chamada atual termina normalmente.' : 'Parada.'
    await admin.from('call_campaigns').update({ status: next, last_note: note, updated_at: new Date().toISOString() }).eq('id', campaign.id)
    if (next === 'stopped') await admin.from('call_campaign_leads').update({ state: 'skipped', note: 'campanha parada', updated_at: new Date().toISOString() }).eq('campaign_id', campaign.id).eq('state', 'pending')
    return NextResponse.json({ ok: true, status: next })
  } catch (error) {
    return errorResponse(error, 'campanhas-chamadas PATCH')
  }
}
