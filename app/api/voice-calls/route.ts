import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { canViewVoiceSeller, type VoiceSeller } from '@/lib/utils/voice-leads'

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
  if (!jwt) return null

  const { data } = await getAdminClient().auth.getUser(jwt)
  return data?.user?.id ?? null
}

export async function GET(req: NextRequest) {
  try {
    const userId = await resolveUserId(req)
    if (!userId) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const admin = getAdminClient()
    const { data: me, error: meError } = await admin
      .from('usuarios')
      .select('id, full_name, role, status, company_id, supervisor_id, created_by, restricted_admin, is_super_admin')
      .eq('id', userId)
      .maybeSingle()

    if (meError || !me || me.status !== 'active' || !me.company_id) {
      return NextResponse.json({ error: 'Sem permissao para consultar chamadas' }, { status: 403 })
    }

    const { data: companyUsers, error: usersError } = await admin
      .from('usuarios')
      .select('id, full_name, role, status, company_id, supervisor_id, created_by, restricted_admin')
      .eq('company_id', me.company_id)
      .eq('status', 'active')

    if (usersError) {
      console.error('[voice-calls GET] user scope error:', usersError.message)
      return NextResponse.json({ error: 'Nao foi possivel validar o acesso' }, { status: 500 })
    }

    const actor = me as VoiceSeller & { is_super_admin?: boolean }
    const isSuperAdmin = Boolean(me.is_super_admin) || me.role === 'super_admin'
    const canSeeCompany = isSuperAdmin || (me.role === 'admin' && !me.restricted_admin)
    const allowedUserIds = (companyUsers ?? [])
      .filter((seller) => canViewVoiceSeller(actor, seller as VoiceSeller))
      .map((seller) => seller.id)

    if (!allowedUserIds.includes(userId)) allowedUserIds.push(userId)

    const { searchParams } = new URL(req.url)
    const requestedLimit = Number.parseInt(searchParams.get('limit') ?? '50', 10)
    const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(100, requestedLimit)) : 50

    let query = admin
      .from('voice_calls')
      .select(
        'id, company_id, lead_id, source, client_name, phone_number, status, duration_seconds, recording_enabled, transcript_consent_at, transcript_consent_status, created_by, started_at, ended_at, created_at',
        { count: 'exact' }
      )
      .eq('company_id', me.company_id)
      .in('source', ['sd-dialer', 'sd-dialer-manual'])
      .order('created_at', { ascending: false })
      .limit(limit)

    if (!canSeeCompany && (me.role === 'supervisor' || me.role === 'admin')) {
      query = query.in('created_by', allowedUserIds)
    } else if (!canSeeCompany) {
      query = query.eq('created_by', userId)
    }

    const { data: calls, count, error: callsError } = await query
    if (callsError) {
      console.error('[voice-calls GET] call query error:', callsError.message)
      return NextResponse.json({ error: 'Nao foi possivel carregar o historico' }, { status: 500 })
    }

    const callIds = (calls ?? [])
      .filter((call) => call.transcript_consent_status === 'granted')
      .map((call) => call.id)

    const transcriptsByCall = new Map<string, Array<{
      id: string
      speaker: string
      text: string
      is_interruption: boolean
      spoken_at: string
    }>>()

    let transcriptOffset = 0
    while (callIds.length) {
      const { data: transcripts, error: transcriptError } = await admin
        .from('voice_call_transcripts')
        .select('id, call_id, speaker, text, is_interruption, spoken_at')
        .eq('company_id', me.company_id)
        .in('call_id', callIds)
        .order('spoken_at', { ascending: true })
        .order('id', { ascending: true })
        .range(transcriptOffset, transcriptOffset + 999)

      if (transcriptError) {
        console.error('[voice-calls GET] transcript query error:', transcriptError.message)
        return NextResponse.json({ error: 'Nao foi possivel carregar as transcricoes' }, { status: 500 })
      }

      const rows = transcripts ?? []
      for (const row of rows) {
        const existing = transcriptsByCall.get(row.call_id) ?? []
        existing.push({
          id: row.id,
          speaker: row.speaker,
          text: row.text,
          is_interruption: row.is_interruption,
          spoken_at: row.spoken_at,
        })
        transcriptsByCall.set(row.call_id, existing)
      }

      if (rows.length < 1000) break
      transcriptOffset += rows.length
    }

    return NextResponse.json({
      calls: (calls ?? []).map((call) => ({
        ...call,
        transcripts: transcriptsByCall.get(call.id) ?? [],
      })),
      total: count ?? 0,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno'
    console.error('[voice-calls GET] unexpected error:', message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
