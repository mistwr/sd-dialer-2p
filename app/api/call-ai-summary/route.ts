import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

async function getCallerSession() {
  const cookieStore = await cookies()
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await sb.auth.getUser()
  return user
}

interface SummaryRequest {
  notes: string
  lead_nome?: string
  lead_operador?: string
  campanha_nome?: string
  banco_objecoes?: { objecao: string }[]
}

export async function POST(request: NextRequest) {
  const user = await getCallerSession()
  if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })

  const groqApiKey = process.env.GROQ_API_KEY
  if (!groqApiKey) {
    return NextResponse.json({ error: 'GROQ_API_KEY nao configurada' }, { status: 500 })
  }

  const body: SummaryRequest = await request.json()
  const { notes, lead_nome, lead_operador, campanha_nome, banco_objecoes = [] } = body

  if (!notes?.trim()) {
    return NextResponse.json({ error: 'Notas em falta' }, { status: 400 })
  }

  const objecoesLista = banco_objecoes.map(o => `- ${o.objecao}`).join('\n')

  const systemPrompt = `Eres um assistente especializado em analise de chamadas comerciais em Portugal.
Recebes as notas escritas pelo comercial apos a chamada e devolves uma analise estruturada.
Responde SEMPRE em JSON valido com exactamente estas chaves:
{
  "ai_summary": "resumo em 1-2 frases (max 120 caracteres)",
  "ai_sentiment": "positivo" | "neutro" | "negativo",
  "ai_next_best_action": "sugestao do proximo passo (max 100 caracteres)",
  "ai_objections_detected": ["lista de objecoes mencionadas nas notas, comparando com o banco de objecoes"]
}
Nao incluas mais nada alem do JSON. Sem markdown, sem explicacoes.`

  const userPrompt = `Informacoes da chamada:
- Lead: ${lead_nome ?? 'desconhecido'}
- Operador atual: ${lead_operador ?? 'nao especificado'}
- Campanha: ${campanha_nome ?? 'nao especificada'}

Notas do comercial:
"${notes.trim()}"

Banco de objecoes conhecidas (compara com as notas):
${objecoesLista || '(sem banco de objecoes configurado)'}

Analisa as notas e devolve o JSON pedido.`

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 512,
        response_format: { type: 'json_object' },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[v0] Groq API error:', err)
      return NextResponse.json({ error: 'Erro ao chamar API de IA' }, { status: 502 })
    }

    const json = await res.json()
    const content = json.choices?.[0]?.message?.content

    if (!content) {
      return NextResponse.json({ error: 'Resposta vazia da IA' }, { status: 502 })
    }

    const parsed = JSON.parse(content)

    return NextResponse.json({
      ai_summary: parsed.ai_summary ?? '',
      ai_sentiment: parsed.ai_sentiment ?? 'neutro',
      ai_next_best_action: parsed.ai_next_best_action ?? '',
      ai_objections_detected: Array.isArray(parsed.ai_objections_detected)
        ? parsed.ai_objections_detected
        : [],
    })
  } catch (err: any) {
    console.error('[v0] call-ai-summary error:', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
