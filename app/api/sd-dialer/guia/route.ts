import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Guia IA do SD Dialer — grátis para todos os perfis. Explica a plataforma e ensina a vender de ponta a ponta.
// Não lê dados de clientes nem da empresa; não altera nada.

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = process.env.COMANDO_GROQ_MODEL || 'openai/gpt-oss-120b'

const MENU_POR_PERFIL: Record<string, string> = {
  parceiro: 'Chat, Minhas Leads, Agenda, Chamadas IA, Histórico, SMS em massa, Porta → Lead, Vendas, Fidelizações, Simulador energia, Marcador (telefone), Campanhas operadoras, Formação, Ranking, Meu perfil, Assistente IA.',
  supervisor: 'Tudo o que o parceiro vê, mais Base de leads, Distribuição, Campanhas, Parceiros, Relatórios, Equipa no mapa, Relatório porta e Comando IA.',
  admin: 'Tudo o que o supervisor vê, com gestão completa da empresa (parceiros, campanhas, distribuição, relatórios) e Comando IA.',
}

function sistema(nome: string, role: string, primeiraVez: boolean) {
  return `És o Guia IA do SD Dialer, a plataforma de vendas por telefone e porta-a-porta da equipa. Falas com ${nome || 'um utilizador'} (perfil: ${role}). Português de Portugal, direto, caloroso e curto (máx. 8 linhas); usa **negrito** e listas com "- ".
${primeiraVez ? 'É a PRIMEIRA vez desta pessoa na plataforma: apresenta-te numa frase e explica em 4 passos simples por onde começar hoje.' : ''}
O QUE SABES DA PLATAFORMA (menu deste perfil): ${MENU_POR_PERFIL[role] || MENU_POR_PERFIL.parceiro}
- Minhas Leads: lista de leads para trabalhar; botão Ligar abre a chamada com o SIM do telemóvel, com cronómetro, e o resultado da chamada é obrigatório no fim.
- Chamadas IA: o robot liga e qualifica; vês o histórico, a transcrição (quando autorizada) e passas ao consultor as leads com interesse.
- Simulador energia e Campanhas operadoras: é aí que estão os preços e as condições reais; NUNCA inventes preços, comissões ou condições de operadoras — manda sempre consultar estas secções.
- Formação: guiões por operadora, objeções e módulos de técnicas de venda. Ranking: pontuação da equipa.
COMO ENSINAR A VENDER DE PONTA A PONTA (serviços de telecomunicações e energia): 1) preparar (conhecer a lead e a campanha); 2) abordagem (apresentação curta, razão da chamada, pedir permissão); 3) descoberta (perguntas sobre a fatura atual, quanto paga, o que usa); 4) apresentação (benefício concreto face ao que paga hoje); 5) objeções (ouvir, perguntar, responder, voltar a pedir); 6) fecho (propor o passo seguinte e confirmar os dados); 7) registo no SD Dialer (resultado, venda, agenda de seguimento); 8) pós-venda e seguimento (fidelizações e novas oportunidades). Tom: honesto e respeitador; nunca pressionar nem prometer o que não está nas campanhas.
REGRAS: só falas do SD Dialer e de vendas/serviços da equipa. Se não souberes algo da app, diz que não sabes e sugere perguntar ao supervisor/admin. Não tens acesso a dados de clientes. Não peças nem aceites passwords ou dados pessoais de clientes.`
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const key = process.env.GROQ_API_KEY
  if (!key) return NextResponse.json({ error: 'IA não configurada.' }, { status: 503 })

  const body = await request.json().catch(() => ({})) as { message?: string; messages?: Array<{ role: string; content: string }>; primeiraVez?: boolean }
  const question = String(body.message || '').slice(0, 1200).trim()
  if (!question) return NextResponse.json({ error: 'Escreve uma pergunta.' }, { status: 400 })
  const history = (Array.isArray(body.messages) ? body.messages : [])
    .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-8).map(m => ({ role: m.role, content: m.content.slice(0, 1200) }))

  const { data: me } = await supabase.from('usuarios').select('full_name, role').eq('id', user.id).maybeSingle()
  const role = ['parceiro', 'supervisor', 'admin'].includes(String(me?.role)) ? String(me?.role) : 'parceiro'

  try {
    const r = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL, temperature: 0.4, max_tokens: 700,
        messages: [{ role: 'system', content: sistema(String(me?.full_name || ''), role, !!body.primeiraVez) }, ...history, { role: 'user', content: question }],
      }),
    })
    const d = await r.json().catch(() => ({}))
    const reply = d?.choices?.[0]?.message?.content
    if (!r.ok || !reply) return NextResponse.json({ error: 'O Guia não respondeu agora. Tenta outra vez.' }, { status: 502 })
    return NextResponse.json({ reply: String(reply).trim() })
  } catch {
    return NextResponse.json({ error: 'O Guia não respondeu agora. Tenta outra vez.' }, { status: 502 })
  }
}
