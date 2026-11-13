import { NextRequest, NextResponse } from 'next/server'
import { errorResponse, requireSdDialerUser, requireVoiceCallAccess, SdDialerError } from '@/lib/server/sd-dialer-livekit'
import { finishCall, nextCall, startSession } from '@/lib/server/human-dialer'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const { admin, user, profile } = await requireSdDialerUser(request)
    await requireVoiceCallAccess(admin, user.id, profile)
    const body = await request.json().catch(() => ({})) as any
    switch (String(body.action || '')) {
      case 'session': return NextResponse.json(await startSession(admin, user.id, profile))
      case 'next': return NextResponse.json(await nextCall(admin, user.id, profile, body.filters || {}, Array.isArray(body.exclude) ? body.exclude.map(String) : []))
      case 'finish': return NextResponse.json(await finishCall(admin, user.id, profile, String(body.callId || ''), String(body.result || ''), body.note ? String(body.note) : undefined))
      default: throw new SdDialerError('Ação inválida.', 400)
    }
  } catch (error) {
    return errorResponse(error, 'dialer-humano')
  }
}
