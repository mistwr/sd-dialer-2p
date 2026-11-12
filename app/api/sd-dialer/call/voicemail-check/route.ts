import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, getLiveKitConfig } from '@/lib/server/sd-dialer-livekit'
import { hangupIfVoicemail } from '@/lib/server/voicemail-detect'

// Chamado pela base de dados (trigger em voice_call_transcripts via pg_net) sempre que
// aparece uma frase de correio de voz. Funciona mesmo com o telemóvel bloqueado ou a página fechada.
// Não precisa de segredo: só desliga se a própria transcrição guardada no Supabase mostrar
// correio de voz, e só em chamadas que ainda não terminaram.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as { callId?: string }
    const callId = String(body.callId || '')
    if (!/^[0-9a-f-]{36}$/i.test(callId)) return NextResponse.json({ ok: false }, { status: 400 })

    const admin = createAdminClient()
    const { data: call } = await admin
      .from('voice_calls')
      .select('id,livekit_room,started_at,created_at,ended_at,status')
      .eq('id', callId)
      .maybeSingle()
    if (!call || call.ended_at || !call.livekit_room) return NextResponse.json({ ok: true, hungUp: false })

    const { api } = getLiveKitConfig()
    const hungUp = await hangupIfVoicemail(admin, api, call)
    return NextResponse.json({ ok: true, hungUp })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
