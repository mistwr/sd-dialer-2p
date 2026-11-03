import {
  buildAgentProfile,
  getLiveKitConfig,
  normalizePtPhone,
  resolveCallerId,
  SdDialerError,
} from '@/lib/server/sd-dialer-livekit'

// Lógica comum para iniciar uma chamada de IA (usada pela app SD Dialer e pelo LUMIN Comando).

const BLOCKED_LEAD_STATUSES = new Set([
  'nao_interessado',
  'desligado',
  'numero_errado',
  'numero_nao_atribuido',
  'pertence_outra_pessoa',
  'vendido',
])

const AGENT_IDS = new Set(['lumin-telecom', 'lumin-energia', 'lumin-ai'])

function normalizedStatus(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
}

const AGENT_KIND = 4 // ParticipantInfo_Kind.AGENT
const SIP_KIND = 3 // ParticipantInfo_Kind.SIP

async function waitForAgent(api: any, roomName: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const participants = await api.room.listParticipants(roomName)
      if (participants.some((p: any) => Number(p.kind) === AGENT_KIND || String(p.identity || '').startsWith('agent-'))) return true
    } catch {
      // a sala pode ainda não existir
    }
    await new Promise(resolve => setTimeout(resolve, 700))
  }
  return false
}

/** Atualiza o estado de uma chamada a partir do LiveKit (funciona mesmo que o agente não escreva no Supabase). */
export async function reconcileCall(admin: any, call: { id: string; status?: string | null; livekit_room?: string | null; started_at?: string | null; created_at?: string | null; ended_at?: string | null }) {
  const status = String(call.status || '')
  if (call.ended_at || !call.livekit_room || !['ringing', 'dialing', 'queued', 'active'].includes(status)) return status
  let sipStatus = ''
  let roomExists = true
  try {
    const { api } = getLiveKitConfig()
    const participants = await api.room.listParticipants(call.livekit_room)
    const sip = participants.find((p: any) => Number(p.kind) === SIP_KIND || String(p.identity || '').startsWith('sip-'))
    sipStatus = String(sip?.attributes?.['sip.callStatus'] || (sip ? 'present' : ''))
  } catch {
    roomExists = false
  }
  const now = new Date().toISOString()
  if (sipStatus === 'active' && status !== 'active') {
    await admin.from('voice_calls').update({ status: 'active', started_at: now, updated_at: now }).eq('id', call.id)
    return 'active'
  }
  if (status === 'active' && (!roomExists || !sipStatus || sipStatus === 'hangup')) {
    const began = new Date(call.started_at || call.created_at || now).getTime()
    await admin.from('voice_calls').update({
      status: 'answered',
      ended_at: now,
      duration_seconds: Math.max(0, Math.round((Date.now() - began) / 1000)),
      updated_at: now,
    }).eq('id', call.id)
    return 'answered'
  }
  return status
}

export type OutboundCallBody = {
  lead_id?: string
  phone?: string
  name?: string
  consent_confirmed?: boolean
  agent_id?: string
}

