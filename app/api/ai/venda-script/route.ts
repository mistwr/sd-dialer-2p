import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'llama-3.3-70b-versatile'

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

      const systemPrompt = `Tu és um especialista em vendas de ${tipoServico} em Portugal com 20 anos de experiência.
Vais gerar um script de venda profissional, amigável e persuasivo para abordar uma lead.

CONTEXTO DA LEAD:
- Nome: ${contexto.lead_nome || 'Cliente'}
- Telefone: ${contexto.lead_telefone || 'N/A'}
- Operadora/Comercializador atual: ${operadora}
- Serviços contratados: ${servicosLista}
- Mensalidade atual: ${contexto.mensalidade ? `€${contexto.mensalidade}` : 'desconhecida'}
- Satisfação: ${satisfacao}
- Principais problemas: ${problemasLista || 'nenhum identificado'}

Gera um script de ABERTURA e APRESENTAÇÃO DE VALOR que:
1. Comece com uma saudação natural e empatia
2. Mencione especificamente os problemas identificados
3. Apresente uma solução concreta
4. Termine com uma chamada à ação clara

Formato: Texto longo, pronto para usar na primeira conversa (telefone ou porta).`

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
      const sistemPrompt = `Tu és um coach de vendas especializado em vendas de ${
        contexto.tipo === 'energia' ? 'energia' : 'telecomunicações'
      }.
Ajuda o comercial a superar objeções, a escolher argumentos e a fechar a venda.

CONTEXTO:
- Lead: ${contexto.lead_nome || 'Cliente'}
- Operadora/Comercializador: ${contexto.operador || contexto.comercializador}
- Serviços: ${contexto.servicos ? Object.entries(contexto.servicos).filter(([, v]) => v).map(([k]) => k).join(', ') : 'diversos'}

Responde de forma prática, com exemplos reais e argumentos comprovados. Sê direto e acionável.`

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
