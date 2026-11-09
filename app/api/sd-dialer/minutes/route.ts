import { NextRequest, NextResponse } from 'next/server'
import { errorResponse, requireSdDialerUser, SdDialerError } from '@/lib/server/sd-dialer-livekit'

// Minutos gastos nas chamadas do robot de IA.
// Cada utilizador vê os seus; admin/supervisor veem também a equipa da própria empresa.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PAGE = 1000

type Totals = { seconds: number; billed_minutes: number; calls: number }

function add(t: Totals, seconds: number) {
  t.seconds += seconds
  t.billed_minutes += Math.ceil(seconds / 60)
  t.calls += 1
}

export async function GET(request: NextRequest) {
  try {
    const { admin, profile } = await requireSdDialerUser(request)
    const isManager = ['admin', 'supervisor'].includes(String(profile.role))
    const seesWholeCompany = Boolean(profile.is_super_admin) || (profile.role === 'admin' && !profile.restricted_admin)
    let allowed: Set<string> | null = null
    if (isManager && !seesWholeCompany) {
      const { data: mine } = await admin
        .from('usuarios')
        .select('id,supervisor_id,created_by')
        .eq('company_id', profile.company_id)
      allowed = new Set(
        (mine || [])
          .filter((u: any) => u.id === profile.id || u.supervisor_id === profile.id || (!u.supervisor_id && u.created_by === profile.id))
          .map((u: any) => String(u.id)),
      )
    }
    const now = new Date()
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()

    const rows: any[] = []
    for (let offset = 0; ; offset += PAGE) {
      let query = admin.from('voice_calls').select('created_by,duration_seconds,created_at').eq('company_id', profile.company_id)
      if (!isManager) query = query.eq('created_by', profile.id)
      const { data, error } = await query.order('created_at', { ascending: false }).range(offset, offset + PAGE - 1)
      if (error) throw new SdDialerError('Não foi possível calcular os minutos.', 500)
      rows.push(...(data || []))
      if (!data || data.length < PAGE) break
    }

    const me = { month: { seconds: 0, billed_minutes: 0, calls: 0 }, total: { seconds: 0, billed_minutes: 0, calls: 0 } }
    const team = new Map<string, { month: Totals; total: Totals }>()
    for (const row of rows) {
      const seconds = Math.max(0, Number(row.duration_seconds) || 0)
      const inMonth = String(row.created_at) >= monthStart
      const userId = String(row.created_by || '')
      if (userId === profile.id) {
        add(me.total, seconds)
        if (inMonth) add(me.month, seconds)
      }
      if (isManager && (!allowed || allowed.has(userId))) {
        const entry = team.get(userId) || { month: { seconds: 0, billed_minutes: 0, calls: 0 }, total: { seconds: 0, billed_minutes: 0, calls: 0 } }
        add(entry.total, seconds)
        if (inMonth) add(entry.month, seconds)
        team.set(userId, entry)
      }
    }

    let teamList: any[] = []
    if (isManager && team.size) {
      const ids = [...team.keys()].filter(Boolean)
      const { data: users } = ids.length
        ? await admin.from('usuarios').select('id,full_name').in('id', ids)
        : { data: [] as any[] }
      const names = new Map((users || []).map((u: any) => [String(u.id), String(u.full_name || '')]))
      teamList = [...team.entries()]
        .map(([id, t]) => ({ user: names.get(id) || 'Sem utilizador', ...t }))
        .sort((a, b) => b.month.seconds - a.month.seconds || b.total.seconds - a.total.seconds)
    }

    return NextResponse.json({ me, team: teamList, isManager })
  } catch (error) {
    return errorResponse(error, 'sd-dialer minutes GET')
  }
}
