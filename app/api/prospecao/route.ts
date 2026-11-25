import { NextRequest, NextResponse } from 'next/server'
import { campanhasUser } from '@/lib/server/campanhas-auth'
import { clip, digitos, sugestaoPara, telPT, type Neg } from '@/lib/prospecao/osm'
import { groqFetch } from '@/lib/server/groq'

// Prospeção: a pesquisa no mapa (OpenStreetMap) corre no browser do vendedor, sem limite de tempo.
// Este endpoint regista a pesquisa e, só se houver TAVILY_API_KEY, junta contactos da web (rápido, < 9 s).
// Nunca usa a pesquisa web da Groq (gasta a quota diária e deixava as outras IAs sem resposta).

export const dynamic = 'force-dynamic'
export const maxDuration = 10

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const LIMITE_HORA = 60
const REGRAS = `Responde APENAS com JSON: {"negocios":[{"nome":"","telefone":"","email":"","morada":"","localidade":"","site":"","redes":"","fonte":0}]}.
Só negócios reais que aparecem nos textos; nunca inventes telefones, emails ou moradas (se não houver, ""). Telefone de Portugal (9 dígitos). "fonte" é o [i]. Ignora diretórios e listas "Top 10". Máx. 15.`

export async function POST(req: NextRequest) {
  const ctx = await campanhasUser()
  if (!ctx) return NextResponse.json({ error: 'Sessão expirada. Entra outra vez.' }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as { query?: string; local?: string; raioKm?: number }
  const query = clip(body.query, 80)
  const local = clip(body.local, 80)
  if (query.length < 2) return NextResponse.json({ resultados: [] })

  const desde = new Date(Date.now() - 3600_000).toISOString()
  const { count } = await ctx.admin.from('prospecao_pesquisas').select('id', { count: 'exact', head: true })
    .eq('user_id', ctx.me.id).gte('created_at', desde)
  if ((count ?? 0) >= LIMITE_HORA) return NextResponse.json({ resultados: [], aviso: 'limite' })
  await ctx.admin.from('prospecao_pesquisas').insert({ user_id: ctx.me.id, company_id: ctx.me.company_id, query, local: local || null, raio_km: Number(body.raioKm) || null })

  const tavily = process.env.TAVILY_API_KEY
  const groq = process.env.GROQ_API_KEY
  if (!tavily || !groq || !local) return NextResponse.json({ resultados: [] })

  try {
    const r = await fetch('https://api.tavily.com/search', {
      method: 'POST', signal: AbortSignal.timeout(4500),
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${tavily}` },
      body: JSON.stringify({ query: `${query} ${local} telefone contacto`, search_depth: 'basic', max_results: 8 }),
    })
    if (!r.ok) return NextResponse.json({ resultados: [] })
    const j = (await r.json()) as any
    const fontes: string[] = []
    const textos = (j?.results || []).map((it: any) => { fontes.push(String(it.url)); return `[${fontes.length - 1}] ${clip(it.title, 120)} | ${it.url}\n${clip(it.content, 1200)}` })
    if (!textos.length) return NextResponse.json({ resultados: [] })
    const base = digitos(textos.join(' '))
    const g = await groqFetch(GROQ_API_URL, {
      method: 'POST', signal: AbortSignal.timeout(4000),
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${groq}` },
      body: JSON.stringify({ model: 'llama-3.1-8b-instant', temperature: 0, response_format: { type: 'json_object' }, max_tokens: 900,
        messages: [{ role: 'system', content: REGRAS }, { role: 'user', content: textos.join('\n\n') }] }),
    })
    if (!g.ok) return NextResponse.json({ resultados: [] })
    const gj = (await g.json()) as any
    const negocios = JSON.parse(gj?.choices?.[0]?.message?.content || '{}')?.negocios || []
    const out: Neg[] = []
    for (const n of Array.isArray(negocios) ? negocios : []) {
      const nome = clip(n?.nome, 100)
      const tel = telPT(n?.telefone)
      if (!nome || !tel || !base.includes(tel)) continue
      const site = clip(n?.site, 200), redes = clip(n?.redes, 200)
      out.push({
        nome, telefone: tel, email: clip(n?.email, 100) || null, morada: clip(n?.morada, 160) || null,
        localidade: clip(n?.localidade, 60) || null, site: /^https?:\/\//.test(site) ? site : null,
        redes: /^https?:\/\//.test(redes) ? redes : null, fonte_url: fontes[Number(n?.fonte)] || null,
        categoria: null, lat: null, lng: null, distancia_km: null, origem: 'web', sugestao: sugestaoPara(query, /^https?:\/\//.test(site)),
      })
    }
    return NextResponse.json({ resultados: out })
  } catch {
    return NextResponse.json({ resultados: [] })
  }
}
