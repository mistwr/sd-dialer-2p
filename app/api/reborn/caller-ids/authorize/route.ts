import { NextRequest, NextResponse } from 'next/server'
import {
  CallerIdError,
  isTwilioCallerIdVerified,
  normalizeCallerId,
  requireSdCallerIdUser,
} from '@/lib/server/twilio-caller-ids'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    await requireSdCallerIdUser(request)
    const body = await request.json().catch(() => ({})) as { phone_number?: unknown }
    const phoneNumber = normalizeCallerId(body.phone_number)
    const verified = await isTwilioCallerIdVerified(phoneNumber)
    if (!verified) {
      return NextResponse.json({ verified: false, error: 'Caller ID não está verificado na conta Twilio.' }, { status: 403 })
    }
    return NextResponse.json({ verified: true })
  } catch (error) {
    if (error instanceof CallerIdError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[caller-id-authorization]', error)
    return NextResponse.json({ error: 'Não foi possível validar o Caller ID.' }, { status: 500 })
  }
}
