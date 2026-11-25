import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { campanhasUser } from '@/lib/server/campanhas-auth'
import { contextoVendas } from '@/lib/server/ia-vendas'

import { groqFetch } from '@/lib/server/groq'
// Guia IA do SD Dialer — grátis para todos os perfis. Explica a plataforma e ensina a vender de ponta a ponta.
// Não lê dados de clientes nem da empresa; não altera nada.

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = process.env.COMANDO_GROQ_MODEL || 'openai/gpt-oss-120b'

const MENU_POR_PERFIL: Record<string, string> = {
  parceiro: 'Chat, Minhas Leads, Agenda, Histórico, SMS em massa, Porta → Lead, Vendas, Fidelizações, Simulador energia, Marcador (telefone), Campanhas operadoras, Formação, Ranking, Meu perfil, Assistente IA (com o Coach de Vendas, que conhece as campanhas e ajuda a fechar cada lead), Empresas (pesquisa IA).',
  supervisor: 'Tudo o que o parceiro vê, mais Chamadas IA (robot), Base de leads, Distribuição, Campanhas, Parceiros, Relatórios, Equipa no mapa, Relatório porta e Comando IA.',
  admin: 'Tudo o que o supervisor vê, com gestão completa da empresa (parceiros, campanhas, distribuição, relatórios) e Comando IA.',
}

function sistema(nome: string, role: string, primeiraVez: boolean) {
  return `És o Guia IA do SD Dialer, a plataforma de vendas por telefone e porta-a-porta da equipa. Falas com ${nome || 'um utilizador'} (perfil: ${role}). Português de Portugal, direto, caloroso e curto (máx. 8 linhas); usa **negrito** e listas com "- ".
${primeiraVez ? 'É a PRIMEIRA vez desta pessoa na plataforma: apresenta-te numa frase e explica em 4 passos simples por onde começar hoje.' : ''}
O QUE SABES DA PLATAFORMA (menu deste perfil): ${MENU_POR_PERFIL[role] || MENU_POR_PERFIL.parceiro}
- Minhas Leads: lista de leads para trabalhar; botão Ligar abre a chamada com o SIM do telemóvel, com cronómetro, e o resultado da chamada é obrigatório no fim.
- Robot (Chamadas IA): SÓ admins e supervisores o usam. O robot liga e qualifica; as leads quentes vão automaticamente para os vendedores. ${role === 'parceiro' ? 'Esta pessoa é VENDEDOR: NUNCA lhe digas para usar as Chamadas IA nem o robot (não as vê). Diz-lhe que as leads quentes do robot lhe chegam automaticamente em Minhas Leads, no cartão "Leads quentes do robot", com a operadora, quanto pagam, o resumo da conversa e um PRAZO para ligar (30 min por defeito, dentro do horário); se não ligar a tempo, a lead passa a um colega. Deve ler o resumo e ligar logo.' : 'Nas Chamadas IA vês o histórico e a transcrição (quando autorizada). Em Fluxo do robot vês as leads quentes à espera de chamada, o prazo de cada uma, o tempo de resposta e as vendas por vendedor, passas leads à mão e defines as regras (prazo, horário, quem recebe). As leads quentes vão automaticamente para o vendedor com menos leads por tratar.'}
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

  const body = await request.json().catch(() => ({})) as { message?: string; messages?: Array<{ role: string; content: string }>; primeiraVez?: boolean; verComo?: string }
  const question = String(body.message || '').slice(0, 1200).trim()
  if (!question) return NextResponse.json({ error: 'Escreve uma pergunta.' }, { status: 400 })
  const history = (Array.isArray(body.messages) ? body.messages : [])
    .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-8).map(m => ({ role: m.role, content: m.content.slice(0, 1200) }))

  const { data: me } = await supabase.from('usuarios').select('full_name, role').eq('id', user.id).maybeSingle()
  const real = ['parceiro', 'supervisor', 'admin'].includes(String(me?.role)) ? String(me?.role) : 'parceiro'
  // Admin/supervisor em "Ver como": o Guia responde como para esse perfil (só para perfis abaixo do real).
  const nivel: Record<string, number> = { parceiro: 0, supervisor: 1, admin: 2 }
  const pedido = String(body.verComo || '')
  const role = pedido in nivel && nivel[pedido] < nivel[real] ? pedido : real

  let campanhasAtivas = ''
  try {
    const ctx = await campanhasUser()
    if (ctx) {
      const c = await contextoVendas(ctx.admin, ctx.me as any)
      if (c.titulos.length) campanhasAtivas = `\nCAMPANHAS ATIVAS AGORA (só títulos; para condições manda abrir Campanhas operadoras ou o Coach de Vendas em Assistente IA): ${c.titulos.join(' · ')}`
    }
  } catch {}

  try {
    const r = await groqFetch(GROQ_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL, temperature: 0.4, max_tokens: 700,
        messages: [{ role: 'system', content: sistema(String(me?.full_name || ''), role, !!body.primeiraVez) + campanhasAtivas }, ...history, { role: 'user', content: question }],
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
