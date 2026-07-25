/**
 * GET /api/recordings
 * Returns all call_recordings for the authenticated user (with joined ai_analyses)
 * Query params: ?page=1&limit=20&parceiro_id=uuid
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(50, parseInt(searchParams.get('limit') ?? '20'))
    const parceiro_id = searchParams.get('parceiro_id')
    const from = (page - 1) * limit

    // Get user role
    const { data: me } = await supabase
      .from('usuarios')
      .select('role, company_id')
      .eq('id', user.id)
      .single()

    let query = supabase
      .from('call_recordings')
      .select(`
        *,
        leads(nome, telefone),
        campanhas(nome),
        usuarios!call_recordings_parceiro_id_fkey(nome, email),
        ai_analyses(
          id, score, summary, status, urgency, next_action,
          objections, interests, competitor, current_operator,
          talk_ratio_comercial, talk_ratio_client,
          coach_well, coach_improve, coach_argument, coach_phrase,
          sale_probability, transcript, engine,
          top_words, arguments, questions_count, loss_reason,
          emotions, coach_well, coach_improve, coach_argument, coach_phrase,
          created_at
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1)

    // Admins see all company recordings; parceiros see only their own
    if (me?.role === 'admin' || me?.role === 'super_admin') {
      query = query.eq('company_id', me.company_id)
      if (parceiro_id) query = query.eq('parceiro_id', parceiro_id)
    } else {
      query = query.eq('parceiro_id', user.id)
    }

    const { data: recordings, count, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ recordings: recordings ?? [], total: count ?? 0 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
