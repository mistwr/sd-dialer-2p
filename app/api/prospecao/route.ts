import { NextRequest, NextResponse } from 'next/server'
import { campanhasUser } from '@/lib/server/campanhas-auth'

// Prospeção de empresas.
// Base garantida e sem chaves: OpenStreetMap (Overpass, com espelhos; Nominatim de reserva) num raio real.
// Reforço opcional: pesquisa web (Tavily se houver TAVILY_API_KEY, senão Groq com browser_search). Se o reforço
// falhar, é ignorado em silêncio — o vendedor recebe sempre a lista do mapa.

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = process.env.COMANDO_GROQ_MODEL || 'openai/gpt-oss-120b'
const LIMITE_HORA = 40
const UA = 'SD-Dialer/1.0 (prospecao; contacto: suporte sd dialer)'
const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]

const clip = (v: unknown, n: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n)
const digitos = (s: string) => s.replace(/\D/g, '')
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

function telPT(raw: unknown): string | null {
  const primeiro = String(raw ?? '').split(/[;,/]| ou /)[0]
  let d = digitos(primeiro)
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
      headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000),
    })
    const j = (await r.json()) as any[]
    return j?.[0] ? [Number(j[0].lat), Number(j[0].lon)] : null
  } catch { return null }
}

async function localidadeDe(lat: number, lng: number): Promise<string | null> {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=12&lat=${lat}&lon=${lng}`, {
      headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000),
    })
    const j = (await r.json()) as any
    const a = j?.address || {}
    return a.city || a.town || a.municipality || a.village || a.county || null
  } catch { return null }
}

// ---------- categorias (português → etiquetas OSM)
const CATS: Array<{ chaves: string[]; filtros: string[]; nome: string }> = [
  { nome: 'Restaurante', chaves: ['restaurante', 'comida', 'tasca', 'churrasqueira', 'pizzaria', 'marisqueira', 'sushi', 'hamburgueria'], filtros: ['["amenity"="restaurant"]', '["amenity"="fast_food"]'] },
  { nome: 'Café', chaves: ['cafe', 'pastelaria', 'padaria', 'snack'], filtros: ['["amenity"="cafe"]', '["shop"="bakery"]', '["shop"="pastry"]'] },
  { nome: 'Bar', chaves: ['bar', 'pub', 'discoteca'], filtros: ['["amenity"="bar"]', '["amenity"="pub"]', '["amenity"="nightclub"]'] },
  { nome: 'Clínica', chaves: ['clinica', 'saude', 'medico', 'consultorio', 'fisioterapia', 'policlinica'], filtros: ['["amenity"="clinic"]', '["amenity"="doctors"]', '["healthcare"="clinic"]', '["healthcare"="doctor"]', '["healthcare"="physiotherapist"]'] },
  { nome: 'Dentista', chaves: ['dentista', 'dentaria', 'dental'], filtros: ['["amenity"="dentist"]', '["healthcare"="dentist"]'] },
  { nome: 'Farmácia', chaves: ['farmacia', 'parafarmacia'], filtros: ['["amenity"="pharmacy"]', '["shop"="chemist"]'] },
  { nome: 'Cabeleireiro', chaves: ['cabeleireiro', 'barbearia', 'barbeiro', 'estetica', 'beleza', 'unhas', 'spa'], filtros: ['["shop"="hairdresser"]', '["shop"="beauty"]', '["leisure"="spa"]'] },
  { nome: 'Oficina', chaves: ['oficina', 'mecanico', 'automovel', 'automoveis', 'carro', 'stand', 'pneu'], filtros: ['["shop"="car_repair"]', '["shop"="car"]', '["shop"="tyres"]'] },
  { nome: 'Imobiliária', chaves: ['imobiliaria', 'mediacao'], filtros: ['["office"="estate_agent"]', '["shop"="estate_agent"]'] },
  { nome: 'Advogado', chaves: ['advogado', 'advocacia', 'solicitador', 'notario'], filtros: ['["office"="lawyer"]', '["office"="notary"]'] },
  { nome: 'Contabilista', chaves: ['contabilista', 'contabilidade', 'contas'], filtros: ['["office"="accountant"]', '["office"="tax_advisor"]'] },
  { nome: 'Ginásio', chaves: ['ginasio', 'fitness', 'crossfit', 'pilates'], filtros: ['["leisure"="fitness_centre"]', '["leisure"="sports_centre"]'] },
  { nome: 'Hotel', chaves: ['hotel', 'alojamento', 'hostel', 'guest', 'residencial', 'turismo'], filtros: ['["tourism"="hotel"]', '["tourism"="guest_house"]', '["tourism"="hostel"]', '["tourism"="apartment"]'] },
  { nome: 'Supermercado', chaves: ['supermercado', 'mercearia', 'minimercado', 'frutaria'], filtros: ['["shop"="supermarket"]', '["shop"="convenience"]', '["shop"="greengrocer"]'] },
  { nome: 'Talho', chaves: ['talho', 'peixaria'], filtros: ['["shop"="butcher"]', '["shop"="seafood"]'] },
  { nome: 'Florista', chaves: ['florista', 'flores'], filtros: ['["shop"="florist"]'] },
  { nome: 'Ótica', chaves: ['otica', 'oculista'], filtros: ['["shop"="optician"]'] },
  { nome: 'Lavandaria', chaves: ['lavandaria', 'engomadoria'], filtros: ['["shop"="laundry"]', '["shop"="dry_cleaning"]'] },
  { nome: 'Veterinário', chaves: ['veterinario', 'pet', 'animais'], filtros: ['["amenity"="veterinary"]', '["shop"="pet"]'] },
  { nome: 'Escola', chaves: ['escola', 'colegio', 'creche', 'infantario', 'explicacoes', 'formacao'], filtros: ['["amenity"="school"]', '["amenity"="kindergarten"]', '["amenity"="college"]'] },
  { nome: 'Construção', chaves: ['construcao', 'obras', 'canalizador', 'eletricista', 'carpintaria', 'serralharia', 'ferragens'], filtros: ['["craft"="builder"]', '["craft"="plumber"]', '["craft"="electrician"]', '["craft"="carpenter"]', '["shop"="hardware"]'] },
  { nome: 'Seguros', chaves: ['seguro', 'seguradora'], filtros: ['["office"="insurance"]'] },
  { nome: 'Loja', chaves: ['loja', 'comercio', 'roupa', 'sapataria', 'boutique'], filtros: ['["shop"="clothes"]', '["shop"="shoes"]', '["shop"="boutique"]', '["shop"="gift"]'] },
  { nome: 'Escritório', chaves: ['empresa', 'escritorio', 'consultoria', 'agencia'], filtros: ['["office"="company"]', '["office"="consulting"]', '["office"="it"]', '["office"="advertising_agency"]'] },
]

function categoriasDe(q: string) {
  const palavras = norm(q).split(/[^a-z0-9]+/).filter((w) => w.length >= 3).map((w) => w.replace(/s$/, ''))
  return CATS.filter((c) => c.chaves.some((k) => palavras.some((w) => w === k || w.startsWith(k) || k.startsWith(w))))
}

const ROTULO: Record<string, string> = {
  restaurant: 'Restaurante', fast_food: 'Comida rápida', cafe: 'Café', bakery: 'Padaria', pastry: 'Pastelaria', bar: 'Bar', pub: 'Pub',
  clinic: 'Clínica', doctors: 'Consultório', doctor: 'Médico', dentist: 'Dentista', pharmacy: 'Farmácia', hairdresser: 'Cabeleireiro',
  beauty: 'Estética', car_repair: 'Oficina', car: 'Stand', tyres: 'Pneus', estate_agent: 'Imobiliária', lawyer: 'Advogado',
  accountant: 'Contabilista', fitness_centre: 'Ginásio', hotel: 'Hotel', guest_house: 'Alojamento', hostel: 'Hostel',
  supermarket: 'Supermercado', convenience: 'Mercearia', butcher: 'Talho', florist: 'Florista', optician: 'Ótica',
  laundry: 'Lavandaria', veterinary: 'Veterinário', school: 'Escola', kindergarten: 'Creche', insurance: 'Seguros',
  clothes: 'Roupa', shoes: 'Sapataria', company: 'Empresa', it: 'Informática', builder: 'Construção', plumber: 'Canalizador',
  electrician: 'Eletricista', hardware: 'Ferragens',
}

type Neg = {
  nome: string; telefone: string | null; email: string | null; morada: string | null; localidade: string | null
  site: string | null; redes: string | null; fonte_url: string | null; sugestao: string | null; distancia_km: number | null
  categoria: string | null; lat: number | null; lng: number | null; origem: 'mapa' | 'web'
}

function sugestaoPara(cat: string | null, temSite: boolean): string {
  const c = norm(cat || '')
  let base = 'Negócio local: fibra empresarial, telemóveis da equipa e tarifário de energia para empresa.'
  if (/restaura|cafe|bar|pub|padaria|pastelaria|hotel|alojamento|hostel|comida/.test(c)) base = 'Restauração/alojamento: internet + TV para clientes, linhas móveis e poupança na luz e gás (consumo alto).'
  else if (/clinic|consult|medic|dentist|farmac|veterin|otica/.test(c)) base = 'Saúde: fibra empresarial fiável, central telefónica e linhas móveis para a equipa.'
  else if (/advog|contabil|imobili|seguro|empresa|informatica|escritor/.test(c)) base = 'Escritório: fibra empresarial com IP fixo, telemóveis da equipa e energia para empresa.'
  else if (/oficina|stand|pneu|constru|canaliz|eletric|ferrag/.test(c)) base = 'Oficina/obras: telemóveis com muitos dados para a equipa e energia trifásica com melhor preço.'
  return temSite ? base : `Sem site: propõe site profissional + ficha Google. ${base}`
}

function urlRede(v: unknown, rede: 'facebook' | 'instagram'): string | null {
  const s = clip(v, 200)
  if (!s) return null
  if (/^https?:\/\//.test(s)) return s
  const h = s.replace(/^@/, '')
  return rede === 'facebook' ? `https://www.facebook.com/${h}` : `https://www.instagram.com/${h}`
}

