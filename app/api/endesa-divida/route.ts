import { NextRequest, NextResponse } from 'next/server'
import { campanhasUser } from '@/lib/server/campanhas-auth'

const LIMITE_HORA = 60

function nifValido(n: string) {
  if (!/^\d{9}$/.test(n)) return false
  let s = 0
  for (let i = 0; i < 8; i++) s += Number(n[i]) * (9 - i)
  const c = 11 - (s % 11)
  return (c >= 10 ? 0 : c) === Number(n[8])
}

async function ultimaCarga(ctx: any) {
  const { data } = await ctx.admin
    .from('endesa_divida_cargas')
    .select('id, ficheiro, data_lista, total, created_at')
    .eq('company_id', ctx.me.company_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

// GET ?info=1 -> estado da lista | GET ?nif=123456789 -> consulta exata
export async function GET(req: NextRequest) {
  const ctx = await campanhasUser()
  if (!ctx) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

  if (req.nextUrl.searchParams.get('info')) {
    return NextResponse.json({
      carga: await ultimaCarga(ctx),
      pode_carregar: ['admin', 'super_admin'].includes(String(ctx.me.role)),
    })
  }

  const nif = (req.nextUrl.searchParams.get('nif') || '').replace(/\s/g, '')
  if (!/^\d{9}$/.test(nif)) return NextResponse.json({ error: 'O NIF tem de ter 9 dígitos.' }, { status: 400 })

  const desde = new Date(Date.now() - 3600_000).toISOString()
  const { count } = await ctx.admin
    .from('endesa_divida_consultas')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', ctx.me.id)
    .gte('created_at', desde)
  if ((count ?? 0) >= LIMITE_HORA) {
    return NextResponse.json({ error: 'Muitas consultas na última hora. Tenta mais tarde.' }, { status: 429 })
  }

  const carga = await ultimaCarga(ctx)
  if (!carga) return NextResponse.json({ error: 'Ainda não foi carregada nenhuma lista de dívida.' }, { status: 404 })

  const { data: hit } = await ctx.admin
    .from('endesa_divida_nifs')
    .select('nif')
    .eq('company_id', ctx.me.company_id)
    .eq('nif', nif)
    .maybeSingle()

  await ctx.admin.from('endesa_divida_consultas').insert({
    company_id: ctx.me.company_id,
    user_id: ctx.me.id,
    nif_fim: nif.slice(-3),
    encontrado: !!hit,
  })

  return NextResponse.json({
    encontrado: !!hit,
    nif_valido: nifValido(nif),
    data_lista: carga.data_lista,
    carregada_em: carga.created_at,
  })
}

// POST (só admin): carrega NIFs em blocos. { ficheiro, data_lista, carga_id?, nifs: string[] }
// Sem carga_id cria uma carga nova; os blocos seguintes enviam o carga_id devolvido.
// No fim, POST { concluir: true, carga_id } apaga as cargas antigas (a lista nova substitui a anterior).
export async function POST(req: NextRequest) {
  const ctx = await campanhasUser()
  if (!ctx) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
  if (!['admin', 'super_admin'].includes(String(ctx.me.role))) {
    return NextResponse.json({ error: 'Só administradores carregam a lista.' }, { status: 403 })
  }
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 })
  const companyId = ctx.me.company_id

  if (body.concluir) {
    const cargaId = String(body.carga_id || '')
    const { count } = await ctx.admin
      .from('endesa_divida_nifs')
      .select('nif', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('carga_id', cargaId)
    await ctx.admin.from('endesa_divida_nifs').delete().eq('company_id', companyId).neq('carga_id', cargaId)
    await ctx.admin.from('endesa_divida_cargas').update({ total: count ?? 0 }).eq('id', cargaId).eq('company_id', companyId)
    return NextResponse.json({ ok: true, total: count ?? 0 })
  }

  let cargaId = String(body.carga_id || '')
  if (!cargaId) {
    const dataLista = /^\d{4}-\d{2}-\d{2}$/.test(String(body.data_lista || '')) ? body.data_lista : null
    const { data, error } = await ctx.admin
      .from('endesa_divida_cargas')
      .insert({ company_id: companyId, carregado_por: ctx.me.id, ficheiro: String(body.ficheiro || '').slice(0, 200), data_lista: dataLista })
      .select('id')
      .single()
    if (error || !data) return NextResponse.json({ error: 'Não foi possível criar a carga.' }, { status: 500 })
    cargaId = data.id
  }

  const nifs: string[] = Array.isArray(body.nifs) ? body.nifs : []
  const limpos = Array.from(new Set(nifs.map((n) => String(n).replace(/\s/g, '')).filter((n) => /^\d{9}$/.test(n)))).slice(0, 10000)
  if (limpos.length) {
    const { error } = await ctx.admin
      .from('endesa_divida_nifs')
      .upsert(limpos.map((nif) => ({ company_id: companyId, nif, carga_id: cargaId })), { onConflict: 'company_id,nif' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, carga_id: cargaId, recebidos: limpos.length })
}
