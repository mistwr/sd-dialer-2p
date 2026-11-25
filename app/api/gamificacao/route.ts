import { NextRequest, NextResponse } from 'next/server'
import { errorResponse, requireSdDialerUser, SdDialerError } from '@/lib/server/sd-dialer-livekit'
import { NATAL_PADRAO, PONTOS, PONTOS_VENDAS, eEnergia, pontosVendas } from '@/lib/formacao-conteudo'

// Ranking único do SD Dialer: todos os comerciais ativos de todas as empresas, e todos veem todos.
// Pontos por vendas: TV 3 / energia 0,5; a partir de 8 TVs ou 20 energias, TV 4 / energia 1. Chamadas e conversas desempatam.
// Inclui resultados lançados à mão pelo super admin (tabela ranking_ajustes). Períodos: semana, mês e Desafio de Natal.
// O Desafio de Natal (datas e prémios) é um só para todo o SD Dialer e só o super admin o altera.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BUCKET = 'campaign-files'
const CONVERSA = new Set(['nao_interessado', 'ligar_depois', 'venda', 'outro'])
const PAGE = 1000
const NATAL_GLOBAL = process.env.RANKING_NATAL_COMPANY_ID || 'e27c8324-989a-4a68-b3a3-902cba74696c'

function inicioPeriodo(periodo: string, natal: { inicio: string; fim: string }) {
  const now = new Date()
  if (periodo === 'mes') return { de: new Date(now.getFullYear(), now.getMonth(), 1), ate: null as Date | null }
  if (periodo === 'natal') return { de: new Date(`${natal.inicio}T00:00:00Z`), ate: new Date(`${natal.fim}T23:59:59Z`) }
  const d = new Date(now); const dow = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dow); d.setHours(0, 0, 0, 0)
  return { de: d, ate: null as Date | null }
}

async function lerNatal(admin: any, companyId: string) {
  const { data } = await admin.storage.from(BUCKET).download(`gamificacao/${companyId}.json`)
  if (!data) return { ...NATAL_PADRAO }
  try { return { ...NATAL_PADRAO, ...(JSON.parse(await data.text())?.natal || {}) } } catch { return { ...NATAL_PADRAO } }
}

async function todos(q: () => any) {
  const out: any[] = []
  for (let off = 0; ; off += PAGE) {
    const { data, error } = await q().range(off, off + PAGE - 1)
    if (error) throw new SdDialerError(error.message, 500)
    out.push(...(data || []))
    if (!data || data.length < PAGE) break
  }
  return out
}