function deTags(t: Record<string, string>, lat: number, lng: number, centro: [number, number]): Neg | null {
  const nome = clip(t.name || t.brand || t['name:pt'], 100)
  if (!nome) return null
  const telefone = telPT(t.phone || t['contact:phone'] || t.mobile || t['contact:mobile'])
  const siteRaw = clip(t.website || t['contact:website'] || t.url, 200)
  const site = siteRaw ? (/^https?:\/\//.test(siteRaw) ? siteRaw : `https://${siteRaw}`) : null
  const redes = urlRede(t['contact:facebook'] || t.facebook, 'facebook') || urlRede(t['contact:instagram'] || t.instagram, 'instagram')
  const tipo = t.amenity || t.shop || t.office || t.healthcare || t.tourism || t.craft || t.leisure || ''
  const categoria = ROTULO[tipo] || (tipo ? tipo.replace(/_/g, ' ') : null)
  const rua = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' ')
  const morada = [rua, t['addr:postcode']].filter(Boolean).join(', ') || null
  return {
    nome, telefone, email: clip(t.email || t['contact:email'], 100) || null, morada,
    localidade: clip(t['addr:city'] || t['addr:place'] || t['addr:suburb'], 60) || null,
    site, redes, fonte_url: null, categoria, lat, lng, origem: 'mapa',
    distancia_km: Math.round(haversine(centro, [lat, lng]) * 10) / 10,
    sugestao: sugestaoPara(categoria, !!site),
  }
}

