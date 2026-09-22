import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { getCoverage } from '@/lib/providers/geoAnacom'

export async function POST(request: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GROQ_API_KEY em falta' }, { status: 500 })
  }

  const authHeader = request.headers.get('Authorization')
  const callerJwt = authHeader?.replace('Bearer ', '')
  if (!callerJwt) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(callerJwt)
  if (callerError || !callerData.user) {
    return NextResponse.json({ error: 'Sessao invalida' }, { status: 401 })
  }

  const { data: profile } = await supabaseAdmin
    .from('usuarios')
    .select('company_id')
    .eq('id', callerData.user.id)
    .single()

  if (!profile?.company_id) {
    return NextResponse.json({ error: 'Perfil sem empresa associada' }, { status: 400 })
  }

  let body: {
    pergunta?: string
    segmento?: 'telecom' | 'energia'
    morada?: string
    lat?: number
    lon?: number
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo do pedido invalido' }, { status: 400 })
  }

  const { pergunta, segmento, morada, lat, lon } = body

  if (!pergunta?.trim()) {
    return NextResponse.json({ error: 'Pergunta em falta' }, { status: 400 })
  }

  // Tarifarios: consulta direta com o cliente admin ja autenticado acima —
  // sem depender de cookies de sessao (este endpoint recebe o token via
  // Authorization, nao via cookie, por isso nunca usamos o cliente SSR aqui).
  let tarifariosQuery = supabaseAdmin
    .from('tarifarios_referencia')
    .select('*')
    .eq('company_id', profile.company_id)
    .order('preco_mensal', { ascending: true, nullsFirst: false })
  if (segmento) tarifariosQuery = tarifariosQuery.eq('segmento', segmento)

  const { data: tarifariosData, error: tarifariosErr } = await tarifariosQuery
  if (tarifariosErr) {
    console.error('[assistente-comercial] erro tarifarios:', tarifariosErr.message)
  }
  const tarifarios = tarifariosData ?? []

  let coverageNote = ''
  if (lat != null && lon != null) {
    const coverage = await getCoverage(lat, lon, morada)
    coverageNote = coverage.available
      ? `Dados de cobertura GEO.ANACOM: ${JSON.stringify(coverage.operators)}`
      : `Cobertura GEO.ANACOM indisponivel neste momento (${coverage.note ?? 'sem detalhe'}). Nao inventes dados de cobertura — diz isso claramente ao comercial.`
  }

  const tarifariosTexto = tarifarios.length
    ? tarifarios
        .map((t: any) => `- ${t.operador} (${t.nome_pacote}): ${t.preco_mensal != null ? `${t.preco_mensal}€/mes` : JSON.stringify(t.detalhes)} [fonte: ${t.fonte ?? 'interno'}, atualizado ${new Date(t.updated_at).toLocaleDateString('pt-PT')}]`)
        .join('\n')
    : 'Sem tarifarios de referencia configurados para esta empresa ainda.'

  const systemPrompt = `Es o Assistente Comercial do SD Dialer. Ajudas comerciais de telecom/energia a decidir, DURANTE uma chamada ou logo a seguir, o que oferecer a um cliente.

REGRAS CRITICAS:
- So podes usar os precos e dados que te dou abaixo. NUNCA inventes precos, promocoes ou coberturas que nao estejam aqui.
- Se a informacao que precisas nao estiver disponivel, diz isso claramente ao comercial em vez de adivinhar.
- Responde em portugues de Portugal, curto e direto, como se estivesses a falar com um colega no meio de uma chamada.

TARIFARIOS DE REFERENCIA DISPONIVEIS:
${tarifariosTexto}

${coverageNote || 'Sem dados de cobertura disponiveis para esta consulta (nenhuma morada/coordenada fornecida).'}`

  let response: Response
  try {
    response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: pergunta },
        ],
        temperature: 0.3,
      }),
    })
  } catch (err) {
    console.error('[assistente-comercial] erro ao contactar Groq:', err)
    return NextResponse.json({ error: 'Erro ao contactar o modelo de IA' }, { status: 502 })
  }

  if (!response.ok) {
    const errText = await response.text()
    console.error('[assistente-comercial] Groq respondeu erro:', response.status, errText)
    return NextResponse.json({ error: `Erro na IA (${response.status})` }, { status: 502 })
  }

  const json = await response.json()
  const resposta = json.choices?.[0]?.message?.content ?? 'Sem resposta.'

  return NextResponse.json({ resposta, tarifarios, coverageAvailable: lat != null && lon != null })
}
