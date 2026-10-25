import { NextRequest, NextResponse } from 'next/server'
import {
  buildAgentProfile,
  errorResponse,
  getLiveKitConfig,
  normalizePtPhone,
  requireSdDialerUser,
  SdDialerError,
} from '@/lib/server/sd-dialer-livekit'

export const runtime = 'nodejs'
export const maxDuration = 60

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

export async function POST(request: NextRequest) {
  let admin: any = null
  let callId = ''
  let roomName = ''
  let sipIdentity = ''
  let participantCreated = false
  let api: ReturnType<typeof getLiveKitConfig>['api'] | null = null

  try {
    const auth = await requireSdDialerUser(request)
    admin = auth.admin
    const body = await request.json().catch(() => ({})) as {
      lead_id?: string
      phone?: string
      name?: string
      consent_confirmed?: boolean
      agent_id?: string
    }

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
        .eq('company_id', auth.profile.company_id)
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

    const { data: company } = await admin
      .from('companies')
      .select('name')
      .eq('id', auth.profile.company_id)
      .maybeSingle()
    const companyName = String(company?.name || 'Lumin')

    if (!leadId) {
      const { data: newLead, error: insertLeadError } = await admin
        .from('leads')
        .insert({
          company_id: auth.profile.company_id,
          assigned_to: auth.user.id,
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

    const callerId = String(process.env.LUMIN_CALLER_ID || '').trim()
    if (!callerId) throw new SdDialerError('O número de saída da empresa não está configurado.', 503)

    const livekit = getLiveKitConfig()
    api = livekit.api
    const now = new Date().toISOString()
    callId = crypto.randomUUID()
    roomName = 'sd-dialer-' + callId
    sipIdentity = 'sip-' + callId
    const source = body.lead_id ? 'sd-dialer' : 'sd-dialer-manual'
    const agentProfile = buildAgentProfile(agentId, companyName)
    const metadata = {
      mode: 'outbound',
      callId,
      phone: destination,
      name,
      source,
      leadId,
      companyId: auth.profile.company_id,
      requestedBy: auth.user.id,
      agentProfile,
    }

    const { error: insertCallError } = await admin.from('voice_calls').insert({
      id: callId,
      company_id: auth.profile.company_id,
      client_name: name || null,
      phone_number: destination,
      status: 'ringing',
      livekit_room: roomName,
      livekit_participant: sipIdentity,
      created_by: auth.user.id,
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
          ringingTimeout: 45,
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

      await api.agentDispatch.createDispatch(roomName, livekit.agentName, {
        metadata: JSON.stringify(metadata),
      })

      return NextResponse.json({
        ok: true,
        callId,
        status: 'ringing',
        roomName,
        callerId,
      })
    } catch (error) {
      console.error('[sd-dialer] LiveKit outbound call failed', error instanceof Error ? error.message : 'unknown error')

      if (participantCreated && api) {
        try {
          await api.room.removeParticipant(roomName, sipIdentity)
        } catch {
          // The call may already have ended.
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
  } catch (error) {
    return errorResponse(error, 'call POST')
  }
}

[executed on device: LuminAI (a8ce5ed1-2d12-42b0-9a33-2bf4b649b392)]