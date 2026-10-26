import { NextRequest, NextResponse } from 'next/server'
import { resolveSharedCallerId } from '@/lib/server/sd-dialer-shared-caller'
import {
  errorResponse,
  findTwilioOutgoingCallerId,
  isTwilioCallerIdConfigured,
  normalizePtPhone,
  requireSdDialerUser,
  SdDialerError,
} from '@/lib/server/sd-dialer-livekit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function publicRecord(row: any, includeCode = false) {
  return {
    id: String(row.id),
    phoneNumber: String(row.phone_number),
    status: row.verification_status === 'verified'
      ? 'verified'
      : row.verification_status === 'failed'
        ? 'failed'
        : 'pending',
    isActive: Boolean(row.is_active && row.verification_status === 'verified'),
    requestedAt: row.requested_at || null,
    verifiedAt: row.verified_at || null,
    ...(includeCode && row.verification_status === 'pending'
      ? { validationCode: String(row.validation_code || '') }
      : {}),
  }
}

export async function GET(request: NextRequest) {
  try {
    const { admin, user, profile } = await requireSdDialerUser(request)
    const loadRows = () => admin
      .from('sd_dialer_caller_ids')
      .select('id,user_id,company_id,phone_number,verification_status,is_active,validation_code,twilio_call_sid,twilio_outgoing_caller_id_sid,requested_at,verified_at,created_at')
      .eq('user_id', user.id)
      .eq('company_id', profile.company_id)
      .order('created_at', { ascending: false })

    const initial = await loadRows()
    if (initial.error) throw new SdDialerError('Não foi possível carregar os números associados a esta conta.', 500)
    let rows: any[] = initial.data || []
    const pending = rows.find(row => row.verification_status === 'pending')

    if (pending && isTwilioCallerIdConfigured()) {
      const ageMs = Date.now() - new Date(pending.requested_at || pending.created_at).getTime()
      if (ageMs > 10 * 60 * 1000) {
        const { error } = await admin
          .from('sd_dialer_caller_ids')
          .update({ verification_status: 'failed', is_active: false, validation_code: null })
          .eq('id', pending.id)
          .eq('user_id', user.id)
        if (error) throw new SdDialerError('Não foi possível expirar o pedido de validação.', 500)
      } else {
        let verified: any = null
        try {
          verified = await findTwilioOutgoingCallerId(String(pending.phone_number))
        } catch {
          // A temporary Twilio lookup failure leaves the existing challenge pending.
        }
        const twilioSid = String(verified?.sid || '')
        if (verified && twilioSid) {
          const { data: existingOwner, error: ownerError } = await admin
            .from('sd_dialer_caller_ids')
            .select('id')
            .eq('phone_number', pending.phone_number)
            .eq('verification_status', 'verified')
            .neq('user_id', user.id)
            .limit(1)
            .maybeSingle()
          if (ownerError) throw new SdDialerError('Não foi possível confirmar a associação do número.', 500)
          if (existingOwner) {
            const { error } = await admin
              .from('sd_dialer_caller_ids')
              .update({ verification_status: 'failed', is_active: false, validation_code: null })
              .eq('id', pending.id)
              .eq('user_id', user.id)
            if (error) throw new SdDialerError('Não foi possível rejeitar uma associação duplicada.', 500)
          } else {
            const { error } = await admin.rpc('activate_sd_dialer_caller_id', {
              p_verification_id: pending.id,
              p_twilio_sid: twilioSid,
            })
            if (error) throw new SdDialerError('A Twilio validou o número, mas não foi possível ativá-lo no SD Dialer.', 500)
          }
        }
      }
      const refreshed = await loadRows()
      if (refreshed.error) throw new SdDialerError('Não foi possível atualizar o estado do número.', 500)
      rows = refreshed.data || []
    }

    const activeRow = rows.find(row => row.verification_status === 'verified' && row.is_active)
    const pendingRow = rows.find(row => row.verification_status === 'pending')
    const failedRow = rows.find(row => row.verification_status === 'failed')
    const numbers = rows
      .filter(row => row.verification_status === 'verified')
      .map(row => publicRecord(row))
    const isSuperAdmin = profile.is_super_admin === true || profile.role === 'super_admin'
    const legacyCallerId = isSuperAdmin
      ? normalizePtPhone(process.env.LUMIN_CALLER_ID || '')
      : ''
    const legacyFallbackPhoneNumber = !activeRow ? legacyCallerId : ''
    // Only availability reaches the browser; the shared phone stays on the server.
    const sharedCallerIdAvailable = !activeRow && !isSuperAdmin && Boolean(await resolveSharedCallerId(
      admin, user.id, profile.company_id, normalizePtPhone(process.env.LUMIN_CALLER_ID || ''),
    ))

    return NextResponse.json({
      active: activeRow ? publicRecord(activeRow) : null,
      pending: pendingRow ? publicRecord(pendingRow, true) : null,
      failed: failedRow ? publicRecord(failedRow) : null,
      numbers,
      sharedCallerIdAvailable,
      legacyFallbackPhoneNumber: legacyFallbackPhoneNumber || null,
      verificationAvailable: isTwilioCallerIdConfigured(),
    })
  } catch (error) {
    return errorResponse(error, 'caller ID GET')
  }
}
