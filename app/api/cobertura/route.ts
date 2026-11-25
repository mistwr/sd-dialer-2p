import { NextRequest, NextResponse } from 'next/server'
import { campanhasUser } from '@/lib/server/campanhas-auth'

import { groqFetch } from '@/lib/server/groq'
// Recomendação da melhor operadora para uma morada.
// A cobertura (que operadoras/tecnologias chegam à morada) é lida pelo vendedor no mapa oficial da ANACOM
// (geo.anacom.pt) e indicada aqui; a IA só compara pacotes e preços reais guardados no SD Dialer.

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = process.env.COMANDO_GROQ_MODEL || 'openai/gpt-oss-120b'

const TECH_COM_FIBRA = ['ftth', 'hfc']
const TECH_NOME: Record<string, string> = {
  ftth: 'Fibra (FTTH)', hfc: 'Cabo (HFC)', cobre: 'Cobre/ADSL', sem: 'Sem cobertura fixa', nv: 'Não verificado',
}

function clip(v: unknown, n: number) {
  return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n)
}

export async function POST(req: NextRequest) {
  const ctx = await campanhasUser()
  if (!ctx) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
  const key = process.env.GROQ_API_KEY
  if (!key) return NextResponse.json({ error: 'IA não configurada.' }, { status: 503 })

  const body = (await req.json().catch(() => ({}))) as {
    morada?: string
    cobertura?: Record<string, { tech?: string; dois_gb?: boolean }>
    cliente?: { operadoraAtual?: string; tv?: boolean; movel?: boolean; paga?: number | string }
  }
  const cobertura = body.cobertura || {}
  const ops = Object.entries(cobertura)
    .map(([nome, c]) => ({ nome: clip(nome, 30), tech: String(c?.tech || 'nv'), doisGb: !!c?.dois_gb }))
    .filter((o) => o.nome && TECH_NOME[o.tech])
  if (!ops.length) return NextResponse.json({ error: 'Indica a cobertura de pelo menos uma operadora.' }, { status: 400 })

  const comFibra = ops.filter((o) => TECH_COM_FIBRA.includes(o.tech))
  const resumoCobertura = ops
    .map((o) => `- ${o.nome}: ${TECH_NOME[o.tech]}${o.doisGb ? ' (2 Gbps ou mais disponível)' : ''}`)
    .join('\n')

  if (!comFibra.length) {
    return NextResponse.json({
      reply:
        '**Sem fibra nem cabo nesta morada, pelo que o mapa mostra.**\n\n' +
        '- Confirma a morada exata e o andar no mapa, e tenta com a morada do edifício ao lado.\n' +
        '- Para TV e internet sem rede fixa: **MEO Satélite** (até 40 Mbps) ou internet móvel / box 4G e 5G.\n' +
        '- A cobertura vem dos reportes das operadoras e é atualizada de 3 em 3 meses: antes de desistir, confirma a viabilidade técnica no pedido de venda.',
      cobertura: resumoCobertura,
    })
  }

  const { data: tarifas } = await ctx.admin
    .from('tarifarios_referencia')
    .select('operador, nome_pacote, preco_mensal, detalhes')
    .in('company_id', Array.from(new Set([ctx.me.company_id, process.env.CATALOGO_COMPANY_ID || 'e27c8324-989a-4a68-b3a3-902cba74696c'])))
    .eq('segmento', 'telecom')
    .order('preco_mensal', { ascending: true })

  const hoje = new Date().toISOString().slice(0, 10)
  const permitidos = new Set(comFibra.map((o) => o.nome.toLowerCase()))
  const linhas: string[] = []
  const porOp: Record<string, number> = {}
  for (const t of (tarifas as any[]) || []) {
    const op = String(t.operador || '')
    if (!permitidos.has(op.toLowerCase())) continue
    let d: any = {}
    try { d = typeof t.detalhes === 'string' ? JSON.parse(t.detalhes) : t.detalhes || {} } catch { d = {} }
    if (d.valido_ate && String(d.valido_ate) < hoje) continue
    porOp[op] = (porOp[op] || 0) + 1
    if (porOp[op] > 12) continue
    const preco = Number(t.preco_mensal)
    linhas.push(`- ${op} | ${clip(t.nome_pacote, 110)} | ${Number.isFinite(preco) ? preco.toFixed(2).replace('.', ',') + ' €/mês' : 'preço n/d'} | ${clip(d.nota, 260)}`)
  }

  const cli = body.cliente || {}
  const sistema = `És o consultor de cobertura do SD Dialer. Português de Portugal, direto, curto (máx. 12 linhas), com **negrito** e listas com "- ".
Tarefa: dizer qual a MELHOR operadora para este cliente nesta morada e porquê.
REGRAS:
- Só podes recomendar operadoras que têm fibra ou cabo na morada (lista abaixo). Nunca recomendes uma operadora sem cobertura.
- Usa APENAS os pacotes e preços da lista. Não inventes pacotes, preços, descontos nem condições. Se a lista não chega para decidir, diz o que falta confirmar.
- Compara pelo que importa ao cliente: o que tem hoje (TV, móvel), o que paga, velocidade e fidelização. Dá 1 recomendação principal e 1 alternativa.
- Se a tecnologia for Cabo (HFC) e outra operadora tiver Fibra (FTTH), refere a vantagem da fibra.
- Termina com uma frase a lembrar que a cobertura vem dos reportes das operadoras à ANACOM e deve ser confirmada na viabilidade técnica da venda.
COBERTURA NA MORADA${body.morada ? ' (' + clip(body.morada, 120) + ')' : ''}:
${resumoCobertura}
PACOTES DISPONÍVEIS (só das operadoras com cobertura, válidos hoje):
${linhas.join('\n') || '(sem pacotes carregados para estas operadoras)'}`

  const pedido = `Cliente: operadora atual ${clip(cli.operadoraAtual, 30) || 'não indicada'}; quer TV: ${cli.tv ? 'sim' : 'não'}; quer móvel: ${cli.movel ? 'sim' : 'não'}; paga hoje: ${clip(cli.paga, 12) || 'não indicado'} €/mês. Qual a melhor operadora?`

  try {
    const r = await groqFetch(GROQ_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL, temperature: 0.2, max_tokens: 700,
        messages: [{ role: 'system', content: sistema }, { role: 'user', content: pedido }],
      }),
    })
    const d = await r.json().catch(() => ({}))
    const reply = d?.choices?.[0]?.message?.content
    if (!r.ok || !reply) return NextResponse.json({ error: 'A IA não respondeu agora. Tenta outra vez.' }, { status: 502 })
    return NextResponse.json({ reply: String(reply).trim(), cobertura: resumoCobertura })
  } catch {
    return NextResponse.json({ error: 'A IA não respondeu agora. Tenta outra vez.' }, { status: 502 })
  }
}
