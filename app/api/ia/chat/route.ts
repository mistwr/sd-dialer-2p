import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

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

  const body = await request.json()
  const { messages } = body as { messages: { role: 'user' | 'assistant'; content: string }[] }

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'Mensagens em falta' }, { status: 400 })
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      messages: [
        {
          role: 'system',
          content:
            'Es o assistente de IA do SD Dialer, uma plataforma de CRM comercial para equipas de vendas de telecomunicacoes e energia (operadoras como MEO, NOS, Vodafone, DIGI, Endesa, Iberdrola). A tua funcao e ajudar admins, supervisores e parceiros a perceber e usar o sistema: como criar leads, distribuir leads pela equipa, fazer chamadas pelo botao Ligar, preencher o resultado da chamada, consultar relatorios e rankings, gerir campanhas, e tirar duvidas gerais sobre como o SD Dialer funciona. Responde sempre em portugues, de forma clara, curta e pratica, como se estivesses a explicar a um colega novo na equipa.',
        },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 1000,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    return NextResponse.json({ error: `Erro Groq: ${errText}` }, { status: 502 })
  }

  const data = await response.json()
  const reply = data.choices?.[0]?.message?.content ?? ''

  return NextResponse.json({ reply })
}
