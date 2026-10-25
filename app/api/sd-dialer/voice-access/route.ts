import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import {
  errorResponse,
  requireSdDialerUser,
  SdDialerError,
} from '@/lib/server/sd-dialer-livekit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function hashCode(value: string) {
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return createHash('sha256').update(normalized).digest('hex')
}

export async function GET(request: NextRequest) {
  try {
    const { admin, user, profile } = await requireSdDialerUser(request)
    if (profile.is_super_admin === true || profile.role === 'super_admin') {
      return NextResponse.json({ active: true, expiresAt: null, superAdmin: true })
    }
    const { data, error } = await admin
      .from('voice_call_subscriptions')
      .select('status,expires_at')
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) throw new SdDialerError('Não foi possível consultar a subscrição das chamadas de IA.', 500)
    const expiresAt = data?.expires_at ? String(data.expires_at) : null
    const active = data?.status === 'active' && Boolean(expiresAt) && new Date(expiresAt!).getTime() > Date.now()
    return NextResponse.json({ active, expiresAt })
  } catch (error) {
    return errorResponse(error, 'voice access GET')
  }
}

export async function POST(request: NextRequest) {
  try {
    const { admin, user, profile } = await requireSdDialerUser(request)
    const body = await request.json().catch(() => ({})) as { code?: string }
    const code = String(body.code || '').trim().toUpperCase()
    const normalized = code.replace(/[^A-Z0-9]/g, '')
    if (normalized.length !== 12) throw new SdDialerError('Código inválido ou já utilizado.', 400)

    const { data, error } = await admin.rpc('redeem_voice_call_access_code', {
      p_code_hash: hashCode(code),
      p_user_id: user.id,
      p_company_id: profile.company_id,
    })
    if (error) {
      const message = String(error.message || '')
      if (/invalid|expir|utiliz|destinad|code/i.test(message)) {
        throw new SdDialerError('Código inválido, expirado, utilizado ou destinado a outra conta.', 400)
      }
      throw new SdDialerError('Não foi possível ativar a subscrição das chamadas de IA.', 500)
    }
    return NextResponse.json({ active: true, expiresAt: String(data || '') })
  } catch (error) {
    return errorResponse(error, 'voice access POST')
  }
}
