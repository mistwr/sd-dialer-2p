import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/server/sd-dialer-livekit'
import { tickCampaigns } from '@/lib/server/call-campaigns'

export const runtime = 'nodejs'
export const maxDuration = 60

// Chamado pelo pg_cron (1/minuto) com o segredo CAMPAIGN_CRON_SECRET.
export async function POST(request: NextRequest) {
  const secret = process.env.CAMPAIGN_CRON_SECRET
  if (!secret || request.headers.get('x-cron-secret') !== secret) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }
  try {
    const results = await tickCampaigns(createAdminClient())
    return NextResponse.json({ ok: true, results })
  } catch (error) {
    console.error('[campanhas-chamadas] tick', error instanceof Error ? error.message : 'erro')
    return NextResponse.json({ error: 'Erro no tick.' }, { status: 500 })
  }
}
