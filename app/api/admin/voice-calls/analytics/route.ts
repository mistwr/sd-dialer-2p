import { NextRequest, NextResponse } from 'next/server'
import { errorResponse, requireSdDialerSuperAdmin } from '@/lib/server/sd-dialer-livekit'
import { computeVoiceAnalytics } from '@/lib/server/voice-analytics'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Só leitura. Não altera chamadas, robot nem atribuições.
export async function GET(request: NextRequest) {
  try {
    const { admin } = await requireSdDialerSuperAdmin(request)
    const url = new URL(request.url)
    const days = Math.max(1, Math.min(90, Number(url.searchParams.get('days')) || 14))
    const companyId = url.searchParams.get('companyId') || ''
    return NextResponse.json(await computeVoiceAnalytics(admin, days, companyId))
  } catch (error) {
    return errorResponse(error, 'admin voice calls analytics GET')
  }
}
