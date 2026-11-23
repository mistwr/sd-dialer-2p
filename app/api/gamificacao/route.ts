import { NextRequest, NextResponse } from 'next/server'
import { errorResponse, requireSdDialerUser, SdDialerError } from '@/lib/server/sd-dialer-livekit'
import { NATAL_PADRAO, PONTOS } from '@/lib/formacao-conteudo'

// Ranking da equipa (só a própria empresa): chamadas, conversas reais, vendas e formação.
// Períodos: semana, mês e Desafio de Natal. Os prémios do Natal são guardados por empresa no storage.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BUCKET = 'campaign-files'
const CONVERSA = new Set(['nao_interessado', 'ligar_depois', 'venda', 'outro'])
const PAGE = 1000

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
    const companyId = String(profile.company_id)
    const periodo = request.nextUrl.searchParams.get('periodo') || 'semana'
    const natal = await lerNatal(admin, companyId)
    const { de, ate } = inicioPeriodo(periodo, natal)
    const deIso = de.toISOString(), ateIso = (ate || new Date(Date.now() + 86400000)).toISOString()

    const { data: users } = await admin.from('usuarios')
      .select('id, full_name, avatar_url, role, status')
      .eq('company_id', companyId).eq('status', 'active').in('role', ['parceiro', 'supervisor'])
    const equipa = new Map<string, any>()
    for (const u of users || []) equipa.set(String(u.id), { id: u.id, nome: u.full_name || 'Sem nome', avatar: u.avatar_url, role: u.role, chamadas: 0, conversas: 0, vendas: 0, modulos: 0, pontos: 0 })

    const calls = await todos(() => admin.from('call_history').select('parceiro_id,result').eq('company_id', companyId).gte('called_at', deIso).lte('called_at', ateIso))
    for (const c of calls) {
      const e = equipa.get(String(c.parceiro_id)); if (!e) continue
      e.chamadas += 1
      if (CONVERSA.has(String(c.result))) e.conversas += 1
    }
    const vendas = await todos(() => admin.from('vendas').select('seller_id').eq('company_id', companyId).is('deleted_at', null).gte('created_at', deIso).lte('created_at', ateIso))
    for (const v of vendas) { const e = equipa.get(String(v.seller_id)); if (e) e.vendas += 1 }

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

    const ranking = [...equipa.values()].map((e) => ({
      ...e,
      pontos: e.chamadas * PONTOS.chamada + e.conversas * PONTOS.conversa + e.vendas * PONTOS.venda + e.modulos * PONTOS.modulo,
    })).sort((a, b) => b.pontos - a.pontos || b.vendas - a.vendas || b.chamadas - a.chamadas)

    return NextResponse.json({ periodo, de: deIso, ate: ate ? ateIso : null, ranking, natal, pontos: PONTOS, eu: profile.id })
  } catch (err) {
    return errorResponse(err, 'gamificacao')
  }
}

// Admin/supervisor define os prémios e datas do Desafio de Natal da sua empresa.
export async function PUT(request: NextRequest) {
  try {
    const { admin, profile } = await requireSdDialerUser(request)
    if (!['admin', 'supervisor'].includes(String(profile.role)) && !profile.is_super_admin) throw new SdDialerError('Só admin ou supervisor.', 403)
    const body = await request.json().catch(() => ({}))
    const natal = {
      inicio: /^\d{4}-\d{2}-\d{2}$/.test(body?.inicio) ? body.inicio : NATAL_PADRAO.inicio,
      fim: /^\d{4}-\d{2}-\d{2}$/.test(body?.fim) ? body.fim : NATAL_PADRAO.fim,
      premios: (Array.isArray(body?.premios) ? body.premios : NATAL_PADRAO.premios).slice(0, 5).map((p: any) => String(p).slice(0, 120)),
    }
    const { error } = await admin.storage.from(BUCKET).upload(`gamificacao/${profile.company_id}.json`,
      new Blob([JSON.stringify({ natal })], { type: 'application/json' }), { upsert: true, contentType: 'application/json' })
    if (error) throw new SdDialerError(error.message, 500)
    return NextResponse.json({ natal })
  } catch (err) {
    return errorResponse(err, 'gamificacao')
  }
}