async function viaOverpass(q: string, centro: [number, number], raioKm: number): Promise<Neg[] | null> {
  const cats = categoriasDe(q)
  const m = Math.round(raioKm * 1000)
  const around = `(around:${m},${centro[0].toFixed(5)},${centro[1].toFixed(5)})`
  const telF = '[~"^(phone|contact:phone|mobile|contact:mobile)$"~"."]'
  let filtros: string[]
  if (cats.length) filtros = cats.flatMap((c) => c.filtros)
  else {
    const termo = norm(q).replace(/[^a-z0-9 ]/g, '').slice(0, 40)
    if (!termo) return []
    filtros = ['shop', 'amenity', 'office', 'craft', 'healthcare', 'tourism'].map((k) => `["${k}"]["name"~"${termo}",i]`)
  }
  const comTel = filtros.map((f) => `nwr${around}${f}${telF};`).join('')
  const todos = filtros.map((f) => `nwr${around}${f};`).join('')
  const data = `[out:json][timeout:22];(${comTel})->.c;.c out center tags 250;(${todos})->.t;(.t; - .c;)->.s;.s out center tags 80;`
  for (const url of OVERPASS) {
    try {
      const r = await fetch(url, {
        method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
        body: 'data=' + encodeURIComponent(data), signal: AbortSignal.timeout(20_000),
      })
      if (!r.ok) continue
      const j = (await r.json()) as any
      const out: Neg[] = []
      for (const e of j?.elements || []) {
        const lat = Number(e.lat ?? e.center?.lat), lng = Number(e.lon ?? e.center?.lon)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
        const n = deTags(e.tags || {}, lat, lng, centro)
        if (n) out.push(n)
      }
      return out
    } catch {}
  }
  return null
}

