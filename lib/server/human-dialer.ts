import { AccessToken } from 'livekit-server-sdk'
import { getLiveKitConfig, normalizePtPhone, resolveCallerId, SdDialerError } from '@/lib/server/sd-dialer-livekit'
import { withinCallingHours } from '@/lib/server/sd-dialer-call'
import { isOptedOut } from '@/lib/server/voice-call-outcome'

// Marcador para pessoas (parceiros/consultores): o browser entra numa sala LiveKit e o servidor
// liga às leads pelo mesmo trunk e número de saída do robot. Quando a lead atende, fala com a pessoa.

const OPEN = ['novo', 'nao_atende', 'ligar_depois']
const BLOCKED = new Set(['nao_interessado', 'desligado', 'numero_errado', 'numero_nao_atribuido', 'pertence_outra_pessoa', 'vendido'])
const MANAGERS = new Set(['admin', 'supervisor', 'super_admin'])
const RECALL_MS = 12 * 60 * 60 * 1000

export type Filters = { statuses?: string[]; localidade?: string; operador?: string; campanha_id?: string }
type Profile = { company_id: string; role?: string; is_super_admin?: boolean | null }

const roomFor = (userId: string) => 'sd-human-' + userId

export async function startSession(admin: any, userId: string, profile: Profile) {
  await resolveCallerId(admin, userId, profile.company_id, profile.is_super_admin === true || profile.role === 'super_admin')
  const { api } = getLiveKitConfig()
  const room = roomFor(userId)
  // Fecha chamadas que ficaram abertas (aba fechada a meio).
  await admin.from('voice_calls').update({ status: 'failed', error_message: 'Sessão interrompida.', ended_at: new Date().toISOString() })
    .eq('created_by', userId).eq('source', 'sd-dialer-human').is('ended_at', null)
  await api.room.createRoom({ name: room, emptyTimeout: 30, departureTimeout: 20 }).catch(() => null)
  const key = process.env.LIVEKIT_API_KEY!, secret = process.env.LIVEKIT_API_SECRET!
  const token = new AccessToken(key, secret, { identity: 'consultor-' + userId, ttl: 4 * 3600 })
  token.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true })
  return { token: await token.toJwt(), url: process.env.LIVEKIT_URL, room }
}

export async function nextCall(admin: any, userId: string, profile: Profile, filters: Filters, exclude: string[]) {
  const superAdmin = profile.is_super_admin === true || profile.role === 'super_admin'
  if (!superAdmin && !withinCallingHours()) throw new SdDialerError('Fora do horário permitido (seg–sáb, 09:00–21:00).', 409)
  const { data: settings } = await admin.from('voice_settings').select('stop_calls,max_calls_per_hour').eq('company_id', profile.company_id).maybeSingle()
  if (settings?.stop_calls === true && !superAdmin) throw new SdDialerError('As chamadas estão pausadas pelo superadministrador.', 423)
  const { count: open } = await admin.from('voice_calls').select('id', { count: 'exact', head: true })
    .eq('created_by', userId).eq('source', 'sd-dialer-human').is('ended_at', null).gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
  if (open) throw new SdDialerError('Termina a chamada atual antes de passar à seguinte.', 409)
  const perHour = Number(settings?.max_calls_per_hour || 0)
  if (perHour > 0) {
    const { count } = await admin.from('voice_calls').select('id', { count: 'exact', head: true })
      .eq('company_id', profile.company_id).eq('created_by', userId).gte('created_at', new Date(Date.now() - 3600_000).toISOString())
    if ((count || 0) >= perHour) throw new SdDialerError('Atingiste o limite de chamadas por hora.', 429)
  }

  const callerId = (await resolveCallerId(admin, userId, profile.company_id, superAdmin)).phoneNumber
  const statuses = (filters.statuses?.length ? filters.statuses : OPEN).filter(s => OPEN.includes(s))
  let q = admin.from('leads').select('id,nome,telefone,status,localidade,operador,observacoes,campanha_id')
    .eq('company_id', profile.company_id).in('status', statuses.length ? statuses : OPEN).not('telefone', 'is', null)
  if (!(superAdmin || MANAGERS.has(String(profile.role)))) q = q.eq('assigned_to', userId)
  if (filters.campanha_id) q = q.eq('campanha_id', filters.campanha_id)
  const loc = String(filters.localidade || '').replace(/[%,]/g, '').trim(); if (loc) q = q.ilike('localidade', '%' + loc + '%')
  const op = String(filters.operador || '').replace(/[%,]/g, '').trim(); if (op) q = q.ilike('operador', '%' + op + '%')
  const skip = exclude.filter(x => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 500)
  if (skip.length) q = q.not('id', 'in', '(' + skip.join(',') + ')')
  const { data: candidates } = await q.order('created_at', { ascending: true }).limit(40)

  const livekit = getLiveKitConfig()
  for (const lead of candidates || []) {
    if (BLOCKED.has(String(lead.status || '').toLowerCase())) continue
    const destination = normalizePtPhone(String(lead.telefone))
    if (!destination) continue
    const { count: recent } = await admin.from('voice_calls').select('id', { count: 'exact', head: true })
      .eq('lead_id', lead.id).gte('created_at', new Date(Date.now() - RECALL_MS).toISOString())
    if (recent) continue
    if (await isOptedOut(admin, String(profile.company_id), destination)) continue

    const callId = crypto.randomUUID()
    const room = roomFor(userId)
    const now = new Date().toISOString()
    const { error } = await admin.from('voice_calls').insert({
      id: callId, company_id: profile.company_id, client_name: lead.nome || null, phone_number: destination,
      status: 'ringing', livekit_room: room, livekit_participant: 'sip-' + callId, conversation_state: { mode: 'human' },
      created_by: userId, lead_id: lead.id, source: 'sd-dialer-human', started_at: now, recording_enabled: false,
    })
    if (error) throw new SdDialerError('Não foi possível registar a chamada.', 500)
    try {
      await livekit.api.sip.createSipParticipant(livekit.trunkId, destination, room, {
        fromNumber: callerId, participantIdentity: 'sip-' + callId, participantName: lead.nome || 'Contacto',
        waitUntilAnswered: false, ringingTimeout: 30, maxCallDuration: 1800,
      })
    } catch {
      await admin.from('voice_calls').update({ status: 'failed', error_message: 'Falha ao ligar.', ended_at: new Date().toISOString() }).eq('id', callId)
      throw new SdDialerError('Não foi possível ligar. Tenta outra vez.', 502)
    }
    return { callId, identity: 'sip-' + callId, lead: { id: lead.id, nome: lead.nome, telefone: destination, localidade: lead.localidade, operador: lead.operador, observacoes: lead.observacoes } }
  }
  return { empty: true as const }
}

