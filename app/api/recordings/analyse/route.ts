/**
 * POST /api/recordings/analyse
 * Body: { recording_id: string }
 *
 * Transcribes audio → runs LLM analysis → saves to ai_analyses
 * The CRM continues to work even if this route errors.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { transcribeAudio, analyseCall } from '@/lib/ai'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const { recording_id } = await req.json()
    if (!recording_id) {
      return NextResponse.json({ error: 'recording_id ausente' }, { status: 400 })
    }

    // Fetch recording
    const { data: recording, error: recErr } = await supabase
      .from('call_recordings')
      .select('*, leads(nome), campanhas(nome)')
      .eq('id', recording_id)
      .single()

    if (recErr || !recording) {
      return NextResponse.json({ error: 'Gravação não encontrada' }, { status: 404 })
    }

    // Mark as transcribing
    await supabase
      .from('call_recordings')
      .update({ status: 'transcribing' })
      .eq('id', recording_id)

    // Step 1: Transcribe
    let transcript = ''
    let duration_sec = recording.duration_sec ?? 0
    try {
      const result = await transcribeAudio(recording.audio_url ?? '')
      transcript = result.transcript
      duration_sec = result.duration_sec || duration_sec
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro transcrição'
      await supabase.from('call_recordings').update({ status: 'error', error_msg: msg }).eq('id', recording_id)
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    // Step 2: LLM Analysis
    const leadName = (recording.leads as any)?.nome ?? undefined
    const campaignName = (recording.campanhas as any)?.nome ?? undefined

    const analysis = await analyseCall({ transcript, leadName, campaignName, duration_sec })

    // Step 3: Save analysis
    const { data: saved, error: saveErr } = await supabase
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

    // Update recording status → analysed, update duration
    await supabase
      .from('call_recordings')
      .update({ status: 'analysed', duration_sec })
      .eq('id', recording_id)

    return NextResponse.json({ analysis: saved }, { status: 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
