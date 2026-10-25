import { createHash, randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import {
  errorResponse,
  requireSdDialerSuperAdmin,
  SdDialerError,
} from '@/lib/server/sd-dialer-livekit'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const { admin, user: creator } = await requireSdDialerSuperAdmin(request)
    const body = await request.json().catch(() => ({})) as {
      userId?: string
      durationDays?: number
    }
    const targetUserId = String(body.userId || '')
    const durationDays = Number(body.durationDays)
    if (!targetUserId) throw new SdDialerError('Escolhe o utilizador a quem o código fica associado.', 400)
    if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3650) {
      throw new SdDialerError('A duração tem de ser entre 1 e 3650 dias.', 400)
    }

    const { data: target, error: targetError } = await admin
      .from('usuarios')
      .select('id,company_id,status')
      .eq('id', targetUserId)
      .maybeSingle()
    if (targetError) throw new SdDialerError('Não foi possível consultar o utilizador escolhido.', 500)
    if (!target?.id || !target.company_id || target.status !== 'active') {
      throw new SdDialerError('O utilizador escolhido não está ativo no SD Dialer.', 400)
    }

    const raw = randomBytes(6).toString('hex').toUpperCase()
    const code = raw.slice(0, 4) + '-' + raw.slice(4, 8) + '-' + raw.slice(8, 12)
    const codeHash = createHash('sha256').update(raw).digest('hex')
    const codeExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    const { error: insertError } = await admin
      .from('voice_call_access_codes')
      .insert({
        code_hash: codeHash,
        created_by: creator.id,
        target_user_id: target.id,
        company_id: target.company_id,
        duration_days: durationDays,
        max_uses: 1,
        code_expires_at: codeExpiresAt,
      })
    if (insertError) throw new SdDialerError('Não foi possível criar o código de acesso.', 500)

    return NextResponse.json({
      ok: true,
      code,
      targetUserId: target.id,
      durationDays,
      expiresAt: codeExpiresAt,
      uses: 1,
    })
  } catch (error) {
    return errorResponse(error, 'voice call access code POST')
  }
}
