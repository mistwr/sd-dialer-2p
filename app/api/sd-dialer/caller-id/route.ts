import { NextRequest, NextResponse } from 'next/server'
import {
  errorResponse,
  findTwilioOutgoingCallerId,
  isTwilioCallerIdConfigured,
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
    const scope = () => admin
      .from('sd_dialer_caller_ids')
      .select('id,user_id,company_id,phone_number,verification_status,is_active,validation_code,twilio_call_sid,requested_at,verified_at,created_at')
      .eq('user_id', user.id)
      .eq('company_id', profile.company_id)
      .order('created_at', { ascending: false })

    let { data, error } = await scope()
    if (error) throw new SdDialerError('Não foi possível carregar os números associados a esta conta.', 500)

    const pending = (data || []).find((row: any) => row.verification_status === 'pending')
    if (pending && isTwilioCallerIdConfigured()) {
      const ageMs = Date.now() - new Date(pending.requested_at || pending.created_at).getTime()
      if (ageMs > 10 * 60 * 1000) {
        await admin
          .from('sd_dialer_caller_ids')
          .update({ verification_status: 'failed', is_active: false, validation_code: null, updated_at: new Date().toISOString() })
          .eq('id', pending.id)
          .eq('user_id', user.id)
        data = (data || []).map((row: any) => row.id === pending.id
          ? { ...row, verification_status: 'failed', is_active: false, validation_code: null }
          : row)
      } else {
        try {
          const verified = await findTwilioOutgoingCallerId(String(pending.phone_number))
          if (verified) {
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
              await admin
                .from('sd_dialer_caller_ids')
                .update({ verification_status: 'failed', is_active: false, validation_code: null, updated_at: new Date().toISOString() })
                .eq('id', pending.id)
                .eq('user_id', user.id)
              data = (data || []).map((row: any) => row.id === pending.id
                ? { ...row, verification_status: 'failed', is_active: false, validation_code: null }
                : row)
            } else {
              const now = new Date().toISOString()
              await admin
                .from('sd_dialer_caller_ids')
                .update({ is_active: false, updated_at: now })
                .eq('user_id', user.id)
                .eq('company_id', profile.company_id)
              const { error: activateError } = await admin
                .from('sd_dialer_caller_ids')
                .update({ verification_status: 'verified', is_active: true, validation_code: null, verified_at: now, updated_at: now })
                .eq('id', pending.id)
                .eq('user_id', user.id)
                .eq('company_id', profile.company_id)
              if (activateError) throw new SdDialerError('O número foi validado pela Twilio, mas não foi possível ativá-lo no SD Dialer.', 500)
              data = (data || []).map((row: any) => row.id === pending.id
                ? { ...row, verification_status: 'verified', is_active: true, validation_code: null, verified_at: now }
                : { ...row, is_active: false })
            }
          }
        } catch (error) {
          if (error instanceof SdDialerError) throw error
          // Keep the verification pending if the Twilio status check is temporarily unavailable.
        }
      }
    }

    const rows = data || []
    const activeRow = rows.find((row: any) => row.verification_status === 'verified' && row.is_active)
    const pendingRow = rows.find((row: any) => row.verification_status === 'pending')
    const failedRow = rows.find((row: any) => row.verification_status === 'failed')
    const numbers = rows
      .filter((row: any) => row.verification_status === 'verified')
      .map((row: any) => publicRecord(row))

    return NextResponse.json({
      active: activeRow ? publicRecord(activeRow) : null,
      pending: pendingRow ? publicRecord(pendingRow, true) : null,
      failed: failedRow ? publicRecord(failedRow) : null,
      numbers,
      verificationAvailable: isTwilioCallerIdConfigured(),
    })
  } catch (error) {
    return errorResponse(error, 'caller ID GET')
  }
}
