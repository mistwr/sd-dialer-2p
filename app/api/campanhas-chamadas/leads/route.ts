import { NextRequest, NextResponse } from 'next/server'
import { errorResponse, requireSdDialerUser, SdDialerError } from '@/lib/server/sd-dialer-livekit'

export const runtime = 'nodejs'

const OPEN = ['novo', 'nao_atende', 'ligar_depois']
const MANAGERS = new Set(['admin', 'supervisor', 'super_admin'])

// Lista (e conta) as leads que uma campanha poderia ligar, com filtros.
export async function GET(request: NextRequest) {
  try {
    const { admin, user, profile } = await requireSdDialerUser(request)
    const p = request.nextUrl.searchParams
    const statuses = (p.get('statuses') || OPEN.join(',')).split(',').filter(s => OPEN.includes(s))
    const manager = profile.is_super_admin === true || MANAGERS.has(String(profile.role))
    if (!manager) throw new SdDialerError('As chamadas automáticas são só para administradores e supervisores.', 403)

    let q = admin.from('leads')
      .select('id,nome,telefone,status,localidade,operador,campanha_id', { count: 'exact' })
      .eq('company_id', profile.company_id).in('status', statuses.length ? statuses : OPEN).not('telefone', 'is', null)
    if (!manager) q = q.eq('assigned_to', user.id)
    const campanha = p.get('campanha_id'); if (campanha) q = q.eq('campanha_id', campanha)
    const loc = (p.get('localidade') || '').trim(); if (loc) q = q.ilike('localidade', '%' + loc.replace(/[%,]/g, '') + '%')
    const op = (p.get('operador') || '').trim(); if (op) q = q.ilike('operador', '%' + op.replace(/[%,]/g, '') + '%')
    const text = (p.get('q') || '').trim().replace(/[%,()]/g, '')
    if (text) q = q.or('nome.ilike.%' + text + '%,telefone.ilike.%' + text + '%')
    const { data, count, error } = await q.order('created_at', { ascending: true }).limit(100)
    if (error) throw new SdDialerError('Não foi possível listar as leads.', 500)

    const { data: campanhas } = await admin.from('campanhas').select('id,name').eq('company_id', profile.company_id).order('name').limit(200)
    return NextResponse.json({ leads: data || [], total: count || 0, campanhas: campanhas || [] })
  } catch (error) {
    return errorResponse(error, 'campanhas-chamadas leads')
  }
}