export async function startOutboundCall(
  admin: any,
  userId: string,
  profile: { company_id: string; role?: string; is_super_admin?: boolean | null },
  body: OutboundCallBody,
  options: { profileOverrides?: Record<string, unknown> } = {},
) {
  let callId = ''
  let roomName = ''
  let sipIdentity = ''
  let participantCreated = false
  let dispatchId = ''
  let api: ReturnType<typeof getLiveKitConfig>['api'] | null = null

  const agentId = AGENT_IDS.has(String(body.agent_id || ''))
    ? String(body.agent_id)
    : 'lumin-telecom'

  let leadId = ''
  let name = String(body.name || '').trim().slice(0, 120)
  let phone = ''

  if (body.lead_id) {
    const { data: lead, error: leadError } = await admin
      .from('leads')
      .select('id,nome,telefone,status,assigned_to,company_id,campanha_id,operador,observacoes')
      .eq('id', body.lead_id)
      .eq('company_id', profile.company_id)
      .maybeSingle()

    if (leadError) throw new SdDialerError('Não foi possível consultar a lead selecionada.', 500)
    if (!lead) throw new SdDialerError('Lead não encontrada na empresa deste utilizador.', 404)
    if (!lead.telefone) throw new SdDialerError('A lead não tem um número de telefone válido.', 400)
    if (BLOCKED_LEAD_STATUSES.has(normalizedStatus(lead.status))) {
      throw new SdDialerError('Esta lead está bloqueada para chamadas.', 409)
    }

    leadId = String(lead.id)
    name = String(lead.nome || name || 'Contacto').trim().slice(0, 120)
    phone = String(lead.telefone)
  } else {
    if (body.consent_confirmed !== true) {
      throw new SdDialerError('Confirma que tens autorização para contactar este número.', 400)
    }
    if (!name) throw new SdDialerError('Indica o nome da lead.', 400)
    phone = String(body.phone || '')
  }

  const destination = normalizePtPhone(phone)
  if (!destination) throw new SdDialerError('Número de telefone inválido. Usa o formato internacional, por exemplo +351912345678.', 400)

  const isSuperAdmin = profile.is_super_admin === true || profile.role === 'super_admin'
  const callerIdentity = await resolveCallerId(admin, userId, profile.company_id, isSuperAdmin)
  const callerId = callerIdentity.phoneNumber

  const { data: voiceSettings, error: settingsError } = await admin
    .from('voice_settings')
    .select('stop_calls,max_calls_per_hour')
    .eq('company_id', profile.company_id)
    .maybeSingle()
  if (settingsError) throw new SdDialerError('Não foi possível consultar os limites de chamadas desta empresa.', 500)
  if (voiceSettings?.stop_calls === true && profile.is_super_admin !== true && profile.role !== 'super_admin') {
    throw new SdDialerError('As chamadas de IA estão pausadas pelo superadministrador.', 423)
  }
  const maxCallsPerHour = Number(voiceSettings?.max_calls_per_hour || 0)
  if (Number.isFinite(maxCallsPerHour) && maxCallsPerHour > 0) {
    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count, error: rateError } = await admin
      .from('voice_calls')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', profile.company_id)
      .eq('created_by', userId)
      .gte('created_at', cutoff)
    if (rateError) throw new SdDialerError('Não foi possível consultar o limite horário de chamadas.', 500)
    if ((count || 0) >= maxCallsPerHour) {
      throw new SdDialerError('Atingiste o limite de chamadas de IA por hora definido pelo superadministrador.', 429)
    }
  }

  const { data: company } = await admin
    .from('companies')
    .select('name')
    .eq('id', profile.company_id)
    .maybeSingle()
  const companyName = String(company?.name || 'Lumin')

  if (!leadId) {
    const { data: newLead, error: insertLeadError } = await admin
      .from('leads')
      .insert({
        company_id: profile.company_id,
        assigned_to: userId,
        nome: name,
        telefone: destination,
        status: 'novo',
        origem: 'manual',
      })
      .select('id')
      .single()

    if (insertLeadError || !newLead?.id) {
      throw new SdDialerError('Não foi possível guardar a lead manual no SD Dialer.', 500)
    }
    leadId = String(newLead.id)
  }

  const { data: savedAgent, error: agentConfigError } = await admin
    .from('voice_call_agent_configs')
    .select('config,active')
    .eq('agent_id', agentId)
    .maybeSingle()
  if (agentConfigError) throw new SdDialerError('Não foi possível carregar a configuração do agente.', 500)
  if (savedAgent?.active === false) throw new SdDialerError('Este agente está temporariamente desativado pelo superadministrador.', 409)

  const livekit = getLiveKitConfig()
  api = livekit.api
  const now = new Date().toISOString()
  callId = crypto.randomUUID()
  roomName = 'sd-dialer-' + callId
  sipIdentity = 'sip-' + callId
  const source = body.lead_id ? 'sd-dialer' : 'sd-dialer-manual'
  const agentProfile = buildAgentProfile(agentId, companyName, { ...((savedAgent?.config || {}) as Record<string, unknown>), ...(options.profileOverrides || {}) })
  const metadata = {
    mode: 'outbound',
    callId,
    phone: destination,
    name,
    source,
    leadId,
    companyId: profile.company_id,
    requestedBy: userId,
    agentProfile,
  }

  const { error: insertCallError } = await admin.from('voice_calls').insert({
    id: callId,
    company_id: profile.company_id,
    client_name: name || null,
    phone_number: destination,
    status: 'ringing',
    livekit_room: roomName,
    livekit_participant: sipIdentity,
    // agent_id e uma coluna uuid (FK voice_agents); o agentId aqui e um slug ('lumin-telecom'), por isso guarda-se no estado da conversa.
    conversation_state: { agent_slug: agentId },
    created_by: userId,
    lead_id: leadId,
    source,
    started_at: now,
    recording_enabled: false,
    transcript_consent_status: 'granted',
  })

  if (insertCallError) {
    throw new SdDialerError('Não foi possível criar o registo da chamada no histórico.', 500)
  }

  try {
    // Dispatch the agent first so it is already in the room when the callee answers.
    // Telecom uses the Ricardo agent validated over a real SIP call. Other campaigns retain their configured agent.
    // Todos os perfis vão para o agente validado no LiveKit Cloud (o worker antigo "lumin-web" pode não estar a correr).
    // Para voltar a usar o worker próprio: LIVEKIT_USE_WEB_AGENT=1.
    const selectedAgentName = process.env.LIVEKIT_USE_WEB_AGENT === '1'
      ? livekit.agentName
      : (process.env.LIVEKIT_PRIMARY_AGENT_NAME || process.env.LIVEKIT_TELECOM_AGENT_NAME || 'lumin-compara-lab')
    await api.room.createRoom({ name: roomName, emptyTimeout: 120, departureTimeout: 20 }).catch(() => null)
    const dispatch = await api.agentDispatch.createDispatch(roomName, selectedAgentName, {
      metadata: JSON.stringify(metadata),
    })
    dispatchId = dispatch.id

    // Só marca o número depois de o agente estar na sala: evita chamadas em silêncio quando o agente não arranca.
    const agentReady = await waitForAgent(api, roomName, 15_000)
    if (!agentReady) {
      await api.agentDispatch.deleteDispatch(dispatchId, roomName).catch(() => null)
      await api.room.deleteRoom(roomName).catch(() => null)
      dispatchId = ''
      await admin
        .from('voice_calls')
        .update({
          status: 'failed',
          error_message: `O agente de voz "${selectedAgentName}" não entrou na chamada a tempo. Nenhum número foi marcado.`,
          ended_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', callId)
      throw new SdDialerError('O agente de voz não arrancou a tempo, por isso não liguei ao cliente. Tenta daqui a um minuto; se repetir, o agente está desligado no LiveKit.', 503)
    }

    const sipParticipant = await api.sip.createSipParticipant(
      livekit.trunkId,
      destination,
      roomName,
      {
        fromNumber: callerId,
        participantIdentity: sipIdentity,
        participantName: name || 'Contacto',
        participantMetadata: JSON.stringify(metadata),
        waitUntilAnswered: false,
        ringingTimeout: 80,
        maxCallDuration: 900,
      },
    )
    participantCreated = true

    const sipCallId = String((sipParticipant as any)?.sipCallId || '')
    const { error: updateCallError } = await admin
      .from('voice_calls')
      .update({
        sip_call_id: sipCallId || null,
        livekit_participant: String((sipParticipant as any)?.participantIdentity || sipIdentity),
        updated_at: new Date().toISOString(),
      })
      .eq('id', callId)
    if (updateCallError) console.error('[sd-dialer] Could not attach SIP call ID to call history.')

    return {
      ok: true as const,
      callId,
      status: 'ringing' as const,
      roomName,
    }
  } catch (error) {
    if (error instanceof SdDialerError) throw error
    console.error('[sd-dialer] LiveKit outbound call failed', error instanceof Error ? error.message : 'unknown error')

    if (participantCreated && api) {
      try {
        await api.room.removeParticipant(roomName, sipIdentity)
      } catch {
        // The call may already have ended.
      }
    }

    if (dispatchId && api) {
      try {
        await api.agentDispatch.deleteDispatch(dispatchId, roomName)
      } catch {
        // The agent job may already have finished.
      }
    }

    await admin
      .from('voice_calls')
      .update({
        status: 'failed',
        error_message: 'Não foi possível iniciar a chamada LiveKit.',
        ended_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', callId)

    throw new SdDialerError('Não foi possível iniciar a chamada pela LiveKit. Verifica o histórico antes de tentar novamente.', 502)
  }
}
