import { NextRequest, NextResponse } from 'next/server'
import {
  errorResponse,
  findTwilioOutgoingCallerId,
  isTwilioCallerIdConfigured,
  normalizePtPhone,
  requireSdDialerUser,
  SdDialerError,
  startTwilioCallerIdVerification,
} from '@/lib/server/sd-dialer-livekit'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const { admin, user, profile } = await requireSdDialerUser(request)
    if (!isTwilioCallerIdConfigured()) {
      throw new SdDialerError('A validação de números pessoais não está configurada na Twilio.', 503)
    }

    const body = await request.json().catch(() => ({})) as { phone?: string }
    const phoneNumber = normalizePtPhone(body.phone)
    if (!phoneNumber) {
      throw new SdDialerError('Número inválido. Usa o formato internacional, por exemplo +351912345678.', 400)
    }

    const { data: claimed, error: claimedError } = await admin
      .from('sd_dialer_caller_ids')
      .select('id,user_id,verification_status,is_active')
      .eq('phone_number', phoneNumber)
      .eq('verification_status', 'verified')
      .neq('user_id', user.id)
      .limit(1)
      .maybeSingle()
    if (claimedError) throw new SdDialerError('Não foi possível confirmar se este número já está associado.', 500)
    if (claimed) throw new SdDialerError('Este número já está associado a outro utilizador do SD Dialer.', 409)

    const { data: existing, error: existingError } = await admin
      .from('sd_dialer_caller_ids')
      .select('id,phone_number,verification_status,is_active,validation_code,requested_at,created_at,twilio_call_sid')
      .eq('user_id', user.id)
      .eq('company_id', profile.company_id)
      .eq('phone_number', phoneNumber)
      .maybeSingle()
    if (existingError) throw new SdDialerError('Não foi possível consultar o número já registado.', 500)

    if (existing?.verification_status === 'verified' && existing.is_active) {
      return NextResponse.json({ ok: true, status: 'verified', phoneNumber })
    }

    if (existing?.verification_status === 'pending' && existing.validation_code) {
      const ageMs = Date.now() - new Date(existing.requested_at || existing.created_at).getTime()
      if (ageMs <= 10 * 60 * 1000) {
        return NextResponse.json({
          ok: true,
          status: 'pending',
          phoneNumber,
          validationCode: String(existing.validation_code),
          message: 'Atende à chamada da Twilio e introduz o código no teclado do telefone.',
        })
      }
    }

    const alreadyVerified = await findTwilioOutgoingCallerId(phoneNumber)
    const now = new Date().toISOString()
    if (alreadyVerified) {
      await admin
        .from('sd_dialer_caller_ids')
        .update({ is_active: false, updated_at: now })
        .eq('user_id', user.id)
        .eq('company_id', profile.company_id)
      const values = {
        verification_status: 'verified',
        is_active: true,
        validation_code: null,
        twilio_call_sid: null,
        requested_at: now,
        verified_at: now,
        updated_at: now,
      }
      const saved = existing
        ? await admin.from('sd_dialer_caller_ids').update(values).eq('id', existing.id).select('id').single()
        : await admin.from('sd_dialer_caller_ids').insert({
            user_id: user.id,
            company_id: profile.company_id,
            phone_number: phoneNumber,
            ...values,
          }).select('id').single()
      if (saved.error) throw new SdDialerError('A Twilio já tem este número validado, mas não foi possível guardá-lo no SD Dialer.', 500)
      return NextResponse.json({ ok: true, status: 'verified', phoneNumber })
    }

    const verification = await startTwilioCallerIdVerification(
      phoneNumber,
      String(profile.full_name || user.email || phoneNumber),
    )
    if (!verification.validationCode) {
      throw new SdDialerError('A Twilio iniciou a chamada, mas não devolveu o código de validação. Tenta novamente.', 502)
    }

    const values = {
      verification_status: 'pending',
      is_active: false,
      validation_code: verification.validationCode,
      twilio_call_sid: verification.callSid || null,
      requested_at: now,
      verified_at: null,
      updated_at: now,
    }
    const saved = existing
      ? await admin.from('sd_dialer_caller_ids').update(values).eq('id', existing.id).select('id').single()
      : await admin.from('sd_dialer_caller_ids').insert({
          user_id: user.id,
          company_id: profile.company_id,
          phone_number: phoneNumber,
          ...values,
        }).select('id').single()
    if (saved.error) throw new SdDialerError('A Twilio ligou para iniciar a validação, mas não foi possível guardar o pedido.', 500)

    return NextResponse.json({
      ok: true,
      status: 'pending',
      phoneNumber,
      validationCode: verification.validationCode,
      callSid: verification.callSid,
      message: 'Atende à chamada da Twilio e introduz o código no teclado do telefone.',
    })
  } catch (error) {
    return errorResponse(error, 'caller ID verification POST')
  }
}
