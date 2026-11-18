import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { responderIA } from '@/lib/server/ia-central'

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
  const body = await request.json().catch(() => ({})) as { message?: string; messages?: Array<{ role: string; content: string }> }
  const question = String(body.message || '').slice(0, 1500)
  if (!question.trim()) return NextResponse.json({ error: 'Escreve uma pergunta.' }, { status: 400 })
  const history = (Array.isArray(body.messages) ? body.messages : [])
    .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-8)
    .map(m => ({ role: m.role, content: m.content.slice(0, 1500) }))

  try {
    const out = await responderIA({ db, companyId: company.id, companyName: company.name, quem: me.full_name || 'o gestor', role: String(me.role), question, history })
    let guardadas: any[] = []
    if (out.propostas.length) {
      const { data: ins } = await db.from('ia_propostas').insert(out.propostas.map(p => ({ ...p, company_id: company.id, criado_por: user.id }))).select('id,tipo,titulo,texto_proposto,motivo,estado,created_at')
      guardadas = ins || []
    }
    return NextResponse.json({ reply: out.reply, propostas: guardadas })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'A IA não respondeu agora. Tenta outra vez.' }, { status: 502 })
  }
}

// Propostas pendentes da empresa
export async function PUT() {
  const ctx = await context()
  if ('error' in ctx) return ctx.error
  const { db, company } = ctx
  const { data } = await db.from('ia_propostas').select('id,tipo,titulo,texto_proposto,motivo,estado,created_at').eq('company_id', company.id).order('created_at', { ascending: false }).limit(30)
  return NextResponse.json({ propostas: data || [] })
}

// Aprovar / rejeitar (não aplica nada sozinho)
export async function PATCH(request: NextRequest) {
  const ctx = await context()
  if ('error' in ctx) return ctx.error
  const { db, user, me, company } = ctx
  if (!['admin', 'super_admin'].includes(String(me.role)) && !me.is_super_admin) return NextResponse.json({ error: 'Só administradores decidem propostas.' }, { status: 403 })
  const b = await request.json().catch(() => ({})) as { id?: string; estado?: string }
  if (!b.id || !['aprovada', 'rejeitada'].includes(String(b.estado))) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
  const { error } = await db.from('ia_propostas').update({ estado: b.estado, decidido_por: user.id, decidido_em: new Date().toISOString() }).eq('id', b.id).eq('company_id', company.id).eq('estado', 'pendente')
  if (error) return NextResponse.json({ error: 'Não foi possível guardar.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
