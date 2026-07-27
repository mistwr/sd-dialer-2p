/**
 * POST /api/recordings/chat
 * Body: { recording_id: string, messages: { role: 'user'|'assistant', content: string }[] }
 *
 * Streams an AI response about a specific call recording.
 * Uses the analysis + transcript as context.
 * Works with mock engine (no external deps needed).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { AI_CONFIG } from '@/lib/ai'

export const maxDuration = 60

function getAdminClient() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function resolveUserId(req: NextRequest): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) return user.id
  const authHeader = req.headers.get('authorization') ?? ''
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (jwt) {
    const admin = getAdminClient()
    const { data } = await admin.auth.getUser(jwt)
    if (data?.user) return data.user.id
  }
  return null
}

// Build system prompt with call context
function buildSystemPrompt(recording: any, analysis: any): string {
  const lead = recording.leads?.nome ?? 'desconhecido'
  const campanha = recording.campanhas?.nome ?? 'desconhecida'
  const dur = recording.duration_sec ?? 0
  const m = Math.floor(dur / 60)
  const s = dur % 60
  const durStr = m > 0 ? `${m}m${s}s` : `${s}s`

  let ctx = `És um assistente de coaching comercial especializado em análise de chamadas de vendas em português.
Tens acesso completo à seguinte chamada:

Cliente: ${lead}
Campanha: ${campanha}
Duração: ${durStr}
Score IA: ${analysis?.score ?? 'N/A'}/100`

  if (analysis?.summary) ctx += `\nResumo: ${analysis.summary}`
  if (analysis?.objections?.length) ctx += `\nObjeções identificadas: ${analysis.objections.join(', ')}`
  if (analysis?.interests?.length) ctx += `\nInteresses: ${analysis.interests.join(', ')}`
  if (analysis?.competitor) ctx += `\nConcorrente mencionado: ${analysis.competitor}`
  if (analysis?.next_action) ctx += `\nPróxima ação sugerida: ${analysis.next_action}`
  if (analysis?.coach_well) ctx += `\nO que foi bem: ${analysis.coach_well}`
  if (analysis?.coach_improve) ctx += `\nO que melhorar: ${analysis.coach_improve}`
  if (analysis?.coach_argument) ctx += `\nArgumento recomendado: ${analysis.coach_argument}`
  if (analysis?.coach_phrase) ctx += `\nFrase de conversão: ${analysis.coach_phrase}`
  if (analysis?.transcript) ctx += `\n\nTranscrição completa:\n"""\n${analysis.transcript}\n"""`

  ctx += `\n\nResponde sempre em português europeu. Sê conciso, prático e orientado para resultados. 
Quando o comercial perguntar como melhorar, dá exemplos concretos com frases reais que poderiam ter dito.`

  return ctx
}

// Mock chat engine — returns realistic responses without external deps
async function mockChat(
  systemPrompt: string,
  messages: { role: string; content: string }[]
): Promise<string> {
  await new Promise(r => setTimeout(r, 600))

  const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() ?? ''

  if (lastMsg.includes('objeç') || lastMsg.includes('objecao') || lastMsg.includes('problema')) {
    return 'A principal objeção detetada foi o contrato atual com o operador. Para superar isso, podias ter dito: *"Entendo que tem contrato, mas posso mostrar-lhe quanto poupa por mês — sem qualquer compromisso de mudar agora. Vale a pena saber os números?"* Isto mantém a conversa aberta sem pressão.'
  }
  if (lastMsg.includes('melhor') || lastMsg.includes('melhora') || lastMsg.includes('dica')) {
    return 'Três melhorias concretas para esta chamada:\n\n1. **Mais perguntas abertas** — em vez de apresentar logo a proposta, pergunta primeiro: *"Qual é a maior preocupação com a sua fatura atual?"*\n\n2. **Silêncio estratégico** — após apresentar o benefício, faz silêncio. Deixa o cliente responder.\n\n3. **Fecho mais direto** — no final, em vez de "vou enviar informação", diz: *"Tenho disponibilidade esta semana — quando é melhor para si, terça ou quarta?"*'
  }
  if (lastMsg.includes('script') || lastMsg.includes('frase') || lastMsg.includes('argumentos')) {
    return 'Com base nesta chamada, aqui está um script melhorado para o próximo contacto:\n\n*"Bom dia [nome], é [comercial] da [empresa]. Da última vez ficámos de ver os números juntos. Tenho uma comparação rápida — são 3 minutos — que mostra exatamente quanto poupa face ao seu operador atual. Tem um momento agora?"*\n\nEste script é direto, referencia a conversa anterior e cria urgência sem pressão.'
  }
  if (lastMsg.includes('score') || lastMsg.includes('nota') || lastMsg.includes('pontuaç')) {
    return 'O score desta chamada reflete: o ritmo foi bom, apresentaste os benefícios com clareza e mantiveste um tom profissional. O que baixou o score foi a falta de qualificação no início (não confirmaste se era a pessoa decisora) e o fecho foi fraco — terminaste com "vou enviar email" em vez de marcar o próximo passo concretamente.'
  }

  return 'Com base na análise desta chamada, posso ajudar-te a melhorar em áreas específicas. Podes perguntar-me sobre:\n\n- Como superar as objeções identificadas\n- Scripts e frases melhoradas\n- O que fizeste bem e o que podes melhorar\n- Estratégia para o próximo contacto com este cliente\n\nO que queres explorar?'
}

// OpenAI-compatible chat (works with OpenAI, LM Studio, vLLM, etc.)
async function openAIChat(
  systemPrompt: string,
  messages: { role: string; content: string }[]
): Promise<ReadableStream> {
  const { endpoint, apiKey, model } = AI_CONFIG.llm
  const url = endpoint && !endpoint.includes('11434')
    ? `${endpoint}/v1/chat/completions`
    : 'https://api.openai.com/v1/chat/completions'

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      temperature: 0.5,
      stream: true,
    }),
  })

  if (!res.ok) throw new Error(`OpenAI chat error: ${res.status}`)
  return res.body!
}

// Ollama chat
async function ollamaChat(
  systemPrompt: string,
  messages: { role: string; content: string }[]
): Promise<ReadableStream> {
  const { endpoint, model } = AI_CONFIG.llm
  const res = await fetch(`${endpoint}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      stream: true,
    }),
  })
  if (!res.ok) throw new Error(`Ollama chat error: ${res.status}`)
  return res.body!
}

export async function POST(req: NextRequest) {
  try {
    const userId = await resolveUserId(req)
    if (!userId) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { recording_id, messages } = body as {
      recording_id: string
      messages: { role: string; content: string }[]
    }

    if (!recording_id) {
      return NextResponse.json({ error: 'recording_id ausente' }, { status: 400 })
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages ausentes' }, { status: 400 })
    }

    const admin = getAdminClient()

    // Fetch recording + analysis
    const { data: recording, error: recErr } = await admin
      .from('call_recordings')
      .select('*, leads(nome), campanhas(nome), ai_analyses(*)')
      .eq('id', recording_id)
      .single()

    if (recErr || !recording) {
      return NextResponse.json({ error: 'Gravacao nao encontrada' }, { status: 404 })
    }

    // Security check
    const { data: caller } = await admin
      .from('usuarios')
      .select('company_id, role')
      .eq('id', userId)
      .single()

    const isOwner = recording.parceiro_id === userId
    const isSameCompany = caller?.company_id && recording.company_id === caller.company_id
    const isAdmin = caller?.role === 'admin' || caller?.role === 'supervisor' || caller?.role === 'super_admin'
    if (!isOwner && !(isSameCompany && isAdmin)) {
      return NextResponse.json({ error: 'Sem permissao' }, { status: 403 })
    }

    const analysis = Array.isArray(recording.ai_analyses) ? recording.ai_analyses[0] : null
    const systemPrompt = buildSystemPrompt(recording, analysis)
    const engine = AI_CONFIG.llm.engine

    // Mock engine — return plain JSON (no streaming needed)
    if (engine === 'mock' || !engine) {
      const reply = await mockChat(systemPrompt, messages)
      return NextResponse.json({ reply })
    }

    // Streaming engines
    if (engine === 'ollama') {
      const stream = await ollamaChat(systemPrompt, messages)
      return new Response(stream, {
        headers: { 'Content-Type': 'text/event-stream' },
      })
    }

    // OpenAI-compatible (openai, openai-compatible, lmstudio, vllm)
    const stream = await openAIChat(systemPrompt, messages)
    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    console.error('[chat] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