export async function GET(request: NextRequest) {
  try {
    const { admin, profile } = await requireSdDialerUser(request)
    const periodo = request.nextUrl.searchParams.get('periodo') || 'semana'
    const natal = await lerNatal(admin, NATAL_GLOBAL)
    const { de, ate } = inicioPeriodo(periodo, natal)
    const deIso = de.toISOString(), ateIso = (ate || new Date(Date.now() + 86400000)).toISOString()

    const { data: users } = await admin.from('usuarios')
      .select('id, full_name, avatar_url, role, status, company_id')
      .eq('status', 'active').in('role', ['parceiro', 'supervisor'])
    const { data: emps } = await admin.from('companies').select('id, name')
    const nomeEmpresa = new Map<string, string>((emps || []).map((e: any) => [String(e.id), String(e.name || '')]))
    const equipa = new Map<string, any>()
    for (const u of users || []) equipa.set(String(u.id), { id: u.id, nome: u.full_name || 'Sem nome', avatar: u.avatar_url, role: u.role, empresa: nomeEmpresa.get(String(u.company_id)) || null, chamadas: 0, conversas: 0, vendas: 0, tvs: 0, energias: 0, modulos: 0, pontos: 0, top: false })

    const calls = await todos(() => admin.from('call_history').select('parceiro_id,result').gte('called_at', deIso).lte('called_at', ateIso))
    for (const c of calls) {
      const e = equipa.get(String(c.parceiro_id)); if (!e) continue
      e.chamadas += 1
      if (CONVERSA.has(String(c.result))) e.conversas += 1
    }
    const vendas = await todos(() => admin.from('vendas').select('seller_id, service_type, operator').is('deleted_at', null).gte('created_at', deIso).lte('created_at', ateIso))
    for (const v of vendas) {
      const e = equipa.get(String(v.seller_id)); if (!e) continue
      e.vendas += 1
      if (eEnergia(v.service_type, v.operator)) e.energias += 1; else e.tvs += 1
    }

    // Resultados lançados à mão: entram nos períodos 'mês' e 'Natal' quando o mês cruza o período (não na semana).
    let ajustes: any[] = []
    if (periodo !== 'semana') {
      const mesIni = new Date(Date.UTC(de.getUTCFullYear(), de.getUTCMonth(), 1)).toISOString().slice(0, 10)
      const { data } = await admin.from('ranking_ajustes').select('id, mes, user_id, nome, tvs, energias, chamadas, nota')
        .gte('mes', mesIni).lte('mes', ateIso.slice(0, 10))
      ajustes = data || []
      for (const a of ajustes) {
        let e = a.user_id ? equipa.get(String(a.user_id)) : null
        if (!e) {
          const k = 'aj:' + String(a.nome).trim().toLowerCase()
          e = equipa.get(k)
          if (!e) { e = { id: k, nome: a.nome, avatar: null, role: 'parceiro', empresa: null, chamadas: 0, conversas: 0, vendas: 0, tvs: 0, energias: 0, modulos: 0, pontos: 0, top: false, manual: true }; equipa.set(k, e) }
        }
        e.tvs += Number(a.tvs) || 0
        e.energias += Number(a.energias) || 0
        e.vendas += (Number(a.tvs) || 0) + (Number(a.energias) || 0)
        e.chamadas += Number(a.chamadas) || 0
      }
    }

    // Formação: módulos passados dentro do período (app_metadata.formacao).
    for (let page = 1; page <= 10; page++) {
      const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
      const lista = data?.users || []
      for (const u of lista) {
        const e = equipa.get(String(u.id)); if (!e) continue
        const prog = ((u.app_metadata as any)?.formacao || {}) as Record<string, string>
        e.modulos = Object.values(prog).filter((d) => d >= deIso && d <= ateIso).length
      }
      if (lista.length < 1000) break
    }

    const ranking = [...equipa.values()].map((e) => {
      const pv = pontosVendas(e.tvs, e.energias)
      return { ...e, pontos: pv.pontos, top: pv.top }
    }).sort((a, b) => b.pontos - a.pontos || b.vendas - a.vendas || b.conversas - a.conversas || b.chamadas - a.chamadas)

    return NextResponse.json({ periodo, de: deIso, ate: ate ? ateIso : null, ranking, natal, pontos: PONTOS, pontosVendas: PONTOS_VENDAS, eu: profile.id, podeEditar: !!profile.is_super_admin,
      ajustes: profile.is_super_admin ? ajustes : undefined })
  } catch (err) {
    return errorResponse(err, 'gamificacao')
  }
}

// Só o super admin define os prémios e as datas do Desafio de Natal (um só para todo o SD Dialer).
export async function PUT(request: NextRequest) {
  try {
    const { admin, profile } = await requireSdDialerUser(request)
    if (!profile.is_super_admin) throw new SdDialerError('Só o super admin altera o Desafio de Natal.', 403)
    const body = await request.json().catch(() => ({}))
    const natal = {
      inicio: /^\d{4}-\d{2}-\d{2}$/.test(body?.inicio) ? body.inicio : NATAL_PADRAO.inicio,
      fim: /^\d{4}-\d{2}-\d{2}$/.test(body?.fim) ? body.fim : NATAL_PADRAO.fim,
      premios: (Array.isArray(body?.premios) ? body.premios : NATAL_PADRAO.premios).slice(0, 5).map((p: any) => String(p).slice(0, 120)),
    }
    const { error } = await admin.storage.from(BUCKET).upload(`gamificacao/${NATAL_GLOBAL}.json`,
      new Blob([JSON.stringify({ natal })], { type: 'application/json' }), { upsert: true, contentType: 'application/json' })
    if (error) throw new SdDialerError(error.message, 500)
    return NextResponse.json({ natal })
  } catch (err) {
    return errorResponse(err, 'gamificacao')
  }
}
