import { NextRequest, NextResponse } from 'next/server'
import { campanhasUser } from '@/lib/server/campanhas-auth'

// Prospeção de empresas: pesquisa na web (Tavily) e a IA (Groq) extrai nome/contactos.
// Só devolve telefones que aparecem mesmo no texto das páginas lidas (nada inventado).

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = process.env.COMANDO_GROQ_MODEL || 'openai/gpt-oss-120b'
const LIMITE_HORA = 20

const clip = (v: unknown, n: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n)
const digitos = (s: string) => s.replace(/\D/g, '')

function telPT(raw: unknown): string | null {
  let d = digitos(String(raw ?? ''))
  if (d.startsWith('00351')) d = d.slice(5)
  else if (d.startsWith('351') && d.length === 12) d = d.slice(3)
  return /^[239]\d{8}$/.test(d) ? d : null
}

function haversine(a: [number, number], b: [number, number]) {
  const R = 6371, rad = (x: number) => (x * Math.PI) / 180
  const dLat = rad(b[0] - a[0]), dLon = rad(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

async function geocode(q: string): Promise<[number, number] | null> {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=pt&q=${encodeURIComponent(q)}`, {
      headers: { 'User-Agent': 'SD-Dialer/1.0 (prospecao)' },
    })
    const j = (await r.json()) as any[]
    return j?.[0] ? [Number(j[0].lat), Number(j[0].lon)] : null
  } catch { return null }
}

async function localidadeDe(lat: number, lng: number): Promise<string | null> {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=10&lat=${lat}&lon=${lng}`, {
      headers: { 'User-Agent': 'SD-Dialer/1.0 (prospecao)' },
    })
    const j = (await r.json()) as any
    const a = j?.address || {}
    return a.city || a.town || a.municipality || a.village || a.county || null
  } catch { return null }
}

