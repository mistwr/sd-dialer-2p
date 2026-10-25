import { NextRequest, NextResponse } from 'next/server'
import {
  errorResponse,
  requireSdDialerUser,
  SdDialerError,
} from '@/lib/server/sd-dialer-livekit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{ callId: string }>
}

const TERMINAL_STATUSES = new Set([
  'voicemail',
  'interested',
  'follow_up',
  'transferred',
  'not_interested',
  'do_not_call',
  'sale',
  'callback',
])

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { admin, user, profile } = await requireSdDialerUser(request)
    const { callId } = await context.params
    if (!callId || callId.length > 80) throw new SdDialerError('Identificador de chamada inválido.', 400)

    const { data: call, error } = await admin
      .from('voice_calls')
      .select('id,company_id,created_by,status,error_message,ended_at,started_at,created_at,livekit_room')
      .eq('id', callId)
      .eq('company_id', profile.company_id)
      .maybeSingle()

    if (error) throw new SdDialerError('Não foi possível consultar o histórico da chamada.', 500)
    if (!call) throw new SdDialerError('Chamada não encontrada.', 404)

    const privileged = ['admin', 'supervisor', 'super_admin'].includes(String(profile.role))
    if (call.created_by && call.created_by !== user.id && !privileged) {
      throw new SdDialerError('Não tens acesso a esta chamada.', 403)
    }

    let status = 'ringing'
    if (call.status === 'failed') {
      status = 'failed'
    } else if (call.ended_at || TERMINAL_STATUSES.has(String(call.status))) {
      status = 'ended'
    } else if (call.status === 'active') {
      status = 'connected'
    } else if (call.status === 'answered') {
      status = 'answered'
    } else if (call.status === 'queued') {
      status = 'queued'
    } else if (call.status === 'dialing' || call.status === 'ringing') {
      status = 'ringing'
    }

    const beganAt = call.started_at || call.created_at
    if (status === 'ringing' && beganAt && Date.now() - new Date(beganAt).getTime() > 90_000) {
      const message = 'A chamada não foi atendida ou expirou.'
      await admin
        .from('voice_calls')
        .update({
          status: 'failed',
          error_message: message,
          ended_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', call.id)
      return NextResponse.json({ callId, status: 'failed', error: message })
    }

    return NextResponse.json({
      callId,
      status,
      error: call.error_message || undefined,
    })
  } catch (error) {
    return errorResponse(error, 'call status GET')
  }
}
