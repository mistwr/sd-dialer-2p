/**
 * GET /api/recordings
 * Returns all call_recordings for the authenticated user (with joined ai_analyses)
 * Query params: ?limit=50&offset=0&parceiro_id=uuid
 * Auth: cookie session OR Authorization: Bearer <jwt>
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

function getAdminClient() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function resolveUserId(req: NextRequest): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) return user.id

  const authHeader = req.headers.get('authorization') ?? ''
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (jwt) {
    const admin = getAdminClient()
    const { data } = await admin.auth.getUser(jwt)
    if (data?.user) return data.user.id
  }
  return null
}

export async function GET(req: NextRequest) {
  try {
    const userId = await resolveUserId(req)
    if (!userId) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const limit = Math.min(200, parseInt(searchParams.get('limit') ?? '50'))
    const offset = parseInt(searchParams.get('offset') ?? '0')
    const parceiro_filter = searchParams.get('parceiro_id')

    const admin = getAdminClient()

    // Get caller role/company
    const { data: me } = await admin
      .from('usuarios')
      .select('role, company_id')
      .eq('id', userId)
      .single()

    const isAdmin = me?.role === 'admin' || me?.role === 'super_admin' || me?.role === 'supervisor'

    let query = admin
      .from('call_recordings')
      .select(`
        id, audio_url, file_name, file_size, duration_sec, mime_type,
        status, error_msg, created_at, parceiro_id, company_id,
        leads(nome, telefone),
        campanhas(nome),
        usuarios!call_recordings_parceiro_id_fkey(nome),
        ai_analyses(
          id, score, summary, status, urgency, next_action,
          objections, interests, competitor, current_operator,
          talk_ratio_comercial, talk_ratio_client, questions_count,
          coach_well, coach_improve, coach_argument, coach_phrase,
          sale_probability, transcript, engine,
          top_words, arguments, loss_reason, emotions, created_at
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (isAdmin && me?.company_id) {
      query = query.eq('company_id', me.company_id)
      if (parceiro_filter) query = query.eq('parceiro_id', parceiro_filter)
    } else {
      query = query.eq('parceiro_id', userId)
    }

    const { data: recordings, count, error } = await query
    if (error) {
      console.error('[recordings GET] query error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ recordings: recordings ?? [], total: count ?? 0 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    console.error('[recordings GET] unexpected error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