export async function POST(req: NextRequest) {
  const ctx = await campanhasUser()
  if (!ctx) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
  const tavily = process.env.TAVILY_API_KEY
  const groq = process.env.GROQ_API_KEY
  if (!groq) return NextResponse.json({ error: 'IA não configurada.' }, { status: 503 })

  const body = (await req.json().catch(() => ({}))) as {
    query?: string; local?: string; lat?: number; lng?: number; raioKm?: number
  }
  const query = clip(body.query, 80)
  if (query.length < 3) return NextResponse.json({ error: 'Escreve o tipo de negócio (ex.: restaurantes).' }, { status: 400 })

  // limite por utilizador (custos)
  const desde = new Date(Date.now() - 3600_000).toISOString()
  const { count } = await ctx.admin.from('prospecao_pesquisas').select('id', { count: 'exact', head: true })
    .eq('user_id', ctx.me.id).gte('created_at', desde)
  if ((count ?? 0) >= LIMITE_HORA) return NextResponse.json({ error: 'Muitas pesquisas na última hora. Tenta mais tarde.' }, { status: 429 })

  // centro da pesquisa
  let centro: [number, number] | null = null
  let local = clip(body.local, 80)
  const raio = Math.min(Math.max(Number(body.raioKm) || 0, 0), 100)
  if (Number.isFinite(body.lat) && Number.isFinite(body.lng)) {
    centro = [Number(body.lat), Number(body.lng)]
    if (!local) local = (await localidadeDe(centro[0], centro[1])) || ''
  } else if (local) {
    centro = await geocode(local + ', Portugal')
  }
  if (!local) return NextResponse.json({ error: 'Indica a cidade ou usa a tua localização.' }, { status: 400 })

  await ctx.admin.from('prospecao_pesquisas').insert({ user_id: ctx.me.id, company_id: ctx.me.company_id, query, local, raio_km: raio || null })

  let fontes: Array<{ url: string; title: string; content: string }> = []
  let negocios: any[] = []
  let baseDigitos = ''

  const regrasJson = `Responde APENAS com JSON: {"negocios":[{"nome":"","telefone":"","email":"","morada":"","localidade":"","site":"","redes":"","fonte":0,"sugestao":""}]}.
Regras:
- Só negócios reais que encontraste; nunca inventes telefones, emails ou moradas. Se não houver telefone, deixa "".
- Telefone em Portugal (9 dígitos). "redes" é o link do Facebook/Instagram se existir.
- Ignora diretórios genéricos, notícias e listas ("Top 10"); queremos o negócio em si.
- "sugestao": 1 frase em português de Portugal sobre o que oferecer (ex.: sem site → criação de site; várias linhas móveis → pacote empresarial de telecom; consumo de energia → poupança na fatura de luz).
- Máx. 15 negócios.`

  if (tavily) {
    // 1) pesquisa web (Tavily)
    const buscas = [`${query} ${local} telefone contacto`, `${query} ${local} páginas amarelas facebook instagram`]
    const vistos = new Set<string>()
    for (const q of buscas) {
      try {
        const r = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'content-type': 'application/json', Authorization: `Bearer ${tavily}` },
          body: JSON.stringify({ query: q, search_depth: 'advanced', max_results: 8, include_answer: false }),
        })
        if (!r.ok) continue
        const j = (await r.json()) as any
        for (const it of j?.results || []) {
          if (!it?.url || vistos.has(it.url)) continue
          vistos.add(it.url)
          fontes.push({ url: String(it.url), title: clip(it.title, 120), content: clip(it.content, 1800) })
        }
      } catch {}
    }
    if (!fontes.length) return NextResponse.json({ resultados: [], aviso: 'A pesquisa não devolveu páginas. Tenta outro termo ou local.' })
    const textoFontes = fontes.slice(0, 14).map((f, i) => `[${i}] ${f.title} | ${f.url}\n${f.content}`).join('\n\n')
    baseDigitos = digitos(fontes.map((f) => f.content).join(' '))
    try {
      const r = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${groq}` },
        body: JSON.stringify({
          model: MODEL, temperature: 0.1, response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: `Extrais negócios de resultados de pesquisa web. "fonte" é o número [i] do texto onde viste o negócio.\n${regrasJson}` },
            { role: 'user', content: `Pesquisa: ${query} em ${local}\n\n${textoFontes}` },
          ],
        }),
      })
      const j = (await r.json()) as any
      const parsed = JSON.parse(j?.choices?.[0]?.message?.content || '{}')
      negocios = Array.isArray(parsed?.negocios) ? parsed.negocios : []
    } catch {
      return NextResponse.json({ error: 'A IA não conseguiu processar. Tenta outra vez.' }, { status: 502 })
    }
  } else {
    // 1+2) sem Tavily: pesquisa web da própria Groq (groq/compound), com a mesma chave da IA
    try {
      const r = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${groq}` },
        body: JSON.stringify({
          model: process.env.PROSPECAO_GROQ_MODEL || 'groq/compound-mini', temperature: 0.1,
          compound_custom: { tools: { enabled_tools: ['web_search'] } },
          search_settings: { country: 'portugal' },
          messages: [
            { role: 'system', content: `Procuras na web empresas de Portugal com contacto telefónico para um vendedor ligar. Usa a pesquisa web (Páginas Amarelas, Facebook, sites dos negócios). "fonte" deixa 0.\n${regrasJson}` },
            { role: 'user', content: `Encontra ${query} em ${local}${raio ? ` (até ${raio} km)` : ''}, com telefone.` },
          ],
        }),
      })
      if (!r.ok) return NextResponse.json({ error: 'A pesquisa da IA falhou. Tenta outra vez.' }, { status: 502 })
      const j = (await r.json()) as any
      const msg = j?.choices?.[0]?.message || {}
      const m = String(msg.content || '').match(/\{[\s\S]*\}/)
      const parsed = m ? JSON.parse(m[0]) : {}
      negocios = Array.isArray(parsed?.negocios) ? parsed.negocios : []
      const tools = JSON.stringify(msg.executed_tools || [])
      baseDigitos = digitos(tools)
      for (const et of msg.executed_tools || []) {
        for (const it of et?.search_results?.results || []) {
          if (it?.url) fontes.push({ url: String(it.url), title: clip(it.title, 120), content: '' })
        }
      }
    } catch {
      return NextResponse.json({ error: 'A IA não conseguiu pesquisar. Tenta outra vez.' }, { status: 502 })
    }
  }

  // 3) validar telefones, filtrar por raio, deduplicar
  const cacheLoc = new Map<string, [number, number] | null>()
  const out: any[] = []
  const tels = new Set<string>()
  for (const n of negocios) {
    const nome = clip(n?.nome, 100)
    if (!nome) continue
    let tel = telPT(n?.telefone)
    if (tel && !baseDigitos.includes(tel)) tel = null // anti-alucinação
    if (tel && tels.has(tel)) continue
    if (tel) tels.add(tel)
    const localidade = clip(n?.localidade, 60)
    let distancia: number | null = null
    if (centro && localidade) {
      const k = localidade.toLowerCase()
      if (!cacheLoc.has(k)) { cacheLoc.set(k, await geocode(localidade + ', Portugal')); await new Promise((r) => setTimeout(r, 1100)) }
      const c = cacheLoc.get(k)
      if (c) distancia = Math.round(haversine(centro, c))
    }
    if (raio && distancia != null && distancia > raio) continue
    const f = tavily ? (fontes[Number(n?.fonte)] || null) : null
    const site = clip(n?.site, 200)
    const redes = clip(n?.redes, 200)
    out.push({
      nome, telefone: tel, email: clip(n?.email, 100) || null, morada: clip(n?.morada, 160) || null,
      localidade: localidade || null, site: /^https?:\/\//.test(site) ? site : null,
      redes: /^https?:\/\//.test(redes) ? redes : null, fonte_url: f?.url || (/^https?:\/\//.test(site) ? site : null),
      sugestao: clip(n?.sugestao, 220) || null, distancia_km: distancia,
    })
  }
  out.sort((a, b) => Number(!!b.telefone) - Number(!!a.telefone) || (a.distancia_km ?? 999) - (b.distancia_km ?? 999))
  return NextResponse.json({ resultados: out, local })
}
