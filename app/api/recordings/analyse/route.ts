/**
 * POST /api/recordings/analyse
 * Body: { recording_id: string }
 *
 * Auth: cookie session OR Authorization: Bearer <jwt>
 * Uses MyPoupar AI SDK — swap engine in lib/ai/config.ts only.
 * Mock engine works with no external deps (default).
 * The CRM continues to work even if this route errors.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { transcribeAudio, analyseCall } from '@/lib/ai'

export const maxDuration = 120

function getAdminClient() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function resolveUserId(req: NextRequest): Promise<string | null> {
  // Try cookie session first
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) return user.id

  // Fallback: Authorization header
  const authHeader = req.headers.get('authorization') ?? ''
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (jwt) {
    const admin = getAdminClient()
    const { data } = await admin.auth.getUser(jwt)
    if (data?.user) return data.user.id
  }
  return null
}

export async function POST(req: NextRequest) {
  try {
    const userId = await resolveUserId(req)
    if (!userId) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { recording_id } = body
    if (!recording_id) {
      return NextResponse.json({ error: 'recording_id ausente' }, { status: 400 })
    }

    const admin = getAdminClient()

    // Fetch recording with joined data
    const { data: recording, error: recErr } = await admin
      .from('call_recordings')
      .select('*, leads(nome), campanhas(nome)')
      .eq('id', recording_id)
      .single()

    if (recErr || !recording) {
      return NextResponse.json({ error: 'Gravacao nao encontrada' }, { status: 404 })
    }

    // Security check: only the owner or same company can analyse
    const { data: caller } = await admin
      .from('usuarios')
      .select('company_id, role')
      .eq('id', userId)
      .single()

    const isOwner = recording.parceiro_id === userId
    const isSameCompany = caller?.company_id && recording.company_id === caller.company_id
    const isAdmin = caller?.role === 'admin' || caller?.role === 'supervisor'
    if (!isOwner && !(isSameCompany && isAdmin)) {
      return NextResponse.json({ error: 'Sem permissao' }, { status: 403 })
    }

    // Mark as transcribing
    await admin
      .from('call_recordings')
      .update({ status: 'transcribing' })
      .eq('id', recording_id)

    // Step 1: Transcribe (mock engine uses audio_url as hint only)
    let transcript = ''
    let duration_sec = recording.duration_sec ?? 0
    try {
      const result = await transcribeAudio(recording.audio_url ?? '')
      transcript = result.transcript
      if (result.duration_sec > 0) duration_sec = result.duration_sec
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro transcricao'
      await admin.from('call_recordings').update({ status: 'error', error_msg: msg }).eq('id', recording_id)
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    // Step 2: LLM Analysis
    const leadName = (recording.leads as any)?.nome ?? undefined
    const campaignName = (recording.campanhas as any)?.nome ?? undefined

    let analysis
    try {
      analysis = await analyseCall({ transcript, leadName, campaignName, duration_sec })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro analise'
      await admin.from('call_recordings').update({ status: 'error', error_msg: msg }).eq('id', recording_id)
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    // Step 3: Upsert analysis
    const { data: saved, error: saveErr } = await admin
      .from('ai_analyses')
      .upsert({
        recording_id,
        call_history_id: recording.call_history_id,
        parceiro_id: recording.parceiro_id,
        company_id: recording.company_id,
        transcript,
        summary: analysis.summary,
        objections: analysis.objections,
        interests: analysis.interests,
        urgency: analysis.urgency,
        emotions: analysis.emotions,
        competitor: analysis.competitor,
        current_operator: analysis.current_operator,
        score: analysis.score,
        next_action: analysis.next_action,
        talk_ratio_comercial: analysis.talk_ratio_comercial,
        talk_ratio_client: analysis.talk_ratio_client,
        questions_count: analysis.questions_count,
        arguments: analysis.arguments,
        top_words: analysis.top_words,
        loss_reason: analysis.loss_reason,
        sale_probability: analysis.sale_probability,
        coach_well: analysis.coach_well,
        coach_improve: analysis.coach_improve,
        coach_argument: analysis.coach_argument,
        coach_phrase: analysis.coach_phrase,
        engine: analysis.engine,
        status: 'done',
      }, { onConflict: 'recording_id' })
      .select()
      .single()

    if (saveErr) {
      return NextResponse.json({ error: saveErr.message }, { status: 500 })
    }

    // Update recording status
    await admin
      .from('call_recordings')
      .update({ status: 'analysed', duration_sec })
      .eq('id', recording_id)

    return NextResponse.json({ analysis: saved }, { status: 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    console.error('[analyse] unexpected error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
