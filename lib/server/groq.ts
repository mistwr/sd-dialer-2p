// Chamadas à Groq com modelos de reserva.
// Se o modelo pedido esgotar a quota (429) ou falhar (404/5xx), tenta automaticamente outros modelos,
// para a IA do SD Dialer nunca ficar parada por causa de um só modelo.

const RESERVA = ['openai/gpt-oss-20b', 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant']
const SO_OSS = ['reasoning_effort', 'reasoning_format', 'include_reasoning', 'tools', 'tool_choice', 'compound_custom', 'search_settings']
const REPETIR = new Set([404, 413, 429, 498, 500, 502, 503, 504])

export async function groqFetch(url: string, init: RequestInit = {}): Promise<Response> {
  let body: any = null
  try { body = typeof init.body === 'string' ? JSON.parse(init.body) : null } catch { body = null }
  const primeira = await fetch(url, init).catch(() => null)
  if (!body?.model || (primeira && !REPETIR.has(primeira.status))) {
    return primeira ?? new Response(JSON.stringify({ error: { message: 'sem ligação à Groq' } }), { status: 503 })
  }
  // ferramentas de pesquisa só existem nalguns modelos: sem elas não vale a pena trocar
  if (Array.isArray(body.tools) && body.tools.length) return primeira ?? new Response('{}', { status: 503 })
  let ultima: Response | null = primeira
  for (const model of RESERVA.filter((m) => m !== body.model)) {
    const b: any = { ...body, model }
    if (!model.startsWith('openai/')) for (const k of SO_OSS) delete b[k]
    if (b.max_completion_tokens && !b.max_tokens) b.max_tokens = b.max_completion_tokens
    const r = await fetch(url, { ...init, body: JSON.stringify(b) }).catch(() => null)
    if (r && r.ok) return r
    if (r) ultima = r
  }
  return ultima ?? new Response(JSON.stringify({ error: { message: 'sem ligação à Groq' } }), { status: 503 })
}
