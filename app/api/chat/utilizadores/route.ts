import { NextRequest, NextResponse } from 'next/server'
import { errorResponse, requireSdDialerUser } from '@/lib/server/sd-dialer-livekit'

// Lista de utilizadores para o chat: todos os utilizadores ativos do SD Dialer (todas as empresas),
// com empresa e se está online (visto nos últimos 5 min). Só nome, cargo, empresa e foto — nada sensível.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { admin, user } = await requireSdDialerUser(request)
    const [{ data: users }, { data: emps }, { data: locs }] = await Promise.all([
      admin.from('usuarios').select('id, full_name, avatar_url, role, company_id, last_seen_at').eq('status', 'active').order('full_name'),
      admin.from('companies').select('id, name'),
      admin.from('user_locations').select('user_id, updated_at'),
    ])
    const empresa = new Map<string, string>((emps || []).map((e: any) => [String(e.id), String(e.name || '')]))
    const visto = new Map<string, number>()
    for (const l of locs || []) visto.set(String(l.user_id), new Date(l.updated_at).getTime())
    const agora = Date.now()
    const lista = (users || []).map((u: any) => {
      const t = Math.max(u.last_seen_at ? new Date(u.last_seen_at).getTime() : 0, visto.get(String(u.id)) || 0)
      return {
        id: u.id, full_name: u.full_name || 'Sem nome', avatar_url: u.avatar_url, role: u.role,
        empresa: empresa.get(String(u.company_id)) || '', online: t > 0 && agora - t < 5 * 60_000, visto_em: t ? new Date(t).toISOString() : null,
      }
    })
    return NextResponse.json({ eu: user.id, utilizadores: lista })
  } catch (err) {
    return errorResponse(err, 'chat-utilizadores')
  }
}
