import { NextRequest, NextResponse } from 'next/server'
import {
  associateExistingCallerId,
  beginCompanyCallerIdVerification,
  CallerIdError,
  completeCompanyCallerIdVerification,
  findCallerIdAssociation,
  getDefaultTwilioCallerId,
  isTwilioCallerIdVerified,
  listCompanyCallerIds,
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
    const profile = await requireSdCallerIdUser(request)
    const [twilioCallerIds, companyCallerIds] = await Promise.all([
      listTwilioCallerIds(request.nextUrl.searchParams.get('refresh') === '1'),
      listCompanyCallerIds(profile.company_id),
    ])
    const available = new Map(twilioCallerIds.map((callerId) => [callerId.phoneNumber, callerId]))
    const callerIds = companyCallerIds.flatMap((companyCallerId) => {
      const callerId = available.get(companyCallerId.phone_number)
      return callerId
        ? [{ ...callerId, friendlyName: companyCallerId.friendly_name || callerId.friendlyName }]
        : []
    })
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
    const profile = await requireSdCallerIdUser(request)
    const body = await request.json().catch(() => ({})) as {
      action?: unknown
      phone_number?: unknown
      friendly_name?: unknown
      method?: unknown
    }

    const phoneNumber = normalizeCallerId(body.phone_number)
    const friendlyName = String(body.friendly_name || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 64) || phoneNumber.replace(/\D/g, '')

    if (body.action === 'complete') {
      await completeCompanyCallerIdVerification(profile, phoneNumber)
      return NextResponse.json({ ok: true, phoneNumber })
    }

    if (body.action === 'associate_existing') {
      await associateExistingCallerId(profile, phoneNumber, friendlyName)
      return NextResponse.json({ ok: true, phoneNumber, alreadyVerified: true })
    }

    if (body.action !== 'begin') {
      return NextResponse.json({ error: 'Ação de Caller ID inválida.' }, { status: 400 })
    }
    if (body.method !== 'sms' && body.method !== 'call') {
      return NextResponse.json({ error: 'Escolhe SMS ou chamada para verificar o número.' }, { status: 400 })
    }

    const current = await findCallerIdAssociation(phoneNumber)
    if (current && current.company_id !== profile.company_id) {
      return NextResponse.json({ error: 'Este número já está associado a outra empresa.' }, { status: 409 })
    }
    if (current?.status === 'verified') {
      return NextResponse.json({ ok: true, phoneNumber, alreadyLinked: true })
    }
    if (await isTwilioCallerIdVerified(phoneNumber, true)) {
      if (current?.status === 'pending') {
        await completeCompanyCallerIdVerification(profile, phoneNumber)
        return NextResponse.json({ ok: true, phoneNumber, alreadyLinked: true })
      }
      return NextResponse.json({
        error: 'Este número já está verificado na Twilio. Um administrador da empresa deve associá-lo em “Já verificado”.',
      }, { status: 409 })
    }

    await beginCompanyCallerIdVerification(
      profile,
      phoneNumber,
      friendlyName,
      body.method,
    )

    if (body.method === 'sms') {
      return NextResponse.json({
        ok: true,
        phoneNumber,
        consoleUrl: 'https://console.twilio.com/us1/develop/phone-numbers/manage/verified-caller-ids',
        message: 'Conclui a verificação por SMS no Console Twilio e depois atualiza a lista.',
      }, { status: 202 })
    }

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
