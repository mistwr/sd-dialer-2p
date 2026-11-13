import { startOutboundCall, reconcileCall, withinCallingHours } from '@/lib/server/sd-dialer-call'
import { SdDialerError } from '@/lib/server/sd-dialer-livekit'

// Campanhas de chamadas automáticas: o servidor liga às leads da fila enquanto a campanha estiver em "running".
// Um cron (pg_cron, 1 minuto) chama tickCampaigns(). Pausar/Parar = mudar o estado na base de dados.

const LIVE_STATUSES = new Set(['ringing', 'dialing', 'queued', 'active'])
const MAX_LIVE_MS = 12 * 60 * 1000
const RECALL_BLOCK_MS = 12 * 60 * 60 * 1000

function lisbonHour(now = new Date()) {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Lisbon', hour: '2-digit', hour12: false }).format(now)) % 24
}

async function note(admin: any, id: string, text: string, extra: Record<string, unknown> = {}) {
  await admin.from('call_campaigns').update({ last_note: text.slice(0, 240), last_tick_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...extra }).eq('id', id)
}

async function settleCalling(admin: any, campaignId: string) {
  const { data: calling } = await admin.from('call_campaign_leads').select('lead_id,call_id,updated_at').eq('campaign_id', campaignId).eq('state', 'calling')
  let live = 0
  for (const row of calling || []) {
    const { data: call } = await admin
      .from('voice_calls')
      .select('id,status,livekit_room,started_at,created_at,ended_at')
      .eq('id', row.call_id)
      .maybeSingle()
    let status = String(call?.status || '')
    if (call && !call.ended_at && LIVE_STATUSES.has(status)) {
      status = await reconcileCall(admin, call).catch(() => status)
    }
    const age = Date.now() - new Date(row.updated_at).getTime()
    const stillLive = call && LIVE_STATUSES.has(status) && age < MAX_LIVE_MS
    if (stillLive) { live++; continue }
    await admin.from('call_campaign_leads')
      .update({ state: 'done', note: call ? status : 'sem registo da chamada', updated_at: new Date().toISOString() })
      .eq('campaign_id', campaignId).eq('lead_id', row.lead_id)
  }
  return live
}

export async function tickCampaign(admin: any, campaign: any) {
  const id = String(campaign.id)
  if (campaign.status !== 'running') return { id, skipped: 'não está a correr' }

  const { data: company } = await admin.from('companies').select('status').eq('id', campaign.company_id).maybeSingle()
  if (company?.status === 'inactive') {
    await note(admin, id, 'Empresa desativada: campanha parada.', { status: 'stopped' })
    return { id, stopped: 'empresa inativa' }
  }

  const live = await settleCalling(admin, id)

  const { count: pendingCount } = await admin.from('call_campaign_leads').select('lead_id', { count: 'exact', head: true }).eq('campaign_id', id).eq('state', 'pending')
  if (!pendingCount && !live) {
    await note(admin, id, 'Campanha concluída: todas as leads foram contactadas.', { status: 'done' })
    return { id, done: true }
  }
  if (!pendingCount) return { id, waiting: 'a aguardar chamadas ativas' }

  const hour = lisbonHour()
  const inWindow = withinCallingHours() && hour >= campaign.window_start && hour < campaign.window_end
  if (!inWindow) {
    await note(admin, id, 'Fora da janela de horas (' + campaign.window_start + 'h–' + campaign.window_end + 'h, seg–sáb). A retomar sozinha.')
    return { id, waiting: 'fora de horas' }
  }

  const { data: settings } = await admin.from('voice_settings').select('stop_calls,max_calls_per_hour').eq('company_id', campaign.company_id).maybeSingle()
  if (settings?.stop_calls === true) {
    await note(admin, id, 'Chamadas de IA pausadas pelo superadministrador.')
    return { id, waiting: 'stop_calls' }
  }

  // Limite por hora (o menor entre a campanha e o da empresa).
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { data: launched } = await admin.from('call_campaign_leads').select('call_id').eq('campaign_id', id).not('call_id', 'is', null)
  const ids = (launched || []).map((r: any) => r.call_id)
  let lastHour = 0
  if (ids.length) {
    const { count } = await admin.from('voice_calls').select('id', { count: 'exact', head: true }).in('id', ids).gte('created_at', cutoff)
    lastHour = count || 0
  }
  const companyLimit = Number(settings?.max_calls_per_hour || 0)
  const limit = companyLimit > 0 ? Math.min(companyLimit, campaign.calls_per_hour) : campaign.calls_per_hour
  const slots = Math.min(campaign.concurrency - live, limit - lastHour)
  if (slots <= 0) {
    await note(admin, id, live >= campaign.concurrency ? 'A aguardar que a chamada termine.' : 'Limite por hora atingido (' + limit + '). Continua daqui a pouco.')
    return { id, waiting: 'sem vagas' }
  }

  const { data: profile } = await admin.from('usuarios').select('id,company_id,role,is_super_admin').eq('id', campaign.created_by).maybeSingle()
  if (!profile?.company_id) {
    await note(admin, id, 'O utilizador que criou a campanha já não existe: campanha parada.', { status: 'stopped' })
    return { id, error: 'sem utilizador' }
  }

  const { data: next } = await admin.from('call_campaign_leads').select('lead_id').eq('campaign_id', id).eq('state', 'pending').order('position').limit(slots + 20)
  let launchedNow = 0
  for (const row of next || []) {
    if (launchedNow >= slots) break
    const leadId = String(row.lead_id)

    // Não voltar a ligar a quem já foi contactado nas últimas 12 h.
    const since = new Date(Date.now() - RECALL_BLOCK_MS).toISOString()
    const { count: recent } = await admin.from('voice_calls').select('id', { count: 'exact', head: true }).eq('lead_id', leadId).gte('created_at', since)
    if (recent) {
      await admin.from('call_campaign_leads').update({ state: 'skipped', note: 'já contactada nas últimas 12 h', updated_at: new Date().toISOString() }).eq('campaign_id', id).eq('lead_id', leadId)
      continue
    }

    try {
      const result: any = await startOutboundCall(admin, String(campaign.created_by), profile, { lead_id: leadId, agent_id: campaign.agent_id })
      await admin.from('call_campaign_leads').update({ state: 'calling', call_id: result?.callId || result?.call_id || null, updated_at: new Date().toISOString() }).eq('campaign_id', id).eq('lead_id', leadId)
      launchedNow++
    } catch (error) {
      const status = error instanceof SdDialerError ? error.status : 500
      const message = error instanceof Error ? error.message : 'erro'
      // Problemas globais: não consome a lead, tenta de novo no próximo minuto.
      if (status >= 500 || status === 423 || status === 429 || status === 402 || (status === 409 && /hor[áa]rio/i.test(message))) {
        await note(admin, id, 'A tentar de novo: ' + message)
        return { id, retry: message }
      }
      await admin.from('call_campaign_leads').update({ state: 'skipped', note: message.slice(0, 160), updated_at: new Date().toISOString() }).eq('campaign_id', id).eq('lead_id', leadId)
    }
  }
  await note(admin, id, launchedNow ? launchedNow + ' chamada(s) lançada(s).' : 'Sem leads elegíveis neste momento.')
  return { id, launched: launchedNow }
}

export async function tickCampaigns(admin: any) {
  const { data: running } = await admin.from('call_campaigns').select('*').eq('status', 'running')
  const out: any[] = []
  for (const campaign of running || []) {
    out.push(await tickCampaign(admin, campaign).catch((e: any) => ({ id: campaign.id, error: String(e?.message || e) })))
  }
  return out
}
