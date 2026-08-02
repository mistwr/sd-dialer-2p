import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL   = 'llama-3.3-70b-versatile'

function makeAdmin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(request: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────────────────
  const sb = await createClient()
  const { data: { user }, error: authError } = await sb.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  }

  const groqKey = process.env.GROQ_API_KEY
  if (!groqKey) {
    return NextResponse.json(
      { error: 'GROQ_API_KEY nao configurada. Adiciona-a nas variaveis de ambiente do projeto.' },
      { status: 500 }
    )
  }

  // ── Body ─────────────────────────────────────────────────────────────────
  const { call_history_id, notes, company_id } = await request.json() as {
    call_history_id: string
    notes: string
    company_id: string
  }

  if (!call_history_id || !notes?.trim()) {
    return NextResponse.json({ error: 'call_history_id e notes sao obrigatorios' }, { status: 400 })
  }

  // ── Fetch objections for cross-checking ──────────────────────────────────
  const admin = makeAdmin()
  const { data: objecoes } = await admin
    .from('banco_objecoes')
    .select('objecao, segmento')
    .eq('company_id', company_id)
    .eq('ativo', true)

  const objecoesLista = (objecoes ?? []).map(o => `- ${o.objecao}`).join('\n')

  // ── Groq prompt ───────────────────────────────────────────────────────────
  const systemPrompt = `Es um assistente de analise de chamadas comerciais para uma empresa de telecomunicacoes/energia em Portugal.
Analisa as notas da chamada e responde APENAS com um JSON valido com esta estrutura exata:
{
  "ai_summary": "resumo da chamada em 1-2 frases",
  "ai_sentiment": "positivo" | "neutro" | "negativo",
  "ai_next_best_action": "sugestao concreta do que fazer a seguir com esta lead",
  "ai_objections_detected": ["array", "de", "objecoes", "detetadas"]
}
Sem explicacoes, sem markdown, sem texto adicional. Apenas o JSON.`

  const userPrompt = `Notas da chamada:
"""
${notes.trim()}
"""

${objecoesLista ? `Lista de objecoes conhecidas para cruzamento:
${objecoesLista}` : ''}

Analisa e devolve o JSON.`

  try {
    const groqRes = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 512,
        response_format: { type: 'json_object' },
      }),
    })

    if (!groqRes.ok) {
      const err = await groqRes.text()
      console.error('[v0] Groq error:', err)
      return NextResponse.json({ error: `Groq retornou erro: ${groqRes.status}` }, { status: 502 })
    }

    const groqData = await groqRes.json()
    const raw = groqData.choices?.[0]?.message?.content ?? '{}'
    let parsed: Record<string, any> = {}
    try {
      parsed = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'IA devolveu resposta invalida' }, { status: 502 })
    }

    const result = {
      ai_summary:             parsed.ai_summary             ?? null,
      ai_sentiment:           parsed.ai_sentiment           ?? 'neutro',
      ai_next_best_action:    parsed.ai_next_best_action    ?? null,
      ai_objections_detected: Array.isArray(parsed.ai_objections_detected)
        ? parsed.ai_objections_detected
        : [],
    }

    // ── Save to call_history ───────────────────────────────────────────────
    const { error: updateErr } = await admin
      .from('call_history')
      .update(result)
      .eq('id', call_history_id)

    if (updateErr) {
      console.error('[v0] Error saving AI to call_history:', updateErr.message)
      // Still return result even if save fails
    }

    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    console.error('[v0] Summarize error:', err)
    return NextResponse.json({ error: 'Erro ao chamar a IA' }, { status: 500 })
  }
}
