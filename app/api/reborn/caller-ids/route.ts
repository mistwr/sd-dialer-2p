import { NextRequest, NextResponse } from 'next/server'
import {
  CallerIdError,
  getDefaultTwilioCallerId,
  listTwilioCallerIds,
  normalizeCallerId,
  requireSdCallerIdUser,
  startTwilioCallerIdVerification,
} from '@/lib/server/twilio-caller-ids'

export const dynamic = 'force-dynamic'

function errorResponse(error: unknown) {
  if (error instanceof CallerIdError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  console.error('[caller-ids]', error)
  return NextResponse.json({ error: 'Erro ao gerir os Caller IDs.' }, { status: 500 })
}

export async function GET(request: NextRequest) {
  try {
    await requireSdCallerIdUser(request)
    const callerIds = await listTwilioCallerIds(request.nextUrl.searchParams.get('refresh') === '1')
    return NextResponse.json({
      callerIds,
      defaultCallerId: getDefaultTwilioCallerId(),
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireSdCallerIdUser(request)
    const body = await request.json().catch(() => ({})) as {
      phone_number?: unknown
      friendly_name?: unknown
      method?: unknown
    }

    if (body.method === 'sms') {
      return NextResponse.json({
        error: 'A Twilio disponibiliza a verificação de Caller ID por SMS no Console. Depois de confirmar o número, atualiza a lista nesta página.',
        consoleUrl: 'https://console.twilio.com/us1/develop/phone-numbers/manage/verified-caller-ids',
      }, { status: 409 })
    }
    if (body.method !== 'call') {
      return NextResponse.json({ error: 'Escolhe SMS ou chamada para verificar o número.' }, { status: 400 })
    }

    const phoneNumber = normalizeCallerId(body.phone_number)
    const friendlyName = String(body.friendly_name || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 64) || phoneNumber.replace(/\D/g, '')
    const verification = await startTwilioCallerIdVerification(phoneNumber, friendlyName)

    return NextResponse.json({
      ok: true,
      phoneNumber,
      callSid: verification.callSid,
      validationCode: verification.validationCode,
      message: 'Atende à chamada da Twilio e introduz o código mostrado nesta página.',
    }, { status: 202 })
  } catch (error) {
    return errorResponse(error)
  }
}
