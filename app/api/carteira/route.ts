import { NextRequest, NextResponse } from 'next/server'
import { errorResponse, requireSdDialerUser } from '@/lib/server/sd-dialer-livekit'
import { PONTOS_VENDAS, eEnergia, pontosVendas } from '@/lib/formacao-conteudo'

// Carteira de comissões: pontos do mês (TV 3 / energia 0,5; escalão a partir de 8 TVs ou 20 energias: TV 4 / energia 1)
// x valor do ponto (25 € por defeito). Cada vendedor vê a sua; o super admin vê a equipa toda e o total.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VALOR_PONTO = Number(process.env.VALOR_PONTO_EUR) || 25

export async function GET(request: NextRequest) {
  try {
    const { admin, user, profile } = await requireSdDialerUser(request)
    const superAdmin = !!profile.is_super_admin
    const m = request.nextUrl.searchParams.get('mes')
    const agora = new Date()
    const [ano, mes] = m && /^\d{4}-\d{2}$/.test(m) ? m.split('-').map(Number) : [agora.getFullYear(), agora.getMonth() + 1]
    const de = new Date(Date.UTC(ano, mes - 1, 1)), ate = new Date(Date.UTC(ano, mes, 1))
    const mesIso = de.toISOString().slice(0, 10)

    let qv = admin.from('vendas').select('id, seller_id, client_name, service_type, operator, plano, status, created_at')
      .is('deleted_at', null).gte('created_at', de.toISOString()).lt('created_at', ate.toISOString()).order('created_at', { ascending: false }).limit(5000)
    if (!superAdmin) qv = qv.eq('seller_id', user.id)
    let qa = admin.from('ranking_ajustes').select('id, user_id, nome, tvs, energias, chamadas, nota, fora_ranking').eq('mes', mesIso)
    if (!superAdmin) qa = qa.eq('user_id', user.id)
    const [{ data: vendas }, { data: ajustes }, { data: users }, { data: emps }] = await Promise.all([
      qv, qa,
      superAdmin ? admin.from('usuarios').select('id, full_name, company_id') : Promise.resolve({ data: [] as any[] }),
      superAdmin ? admin.from('companies').select('id, name') : Promise.resolve({ data: [] as any[] }),
    ])

    type Acum = { id: string; nome: string; empresa: string; tvs: number; energias: number }
    const nomeU = new Map<string, any>((users || []).map((u: any) => [String(u.id), u]))
    const nomeE = new Map<string, string>((emps || []).map((e: any) => [String(e.id), String(e.name || '')]))
    const acc = new Map<string, Acum>()
    const pega = (id: string, nome: string, empresa = '') => {
      let a = acc.get(id); if (!a) { a = { id, nome, empresa, tvs: 0, energias: 0 }; acc.set(id, a) } return a
    }
    const minhas: any[] = []
    for (const v of vendas || []) {
      const energia = eEnergia(v.service_type, v.operator)
      const u = nomeU.get(String(v.seller_id))
      const a = pega(String(v.seller_id), u?.full_name || 'Vendedor', nomeE.get(String(u?.company_id)) || '')
      if (energia) a.energias += 1; else a.tvs += 1
      if (String(v.seller_id) === user.id) minhas.push({ ...v, tipo: energia ? 'energia' : 'tv' })
    }
    for (const j of ajustes || []) {
      if (j.fora_ranking) continue
      const u = j.user_id ? nomeU.get(String(j.user_id)) : null
      const a = pega(j.user_id ? String(j.user_id) : 'aj:' + String(j.nome).toLowerCase(), u?.full_name || j.nome, nomeE.get(String(u?.company_id)) || '')
      a.tvs += Number(j.tvs) || 0; a.energias += Number(j.energias) || 0
    }
    const linha = (a: Acum) => { const p = pontosVendas(a.tvs, a.energias); return { ...a, pontos: p.pontos, top: p.top, euros: Math.round(p.pontos * VALOR_PONTO * 100) / 100 } }
    const eu = linha(acc.get(user.id) || { id: user.id, nome: '', empresa: '', tvs: 0, energias: 0 })
    const equipa = superAdmin ? [...acc.values()].map(linha).sort((a, b) => b.euros - a.euros) : undefined

    return NextResponse.json({
      mes: `${ano}-${String(mes).padStart(2, '0')}`, valorPonto: VALOR_PONTO, regras: PONTOS_VENDAS,
      eu, vendas: minhas, ajustes: (ajustes || []).filter((j: any) => j.user_id === user.id && !j.fora_ranking),
      equipa, total: equipa ? Math.round(equipa.reduce((t, l) => t + l.euros, 0) * 100) / 100 : undefined,
    })
  } catch (err) {
    return errorResponse(err, 'carteira')
  }
}
