import { NextRequest, NextResponse } from 'next/server'
import {
  errorResponse,
  requireSdDialerUser,
  requireVoiceCallAccess,
} from '@/lib/server/sd-dialer-livekit'
import { startOutboundCall, type OutboundCallBody } from '@/lib/server/sd-dialer-call'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSdDialerUser(request)
    await requireVoiceCallAccess(auth.admin, auth.user.id, auth.profile)
    const body = await request.json().catch(() => ({})) as OutboundCallBody
    return NextResponse.json(await startOutboundCall(auth.admin, auth.user.id, auth.profile, body))
  } catch (error) {
    return errorResponse(error, 'call POST')
  }
}