async function viaNominatim(q: string, centro: [number, number], raioKm: number): Promise<Neg[]> {
  const dLat = raioKm / 111, dLng = raioKm / (111 * Math.cos((centro[0] * Math.PI) / 180))
  const vb = [centro[1] - dLng, centro[0] + dLat, centro[1] + dLng, centro[0] - dLat].map((x) => x.toFixed(4)).join(',')
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&viewbox=${vb}&bounded=1&extratags=1&addressdetails=1&limit=50&countrycodes=pt`, {
      headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10_000),
    })
    const j = (await r.json()) as any[]
    const out: Neg[] = []
    for (const x of j || []) {
      const t: Record<string, string> = { ...(x.extratags || {}), name: x.name }
      const a = x.address || {}
      t['addr:street'] = t['addr:street'] || a.road
      t['addr:housenumber'] = t['addr:housenumber'] || a.house_number
      t['addr:postcode'] = t['addr:postcode'] || a.postcode
      t['addr:city'] = t['addr:city'] || a.city || a.town || a.village
      if (x.category && x.type && !t[x.category]) t[x.category] = x.type
      const n = deTags(t, Number(x.lat), Number(x.lon), centro)
      if (n && n.distancia_km != null && n.distancia_km <= raioKm) out.push(n)
    }
    return out
  } catch { return [] }
}

// ---------- reforço web (opcional e silencioso)
const REGRAS = `Responde APENAS com JSON: {"negocios":[{"nome":"","telefone":"","email":"","morada":"","localidade":"","site":"","redes":"","fonte":0}]}.
Só negócios reais que aparecem nos textos; nunca inventes telefones, emails ou moradas (se não houver, ""). Telefone de Portugal (9 dígitos).
Ignora diretórios, notícias e listas "Top 10". Máx. 15.`

async function viaWeb(query: string, local: string): Promise<Neg[]> {
  const groq = process.env.GROQ_API_KEY
  const tavily = process.env.TAVILY_API_KEY
  if (!groq) return []
  const fim = Date.now() + 25_000
  const resta = () => Math.max(1000, fim - Date.now())
  try {
    let negocios: any[] = []
    let base = ''
    const fontes: string[] = []
    if (tavily) {
      const textos: string[] = []
      for (const q of [`${query} ${local} telefone contacto`, `${query} ${local} páginas amarelas`]) {
        const r = await fetch('https://api.tavily.com/search', {
          method: 'POST', signal: AbortSignal.timeout(Math.min(resta(), 12_000)),
          headers: { 'content-type': 'application/json', Authorization: `Bearer ${tavily}` },
          body: JSON.stringify({ query: q, search_depth: 'basic', max_results: 8 }),
        }).catch(() => null)
        if (!r?.ok) continue
        const j = (await r.json()) as any
        for (const it of j?.results || []) {
          fontes.push(String(it.url))
          textos.push(`[${fontes.length - 1}] ${clip(it.title, 120)} | ${it.url}\n${clip(it.content, 1500)}`)
        }
      }
      if (!textos.length) return []
      base = digitos(textos.join(' '))
      const r = await fetch(GROQ_API_URL, {
        method: 'POST', signal: AbortSignal.timeout(resta()),
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${groq}` },
        body: JSON.stringify({ model: MODEL, temperature: 0.1, response_format: { type: 'json_object' },
          messages: [{ role: 'system', content: `Extrais negócios de resultados de pesquisa. "fonte" é o [i].\n${REGRAS}` }, { role: 'user', content: textos.join('\n\n') }] }),
      })
      if (!r.ok) return []
      const j = (await r.json()) as any
      negocios = JSON.parse(j?.choices?.[0]?.message?.content || '{}')?.negocios || []
    } else {
      const r = await fetch(GROQ_API_URL, {
        method: 'POST', signal: AbortSignal.timeout(resta()),
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${groq}` },
        body: JSON.stringify({ model: MODEL, temperature: 0.1, tools: [{ type: 'browser_search' }], reasoning_effort: 'low',
          messages: [{ role: 'system', content: `Procuras na web empresas em Portugal com telefone. ${REGRAS}` }, { role: 'user', content: `${query} em ${local}, com telefone.` }] }),
      })
      if (!r.ok) return []
      const j = (await r.json()) as any
      const msg = j?.choices?.[0]?.message || {}
      const m = String(msg.content || '').match(/\{[\s\S]*\}/)
      negocios = m ? JSON.parse(m[0])?.negocios || [] : []
      base = digitos(JSON.stringify(msg.executed_tools || []))
      if (base.length < 100) return [] // sem prova de pesquisa real: não arriscar contactos inventados
    }
    const out: Neg[] = []
    for (const n of Array.isArray(negocios) ? negocios : []) {
      const nome = clip(n?.nome, 100)
      let tel = telPT(n?.telefone)
      if (tel && !base.includes(tel)) tel = null
      if (!nome || !tel) continue
      const site = clip(n?.site, 200), redes = clip(n?.redes, 200)
      out.push({
        nome, telefone: tel, email: clip(n?.email, 100) || null, morada: clip(n?.morada, 160) || null,
        localidade: clip(n?.localidade, 60) || null, site: /^https?:\/\//.test(site) ? site : null,
        redes: /^https?:\/\//.test(redes) ? redes : null, fonte_url: fontes[Number(n?.fonte)] || null,
        categoria: null, lat: null, lng: null, distancia_km: null, origem: 'web',
        sugestao: sugestaoPara(query, /^https?:\/\//.test(site)),
      })
    }
    return out
  } catch { return [] }
}

export async function POST(req: NextRequest) {
  const ctx = await campanhasUser()
  if (!ctx) return NextResponse.json({ error: 'Sessão expirada. Entra outra vez.' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as { query?: string; local?: string; lat?: number; lng?: number; raioKm?: number }
  const query = clip(body.query, 80)
  if (query.length < 2) return NextResponse.json({ error: 'Escolhe ou escreve o tipo de negócio.' }, { status: 400 })

  const desde = new Date(Date.now() - 3600_000).toISOString()
  const { count } = await ctx.admin.from('prospecao_pesquisas').select('id', { count: 'exact', head: true })
    .eq('user_id', ctx.me.id).gte('created_at', desde)
  if ((count ?? 0) >= LIMITE_HORA) return NextResponse.json({ error: 'Já fizeste muitas pesquisas nesta hora. Volta daqui a pouco.' }, { status: 429 })

  const raio = Math.min(Math.max(Number(body.raioKm) || 15, 1), 50)
  let centro: [number, number] | null = null
  let local = clip(body.local, 80)
  if (Number.isFinite(body.lat) && Number.isFinite(body.lng)) {
    centro = [Number(body.lat), Number(body.lng)]
    if (!local) local = (await localidadeDe(centro[0], centro[1])) || 'a tua zona'
  } else if (local) {
    centro = await geocode(local + ', Portugal')
  }
  if (!centro) return NextResponse.json({ error: local ? `Não encontrei "${local}". Confirma a morada ou escreve só a cidade (ex.: Porto).` : 'Escreve uma morada ou cidade, ou toca em Perto de mim.' }, { status: 400 })

  await ctx.admin.from('prospecao_pesquisas').insert({ user_id: ctx.me.id, company_id: ctx.me.company_id, query, local, raio_km: raio })

  const [mapaR, webR] = await Promise.allSettled([
    (async () => (await viaOverpass(query, centro!, raio)) ?? (await viaNominatim(query, centro!, raio)))(),
    viaWeb(query, local),
  ])
  const mapa = mapaR.status === 'fulfilled' ? mapaR.value : []
  const web = webR.status === 'fulfilled' ? webR.value : []

  // juntar e deduplicar (telefone ou nome)
  const vistos = new Set<string>()
  const todos: Neg[] = []
  for (const n of [...mapa, ...web]) {
    const k1 = n.telefone ? 't' + n.telefone : ''
    const k2 = 'n' + norm(n.nome).replace(/[^a-z0-9]/g, '')
    if ((k1 && vistos.has(k1)) || vistos.has(k2)) continue
    if (k1) vistos.add(k1)
    vistos.add(k2)
    todos.push(n)
  }
  todos.sort((a, b) => Number(!!b.telefone) - Number(!!a.telefone) || (a.distancia_km ?? 999) - (b.distancia_km ?? 999))
  const resultados = todos.slice(0, 120)

  return NextResponse.json({
    resultados, local, centro, raio,
    stats: { total: resultados.length, comTelefone: resultados.filter((r) => r.telefone).length, mapa: mapa.length, web: web.length },
  })
}
