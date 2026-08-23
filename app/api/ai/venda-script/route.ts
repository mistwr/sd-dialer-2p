import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'openai/gpt-oss-120b'

interface VendaContexto {
  operador?: string
  comercializador?: string
  servicos?: Record<string, boolean>
  mensalidade?: string
  satisfacao?: number
  problemas?: string[]
  tipo?: string
  lead_nome?: string
  lead_telefone?: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(request: NextRequest) {
  const sb = await createClient()
  const { data: { user }, error: authError } = await sb.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const groqKey = process.env.GROQ_API_KEY
  if (!groqKey) {
    return NextResponse.json(
      { error: 'GROQ_API_KEY não configurada' },
      { status: 500 }
    )
  }

  const { contexto, tipo_pedido, pergunta, historico } = await request.json() as {
    contexto: VendaContexto
    tipo_pedido: 'script_inicial' | 'chat'
    pergunta?: string
    historico?: ChatMessage[]
  }

  try {
    // Construir mensagens para Groq
    let messages: ChatMessage[] = []

    if (tipo_pedido === 'script_inicial') {
      // SCRIPT INICIAL: Gerar script personalizado
      const operadora = contexto.operador || contexto.comercializador || 'genérica'
      const tipoServico = contexto.tipo === 'energia' ? 'energia' : 'telecomunicações'

      const servicosLista = contexto.servicos
        ? Object.entries(contexto.servicos)
            .filter(([, v]) => v)
            .map(([k]) => k)
            .join(', ')
        : 'vários serviços'

      const problemasLista = (contexto.problemas || []).join(', ')
      const satisfacao = contexto.satisfacao ? `${contexto.satisfacao}/5` : 'desconhecida'

      const systemPrompt = `Tu és um especialista em vendas de ${tipoServico} em Portugal, instrutor do "Manual de Elite - Transformando Vendedores em Operadores de Fecho".
Geras scripts de venda como um OPERADOR DE ELITE, não como um vendedor comum.

🎯 PRINCÍPIOS DE CONTROLO:
- Quem controla a conversa, controla a decisão
- Foco no PROBLEMA do cliente, nunca no produto
- Amplificação da dor financeira (perda vs. ganho)
- Autoridade técnica desde o primeiro segundo

CONTEXTO DA LEAD:
- Nome: ${contexto.lead_nome || 'Cliente'}
- Telefone: ${contexto.lead_telefone || 'N/A'}
- Operadora/Comercializador: ${operadora}
- Serviços: ${servicosLista}
- Mensalidade: ${contexto.mensalidade ? `€${contexto.mensalidade}` : 'desconhecida'}
- Satisfação: ${satisfacao}
- Principais dores: ${problemasLista || 'nenhuma identificada'}

📋 ESTRUTURA DO SCRIPT (ELITE):
1. ABERTURA (20 segundos): Autoridade técnica + foco no problema
2. DIAGNÓSTICO: Perguntas que extraem dados para o fecho
3. AMPLIFICAÇÃO: Quantificar a perda financeira
4. REENQUADRAMENTO: Transformar objeções em oportunidades
5. FECHO: Assumido, com silêncio estratégico

GATILHOS A USAR:
- Escassez (oferta exclusiva por zona/tempo)
- Urgência (subidas de preço, prazos de instalação)
- Prova Social (vizinhos/porta conhecida que já aderiram)
- Aversão à Perda (custa mais NÃO mudar do que mudar)

Gera um script PRÁTICO, DIRETO, CONTROLADO. Pronto para usar já.`

      messages = [
        {
          role: 'user',
          content: `Gera um script de venda para ${operadora} (${tipoServico}). Contexto acima.`,
        },
      ]

      const groqRes = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages,
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      })

      const groqData = await groqRes.json()
      if (!groqRes.ok) {
        console.error('[v0] Groq error:', groqData)
        return NextResponse.json(
          { error: groqData.error?.message || 'Erro da IA' },
          { status: groqRes.status }
        )
      }

      const script = groqData.choices[0]?.message?.content || ''

      return NextResponse.json({
        script,
        tipo: 'script_inicial',
      })
    } else if (tipo_pedido === 'chat') {
      // CHAT: Responder perguntas sobre objeções, argumentos, etc
      const sistemPrompt = `Tu és um COACH DE ELITE de vendas de ${contexto.tipo === 'energia' ? 'energia' : 'telecomunicações'}.
Treinas comerciais para serem OPERADORES DE FECHO, não vendedores. Utilizas técnicas do "Manual de Elite".

🎯 TÉCNICAS QUE DOMINAS:
1. REENQUADRAMENTO (Reframing): Transformar objeções em oportunidades
2. FECHO ASSUMIDO: Agir como se a decisão já estivesse tomada
3. ALTERNATIVA FORÇADA: Oferecer 2 opções positivas (ambas = fecho)
4. FECHO SILENCIOSO: Perguntar e CALAR. Silêncio = pressão psicológica
5. AMPLIFICAÇÃO DA DOR: Quantificar a perda financeira anual
6. DIAGNÓSTICO ESTRATÉGICO: Perguntas que extraem dados para o fecho
7. GATILHOS MENTAIS: Escassez, urgência, prova social, autoridade

CONTEXTO:
- Lead: ${contexto.lead_nome || 'Cliente'}
- Operadora/Comercializador: ${contexto.operador || contexto.comercializador}
- Serviços: ${contexto.servicos ? Object.entries(contexto.servicos).filter(([, v]) => v).map(([k]) => k).join(', ') : 'diversos'}

📌 COMO RESPONDER:
- Responde como um INSTRUTOR DE ELITE, não como um chatbot
- Cada resposta deve ter um TÉCNICA específica (cita-a)
- Dá exemplos PRÁTICOS e PRONTOS PARA USAR
- Ensina COMO DIZER, não o quê pensar
- Termina cada resposta com uma PERGUNTA ESTRATÉGICA que o comercial faça ao cliente

A excelência não é um ato, é um hábito de execução.`

      // Adicionar histórico
      const conversaAnterior: ChatMessage[] = (historico || []).slice(-4) // Manter contexto dos últimas 2 turnos
      const novasMensagens: ChatMessage[] = [
        ...conversaAnterior,
        { role: 'user', content: pergunta! },
      ]

      const groqRes = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            { role: 'system', content: sistemPrompt },
            ...novasMensagens,
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
      })

      const groqData = await groqRes.json()
      if (!groqRes.ok) {
        return NextResponse.json(
          { error: groqData.error?.message || 'Erro da IA' },
          { status: groqRes.status }
        )
      }

      const resposta = groqData.choices[0]?.message?.content || ''

      return NextResponse.json({
        resposta,
        tipo: 'chat',
      })
    }

    return NextResponse.json({ error: 'Tipo de pedido desconhecido' }, { status: 400 })
  } catch (err: any) {
    console.error('[v0] Error:', err)
    return NextResponse.json(
      { error: err.message || 'Erro interno' },
      { status: 500 }
    )
  }
}
