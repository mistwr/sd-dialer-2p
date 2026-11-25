import { NextRequest, NextResponse } from 'next/server'
import { errorResponse, requireSdDialerUser, SdDialerError } from '@/lib/server/sd-dialer-livekit'

// Super admin lança (ou apaga) resultados do mês no ranking: TVs, energias e chamadas feitas fora do SD Dialer.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { admin, profile } = await requireSdDialerUser(request)
    if (!profile.is_super_admin) throw new SdDialerError('Só o super admin lança resultados.', 403)
    const b = await request.json().catch(() => ({})) as any
    const nome = String(b.nome || '').trim().slice(0, 80)
    const userId = b.user_id ? String(b.user_id) : null
    if (!nome && !userId) throw new SdDialerError('Indica o vendedor.', 400)
    let nomeFinal = nome
    if (userId) {
      const { data: u } = await admin.from('usuarios').select('full_name').eq('id', userId).maybeSingle()
      if (!u) throw new SdDialerError('Vendedor não encontrado.', 404)
      nomeFinal = u.full_name || nome
    }
    const hoje = new Date()
    const mes = /^\d{4}-\d{2}$/.test(String(b.mes || '')) ? `${b.mes}-01` : new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), 1)).toISOString().slice(0, 10)
    const n = (v: any) => Math.max(0, Math.min(100000, Math.round(Number(v) || 0)))
    const { data, error } = await admin.from('ranking_ajustes').insert({
      mes, user_id: userId, nome: nomeFinal, tvs: n(b.tvs), energias: n(b.energias), chamadas: n(b.chamadas),
      nota: b.nota ? String(b.nota).slice(0, 200) : null, created_by: profile.id, fora_ranking: !!b.fora_ranking,
    }).select('id').single()
    if (error) throw new SdDialerError(error.message, 500)
    return NextResponse.json({ ok: true, id: data.id })
  } catch (err) { return errorResponse(err, 'ranking-ajustes') }
}

export async function DELETE(request: NextRequest) {
  try {
    const { admin, profile } = await requireSdDialerUser(request)
    if (!profile.is_super_admin) throw new SdDialerError('Só o super admin apaga resultados.', 403)
    const id = request.nextUrl.searchParams.get('id')
    if (!id) throw new SdDialerError('Falta o id.', 400)
    const { error } = await admin.from('ranking_ajustes').delete().eq('id', id)
    if (error) throw new SdDialerError(error.message, 500)
    return NextResponse.json({ ok: true })
  } catch (err) { return errorResponse(err, 'ranking-ajustes') }
}
