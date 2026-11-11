import { getHiddenUserIds } from '@/lib/server/hidden-users'
import { after, NextRequest, NextResponse } from 'next/server'
import { ensureCallSummary } from '@/lib/server/voice-call-summary'
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

function pickAiSale(facts: any) {
  const s = facts && typeof facts === 'object' ? facts.ai_sale : null
  if (!s || typeof s !== 'object') return null
  const e = s.extracted || {}
  return {
    status: String(s.status || ''),
    operator: e.operator ?? null,
    package: e.package ?? null,
    monthly_price: typeof e.monthly_price === 'number' ? e.monthly_price : null,
    email: e.email ?? null,
    delivery: s.delivery && typeof s.delivery === 'object' ? s.delivery : null,
  }
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

    const leadId = searchParams.get('lead_id')
    if (leadId && !/^[0-9a-f-]{36}$/i.test(leadId)) {
      return NextResponse.json({ error: 'lead_id invalido' }, { status: 400 })
    }
    const hiddenIds = canSeeCompany && !isSuperAdmin ? [...(await getHiddenUserIds(admin, me as any))] : []

    const PERIODS: Record<string, number> = { today: 0, '7d': 7, '30d': 30 }
    const period = searchParams.get('period') ?? 'all'
    const sinceIso = period in PERIODS
      ? (() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - PERIODS[period]); return d.toISOString() })()
      : null

    const CATEGORIES = ['alto', 'medio', 'baixo', 'sem_interesse', 'correio_voz', 'indeterminado', 'em_curso', 'vendas']
    const applyCategory = (q: any, cat: string | null) => {
      if (!cat) return q
      if (cat === 'em_curso') return q.is('ended_at', null)
      if (cat === 'vendas') return q.not('extracted_facts->ai_sale', 'is', null)
      return q.eq('interest_level', cat)
    }
    const scope = (q: any, cat: string | null) => {
      q = q.in('source', ['sd-dialer', 'sd-dialer-manual'])
      if (!isSuperAdmin) q = q.eq('company_id', me.company_id)
      if (leadId) q = q.eq('lead_id', leadId)
      if (sinceIso) q = q.gte('created_at', sinceIso)
      if (!canSeeCompany && (me.role === 'supervisor' || me.role === 'admin')) q = q.in('created_by', allowedUserIds)
      else if (!canSeeCompany) q = q.eq('created_by', userId)
      else if (hiddenIds.length) q = q.not('created_by', 'in', `(${hiddenIds.join(',')})`)
      return applyCategory(q, cat)
    }

    const rawFilter = searchParams.get('filter')
    const filter = rawFilter && CATEGORIES.includes(rawFilter) ? rawFilter : null

    const query = scope(
      admin
        .from('voice_calls')
        .select(
          'id, company_id, lead_id, source, client_name, phone_number, status, duration_seconds, recording_enabled, transcript_consent_at, transcript_consent_status, created_by, started_at, ended_at, created_at, summary, interest_level, next_action, recording_url, extracted_facts',
          { count: 'exact' }
        )
        .order('created_at', { ascending: false })
        .limit(limit),
      filter,
    )

    const countEntries = await Promise.all(
      [null, ...CATEGORIES].map(async (cat) => {
        const { count: c } = await scope(admin.from('voice_calls').select('id', { count: 'exact', head: true }), cat)
        return [cat ?? 'todas', c ?? 0] as const
      }),
    )
    const counts = Object.fromEntries(countEntries)

    const { data: callsRaw, count, error: callsError } = await query
    const calls = (callsRaw ?? []) as any[]
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

    // Chamadas terminadas com transcrição mas ainda sem resumo: gera-o depois da resposta (máx. 3 por pedido).
    const missingSummary = (calls ?? [])
      .filter((call) => !call.summary && call.ended_at && (transcriptsByCall.get(call.id)?.length ?? 0) > 0)
      .slice(0, 3)
      .map((call) => call.id)
    if (missingSummary.length) {
      after(async () => {
        for (const id of missingSummary) await ensureCallSummary(admin, id).catch(() => false)
      })
    }

    return NextResponse.json({
      calls: (calls ?? []).map(({ recording_url, extracted_facts, ...call }: any) => ({
        ...call,
        ai_sale: pickAiSale(extracted_facts),
        call_info: extracted_facts && typeof extracted_facts === 'object' && typeof (extracted_facts as any).call_info === 'object' ? (extracted_facts as any).call_info : null,
        has_recording: typeof recording_url === 'string' && recording_url.startsWith('voice-recordings/'),
        transcripts: transcriptsByCall.get(call.id) ?? [],
      })),
      total: count ?? 0,
      counts,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno'
    console.error('[voice-calls GET] unexpected error:', message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
