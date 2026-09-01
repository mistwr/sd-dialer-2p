import { NextRequest, NextResponse } from 'next/server'
import { AI_CONFIG } from '@/lib/ai'

export const maxDuration = 60

type Message = { role: 'user' | 'assistant'; content: string }

type RebornAgentRequest = {
  messages: Message[]
  lead_name?: string
  campaign?: string
  operator?: string
  current_bill?: string
  notes?: string
}

function authorize(req: NextRequest): boolean {
  const expected = process.env.REBORN_AGENT_KEY
  // Local/dev compatibility: when no key is configured we keep the endpoint usable,
  // but production should always set REBORN_AGENT_KEY.
  if (!expected) return process.env.NODE_ENV !== 'production'
  const auth = req.headers.get('authorization') ?? ''
  return auth === `Bearer ${expected}`
}

function systemPrompt(ctx: RebornAgentRequest): string {
  return `És o REBORN, um agente comercial de voz para Portugal.
Falas sempre em português europeu, de forma humana, curta e natural.
O teu objetivo é perceber a necessidade do cliente, comparar telecomunicações e energia quando aplicável, lidar com objeções sem pressionar e encaminhar o cliente para a melhor opção disponível.

Regras de chamada:
- Uma pergunta de cada vez.
- Não inventes preços, campanhas, cobertura, fidelizações ou condições. Quando faltarem dados, diz que vais verificar.
- Não digas que és humano se fores perguntado; identifica-te como assistente virtual da equipa.
- Não uses linguagem robótica nem respostas longas.
- Confirma informação importante antes de avançar para adesão.
- Respeita imediatamente pedidos para parar, não voltar a contactar ou falar com uma pessoa.
- Quando houver intenção de avançar, recolhe apenas os dados necessários e encaminha a ação para as ferramentas/CRM.
- Para objeções, primeiro valida a preocupação, depois responde com uma vantagem concreta e termina com uma pergunta simples.

Contexto disponível:
Cliente: ${ctx.lead_name ?? 'desconhecido'}
Campanha: ${ctx.campaign ?? 'MY POUPar+'}
Operador atual: ${ctx.operator ?? 'desconhecido'}
Fatura atual: ${ctx.current_bill ?? 'desconhecida'}
Notas: ${ctx.notes ?? 'sem notas'}

Mantém cada resposta normalmente entre 1 e 3 frases porque será convertida imediatamente em voz.`
}

async function callOpenAICompatible(messages: Message[], prompt: string): Promise<string> {
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
      messages: [{ role: 'system', content: prompt }, ...messages],
      temperature: 0.35,
      stream: false,
    }),
  })
  if (!res.ok) throw new Error(`LLM error: ${res.status}`)
  const json = await res.json()
  return json?.choices?.[0]?.message?.content?.trim() ?? ''
}

async function callOllama(messages: Message[], prompt: string): Promise<string> {
  const { endpoint, model } = AI_CONFIG.llm
  const res = await fetch(`${endpoint}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: prompt }, ...messages],
      stream: false,
    }),
  })
  if (!res.ok) throw new Error(`Ollama error: ${res.status}`)
  const json = await res.json()
  return json?.message?.content?.trim() ?? ''
}

function mockReply(messages: Message[]): string {
  const last = messages.at(-1)?.content?.toLowerCase() ?? ''
  if (last.includes('caro') || last.includes('pago')) {
    return 'Percebo. Para eu comparar corretamente, quanto está a pagar por mês neste momento?'
  }
  if (last.includes('fideliza')) {
    return 'Sem problema. Primeiro confirmamos quando termina a fidelização e só depois vemos se faz sentido mudar. Sabe em que mês termina?'
  }
  if (last.includes('não quero') || last.includes('nao quero')) {
    return 'Compreendo. Não avanço com nada. Quer apenas que eu deixe a comparação preparada para consultar quando quiser?'
  }
  return 'Perfeito. Para eu perceber se consigo melhorar o que tem hoje, qual é o seu operador atual e quanto paga aproximadamente por mês?'
}

export async function POST(req: NextRequest) {
  try {
    if (!authorize(req)) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })

    const body = (await req.json()) as RebornAgentRequest
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json({ error: 'messages ausentes' }, { status: 400 })
    }

    const prompt = systemPrompt(body)
    const engine = AI_CONFIG.llm.engine
    let reply: string

    if (!engine || engine === 'mock') reply = mockReply(body.messages)
    else if (engine === 'ollama') reply = await callOllama(body.messages, prompt)
    else reply = await callOpenAICompatible(body.messages, prompt)

    return NextResponse.json({ reply, engine })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno'
    console.error('[reborn-agent]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
