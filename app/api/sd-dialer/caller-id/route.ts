import { NextRequest, NextResponse } from 'next/server'
import {
  errorResponse,
  requireSdDialerUser,
  SdDialerError,
} from '@/lib/server/sd-dialer-livekit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { admin, user, profile } = await requireSdDialerUser(request)
    const { data, error } = await admin
      .from('sd_dialer_caller_ids')
      .select('id,phone_number,verification_status,is_active,requested_at,verified_at')
      .eq('user_id', user.id)
      .eq('company_id', profile.company_id)
      .order('created_at', { ascending: false })

    if (error) throw new SdDialerError('Não foi possível carregar os números de saída.', 500)

    const records = (data || []).map((row: any) => ({
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
    }))

    const fallbackPhoneNumber = String(process.env.LUMIN_CALLER_ID || '')
    const numbers = records
      .filter((record: any) => record.status === 'verified')
      .map((record: any) => ({ ...record, isActive: false }))
    const active = fallbackPhoneNumber
      ? {
          id: 'company-caller-id',
          phoneNumber: fallbackPhoneNumber,
          status: 'verified',
          isActive: true,
          requestedAt: null,
          verifiedAt: null,
        }
      : null
    return NextResponse.json({
      active,
      pending: records.find((record: any) => record.status === 'pending') || null,
      failed: records.find((record: any) => record.status === 'failed') || null,
      numbers,
      verificationAvailable: false,
      fallbackAvailable: Boolean(fallbackPhoneNumber),
      fallbackPhoneNumber,
    })
  } catch (error) {
    return errorResponse(error, 'caller ID GET')
  }
}
