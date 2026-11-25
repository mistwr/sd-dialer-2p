import { NextRequest, NextResponse } from 'next/server'
import { campanhasUser } from '@/lib/server/campanhas-auth'
import { contextoVendas } from '@/lib/server/ia-vendas'
import { groqFetch } from '@/lib/server/groq'

// Coach de vendas: ajuda o vendedor a escolher a oferta, abrir a chamada, responder a objeções e fechar,
// usando só as campanhas, tarifários, guiões e objeções guardados no SD Dialer (e a lead aberta, se houver).

export const dynamic = 'force-dynamic'
export const maxDuration = 45

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODELOS = [process.env.COMANDO_GROQ_MODEL || 'openai/gpt-oss-120b', 'llama-3.3-70b-versatile']

export async function GET(req: NextRequest) {
  const ctx = await campanhasUser()
  if (!ctx) return NextResponse.json({ error: 'Sessão expirada. Entra outra vez.' }, { status: 401 })
  const leadId = new URL(req.url).searchParams.get('lead')
  const c = await contextoVendas(ctx.admin, ctx.me as any, leadId)
  return NextResponse.json({ resumo: c.resumo, leadNome: c.leadNome, titulos: c.titulos })
}

export async function POST(req: NextRequest) {
  const ctx = await campanhasUser()
  if (!ctx) return NextResponse.json({ error: 'Sessão expirada. Entra outra vez.' }, { status: 401 })
  const key = process.env.GROQ_API_KEY
  if (!key) return NextResponse.json({ error: 'A IA ainda não está configurada.' }, { status: 503 })

  const body = (await req.json().catch(() => ({}))) as { messages?: Array<{ role: string; content: string }>; leadId?: string }
  const historico = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-10).map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }))
  if (!historico.length || historico[historico.length - 1].role !== 'user') return NextResponse.json({ error: 'Escreve a tua pergunta.' }, { status: 400 })

  const { data: eu } = await ctx.admin.from('usuarios').select('full_name').eq('id', ctx.me.id).maybeSingle()
  const c = await contextoVendas(ctx.admin, ctx.me as any, body.leadId || null)

  const sistema = `És o Coach de Vendas LUMIN do SD Dialer. Ajudas ${clipNome(eu?.full_name)} (perfil ${ctx.me.role}) a vender serviços de telecomunicações e energia em Portugal, por telefone e porta-a-porta, e a fechar mais.
Português de Portugal, direto, prático, frases curtas. Usa **negrito** e listas com "- ". Máx. 14 linhas, salvo se pedirem um guião completo.

O QUE FAZES:
- Dizes QUE campanha/pacote oferecer e PORQUÊ, comparando com o que o cliente paga hoje (se souberes).
- Dás o guião de abertura (até 3 frases), perguntas de descoberta, a apresentação do benefício e o fecho.
- Respondes a objeções com a técnica: ouvir → validar → perguntar → responder → voltar a pedir o passo seguinte.
- Sugeres o próximo passo concreto (ligar agora, agendar, pedir fatura, enviar proposta) e o que registar no SD Dialer.
- Se houver LEAD ABERTA, personaliza tudo para essa lead (nome, operador atual, notas e chamadas anteriores).

REGRAS FIRMES:
- Preços, promoções, códigos e condições: usa SÓ os dados abaixo. Se não estiverem lá, diz "não tenho isso carregado — confirma em Campanhas operadoras / Simulador energia". Nunca inventes.
- Honestidade com o cliente: nada de pressão abusiva, promessas falsas ou esconder fidelizações/custos.
- Não peças nem repitas dados sensíveis (NIF completo, IBAN, cartões, passwords).

DADOS DO SD DIALER:
${c.texto}`

  let ultimoErro = ''
  for (const model of MODELOS) {
    try {
      const r = await groqFetch(GROQ_API_URL, {
        method: 'POST', signal: AbortSignal.timeout(35_000),
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, temperature: 0.35, max_tokens: 1100, messages: [{ role: 'system', content: sistema }, ...historico] }),
      })
      const d = (await r.json().catch(() => ({}))) as any
      const reply = d?.choices?.[0]?.message?.content
      if (r.ok && reply) return NextResponse.json({ reply: String(reply).trim(), resumo: c.resumo })
      ultimoErro = `${r.status}`
    } catch (e: any) { ultimoErro = e?.name || 'erro' }
  }
  console.error('ia/vendas falhou', ultimoErro)
  return NextResponse.json({ error: 'O Coach não respondeu agora. Toca outra vez em enviar.' }, { status: 502 })
}

function clipNome(n: unknown) { return String(n || 'o vendedor').split(' ')[0] }