const RESULTS: Record<string, { lead?: string; interest?: string; status: string; dnc?: boolean }> = {
  interessado: { lead: 'contactado', interest: 'alto', status: 'answered' },
  ligar_depois: { lead: 'ligar_depois', interest: 'baixo', status: 'answered' },
  sem_interesse: { lead: 'nao_interessado', interest: 'sem_interesse', status: 'answered' },
  nao_atendeu: { lead: 'nao_atende', status: 'failed' },
  caixa_voz: { lead: 'nao_atende', interest: 'correio_voz', status: 'voicemail' },
  numero_errado: { lead: 'numero_errado', status: 'answered' },
  nao_ligar: { lead: 'nao_interessado', interest: 'sem_interesse', status: 'answered', dnc: true },
}

export async function finishCall(admin: any, userId: string, profile: Profile, callId: string, result: string, note?: string) {
  const def = RESULTS[result]
  if (!def) throw new SdDialerError('Resultado inválido.', 400)
  const { data: call } = await admin.from('voice_calls').select('id,lead_id,company_id,phone_number,livekit_room,started_at,created_by,ended_at')
    .eq('id', callId).eq('company_id', profile.company_id).maybeSingle()
  if (!call || call.created_by !== userId) throw new SdDialerError('Chamada não encontrada.', 404)
  try { await getLiveKitConfig().api.room.removeParticipant(call.livekit_room, 'sip-' + callId) } catch { /* já terminou */ }
  const now = new Date()
  const duration = def.status === 'failed' ? 0 : Math.max(0, Math.round((now.getTime() - new Date(call.started_at).getTime()) / 1000))
  await admin.from('voice_calls').update({
    status: def.status, ended_at: call.ended_at || now.toISOString(), duration_seconds: duration, interest_level: def.interest || null,
    summary: (note || '').slice(0, 500) || ({ interessado: 'Interessado (chamada humana).', ligar_depois: 'Ligar mais tarde.', sem_interesse: 'Sem interesse.', nao_atendeu: 'Não atendeu.', caixa_voz: 'Caixa de voz.', numero_errado: 'Número errado.', nao_ligar: 'Pediu para não ser contactado.' } as any)[result],
    error_message: result === 'nao_atendeu' ? 'Não atendeu.' : null, updated_at: now.toISOString(),
  }).eq('id', callId)
  if (def.dnc && call.phone_number) {
    const { data: ex } = await admin.from('voice_opt_outs').select('id').eq('company_id', call.company_id).eq('phone_number', call.phone_number).maybeSingle()
    if (!ex) await admin.from('voice_opt_outs').insert({ company_id: call.company_id, phone_number: call.phone_number, reason: 'Pedido do cliente (chamada humana)', call_id: callId })
  }
  if (call.lead_id && def.lead) {
    const { data: lead } = await admin.from('leads').select('id,status').eq('id', call.lead_id).maybeSingle()
    const cur = String(lead?.status || '').toLowerCase()
    if (lead && cur !== 'vendido' && (OPEN.includes(cur) || def.dnc || result === 'numero_errado' || result === 'interessado')) {
      await admin.from('leads').update({ status: def.lead, updated_at: now.toISOString() }).eq('id', lead.id)
    }
  }
  return { ok: true }
}
