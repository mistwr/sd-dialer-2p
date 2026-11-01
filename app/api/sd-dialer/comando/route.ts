import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

// Comando IA — add-on pago do SD Dialer: painel + assistente que responde sobre os dados da empresa do utilizador.

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const ADDON_LINK = 'https://buy.stripe.com/4gM28rafzbLUbGE1Jz5Rm0m'
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = process.env.COMANDO_GROQ_MODEL || 'openai/gpt-oss-120b'

function admin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function context() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) }
  const db = admin()
  const { data: me } = await db.from('usuarios').select('role, company_id, is_super_admin, status, full_name').eq('id', user.id).maybeSingle()
  if (!me || me.status !== 'active' || !['admin', 'supervisor', 'super_admin'].includes(String(me.role))) {
    return { error: NextResponse.json({ error: 'O Comando IA é para administradores e supervisores.' }, { status: 403 }) }
  }
  const { data: company } = await db.from('companies').select('id, name, comando_ativo').eq('id', me.company_id).maybeSingle()
  if (!company) return { error: NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 }) }
  return { db, user, me, company }
}

function lockedResponse(company: { id: string; name: string }, email?: string | null) {
  const url = new URL(ADDON_LINK)
  url.searchParams.set('client_reference_id', `comando_${company.id}`)
  if (email) url.searchParams.set('prefilled_email', email)
  return NextResponse.json({ locked: true, empresa: company.name, checkoutUrl: url.toString(), preco: '29€/mês' })
}

export async function GET() {
  const ctx = await context()
  if ('error' in ctx) return ctx.error
  const { db, user, me, company } = ctx
  if (!company.comando_ativo && !me.is_super_admin) return lockedResponse(company, user.email)
  const { data, error } = await db.rpc('comando_empresa', { p_company: company.id })
  if (error) return NextResponse.json({ error: 'Não foi possível calcular os dados da empresa.' }, { status: 500 })
  return NextResponse.json({ locked: false, nome: me.full_name, dados: data, geradoEm: new Date().toISOString() })
}

export async function POST(request: NextRequest) {
  const ctx = await context()
  if ('error' in ctx) return ctx.error
  const { db, user, me, company } = ctx
  if (!company.comando_ativo && !me.is_super_admin) return lockedResponse(company, user.email)
  const key = process.env.GROQ_API_KEY
  if (!key) return NextResponse.json({ error: 'IA não configurada.' }, { status: 500 })

  const body = await request.json().catch(() => ({})) as { message?: string; messages?: Array<{ role: string; content: string }> }
  const question = String(body.message || '').slice(0, 1500)
  if (!question.trim()) return NextResponse.json({ error: 'Escreve uma pergunta.' }, { status: 400 })
  const history = (Array.isArray(body.messages) ? body.messages : [])
    .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-8)
    .map(m => ({ role: m.role, content: m.content.slice(0, 1500) }))

  const { data } = await db.rpc('comando_empresa', { p_company: company.id })
  const system = `És o Comando IA do SD Dialer, o assistente de gestão da empresa "${company.name}". Falas com ${me.full_name || 'o gestor'} (${me.role}).
Respondes em português de Portugal, direto e curto (máx. 8 linhas; usa **negrito** e listas com "- ").
Usa APENAS os DADOS abaixo (agregados dos últimos 30 dias salvo indicação). Se algo não estiver nos dados, diz que não tens essa informação — nunca inventes números.
Ajuda a decidir: onde está a equipa a perder vendas, que leads trabalhar, quem precisa de apoio, o que fazer hoje. Termina com 1 ação concreta quando fizer sentido.
Estados de leads: novo, contactado, vendido, nao_interessado, nao_atende, numero_errado, ligar_depois, sem_cobertura, desligado, etc. "semAtribuir" = leads novas sem comercial atribuído.
Só tens acesso de leitura; para alterar dados o gestor usa os menus do SD Dialer (Leads, Distribuição, Campanhas).

DADOS (${new Date().toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' })}):
${JSON.stringify(data)}`

  try {
    const r = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: GROQ_MODEL, temperature: 0.3, max_tokens: 900, messages: [{ role: 'system', content: system }, ...history, { role: 'user', content: question }] }),
      signal: AbortSignal.timeout(45_000),
    })
    const j = await r.json().catch(() => ({}))
    const reply = String(j?.choices?.[0]?.message?.content || '').trim()
    if (!r.ok || !reply) return NextResponse.json({ error: 'A IA não respondeu agora. Tenta outra vez.' }, { status: 502 })
    return NextResponse.json({ reply })
  } catch {
    return NextResponse.json({ error: 'A IA demorou demasiado. Tenta outra vez.' }, { status: 504 })
  }
}
