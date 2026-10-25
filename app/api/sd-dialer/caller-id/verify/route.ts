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
      throw new SdDialerError('A validação de números pessoais não está configurada na Twilia.', 503)
    }

    const body = await request.json().catch(() => ({})) as { phone?: string }
    const phoneNumber = normalizePtPhone(body.phone)
    if (!phoneNumber) {
      throw new SdDialerError('Número inválido. Usa o formato internacional, por exemplo +351912345678.', 400)
    }

    const { data: claimed, error: claimedError } = await admin
      .from('sd_dialer_caller_ids')
      .select('id,user_id,verification_status')
      .eq('phone_number', phoneNumber)
      .in('verification_status', ['pending', 'verified'])
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

    const { data: pendingForUser, error: pendingError } = await admin
      .from('sd_dialer_caller_ids')
      .select('id,phone_number,requested_at,created_at')
      .eq('user_id', user.id)
      .eq('verification_status', 'pending')
      .maybeSingle()
    if (pendingError) throw new SdDialerError('Não foi possível consultar outra validação em curso.', 500)
    if (pendingForUser && pendingForUser.phone_number !== phoneNumber) {
      const ageMs = Date.now() - new Date(pendingForUser.requested_at || pendingForUser.created_at).getTime()
      if (ageMs <= 10 * 60 * 1000) {
        throw new SdDialerError('Já tens uma validação em curso. Termina-a ou espera 10 minutos antes de pedir outra.', 409)
      }
      const { error } = await admin
        .from('sd_dialer_caller_ids')
        .update({ verification_status: 'failed', is_active: false, validation_code: null })
        .eq('id', pendingForUser.id)
      if (error) throw new SdDialerError('Não foi possível fechar a validação anterior.', 500)
    }

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
          message: 'Atende à chamada da Twilia e introduz o código no teclado do telefone.',
        })
      }
    }

    const alreadyVerified = await findTwilioOutgoingCallerId(phoneNumber)
    const now = new Date().toISOString()
    if (alreadyVerified?.sid) {
      let recordId = existing?.id ? String(existing.id) : ''
      if (!recordId) {
        const { data: inserted, error } = await admin
          .from('sd_dialer_caller_ids')
          .insert({
            user_id: user.id,
            company_id: profile.company_id,
            phone_number: phoneNumber,
            verification_status: 'pending',
            is_active: false,
            validation_code: null,
            requested_at: now,
          })
          .select('id')
          .single()
        if (error || !inserted?.id) throw new SdDialerError('Não foi possível associar o número já validado.', 500)
        recordId = String(inserted.id)
      } else if (existing.verification_status !== 'pending') {
        const { error } = await admin
          .from('sd_dialer_caller_ids')
          .update({ verification_status: 'pending', is_active: false, validation_code: null, requested_at: now })
          .eq('id', recordId)
        if (error) throw new SdDialerError('Não foi possível preparar a ativação do número.', 500)
      }
      const { error } = await admin.rpc('activate_sd_dialer_caller_id', {
        p_verification_id: recordId,
        p_twilio_sid: String(alreadyVerified.sid),
      })
      if (error) throw new SdDialerError('A Twilia já validou este número, mas não foi possível ativá-lo.', 500)
      return NextResponse.json({ ok: true, status: 'verified', phoneNumber })
    }

    const verification = await startTwilioCallerIdVerification(
      phoneNumber,
      String(profile.full_name || user.email || phoneNumber),
    )
    if (!verification.validationCode) {
      throw new SdDialerError('A Twilia iniciou a chamada, mas não devolveu o código de validação.', 502)
    }

    const values = {
      verification_status: 'pending',
      is_active: false,
      validation_code: verification.validationCode,
      twilio_call_sid: verification.callSid || null,
      requested_at: now,
      verified_at: null,
    }
    const saved = existing
      ? await admin.from('sd_dialer_caller_ids').update(values).eq('id', existing.id).select('id').single()
      : await admin.from('sd_dialer_caller_ids').insert({
          user_id: user.id,
          company_id: profile.company_id,
          phone_number: phoneNumber,
          ...values,
        }).select('id').single()
    if (saved.error) throw new SdDialerError('A Twilia ligou para iniciar a validação, mas não foi possível guardar o pedido.', 500)

    return NextResponse.json({
      ok: true,
      status: 'pending',
      phoneNumber,
      validationCode: verification.validationCode,
      callSid: verification.callSid,
      message: 'Atende à chamada da Twilia e introduz o código no teclado do telefone.',
    })
  } catch (error) {
    return errorResponse(error, 'caller ID verification POST')
  }
}
