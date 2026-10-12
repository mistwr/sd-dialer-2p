import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSignatureAdminClient, privateNoStoreHeaders } from '@/lib/services/venda-signatures'
import { validNif, contractEnd, canAssignSeller } from '@/lib/utils/sales-rules'

const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: privateNoStoreHeaders() })
async function context() {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return null
  const { data: actor } = await db.from('usuarios').select('id, company_id, role, status, restricted_admin').eq('id', user.id).single()
  return actor?.status === 'active' && actor.company_id ? { db, actor } : null
}
export async function GET(req: NextRequest) {
  try {
    const ctx = await context()
    if (!ctx) return reply({ error: 'Sessão ou empresa inválida.' }, 401)
    const { db, actor } = ctx
    if (req.nextUrl.searchParams.get('sellers') === '1') {
      const { data, error } = await db.from('usuarios').select('id,full_name,company_id,supervisor_id,created_by').eq('company_id', actor.company_id).eq('status','active')
      if (error) throw error
      return reply({ sellers: (data || []).filter(s => canAssignSeller(actor,s)) })
    }
    const nif = req.nextUrl.searchParams.get('nif')
    if (nif && !validNif(nif)) return reply({ error: 'NIF inválido.' }, 400)
    let query = db.from('vendas').select('*').eq('company_id', actor.company_id).order('created_at', { ascending: false })
    if (nif) query = query.eq('client_nif', nif.replace(/\s/g,''))
    if (actor.role === 'parceiro') query = query.eq('seller_id', actor.id)
    const { data, error } = await query.limit(nif ? 10 : 1000)
    if (error) throw error
    return reply({ vendas: data || [] })
  } catch { return reply({ error: 'Não foi possível consultar as vendas.' }, 500) }
}
export async function POST(req: NextRequest) {
  try {
    const ctx = await context()
    if (!ctx) return reply({ error: 'Sessão ou empresa inválida.' }, 401)
    const { db, actor } = ctx
    const body = await req.json()
    const text = (key: string) => typeof body[key] === 'string' ? body[key].trim().slice(0,2000) : ''
    const name = text('client_name'), phone = text('client_phone'), nif = text('client_nif').replace(/\s/g,'')
    if (!name || !/^[+\d ()-]{9,30}$/.test(phone)) return reply({ error: 'Preenche o nome e um telefone válido.' },400)
    if (nif && !validNif(nif)) return reply({ error: 'NIF inválido. Verifica os nove dígitos.' },400)
    const sellerId = text('seller_id') || actor.id
    const { data: seller } = await db.from('usuarios').select('id,company_id,supervisor_id,created_by').eq('id',sellerId).eq('status','active').maybeSingle()
    if (!seller || !canAssignSeller(actor,seller)) return reply({ error: 'Não podes atribuir esta venda a esse vendedor.' },403)
    const leadId = text('lead_id') || null
    if (leadId) {
      const {data: lead} = await db.from('leads').select('id').eq('id',leadId).eq('company_id',actor.company_id).maybeSingle()
      if (!lead) return reply({ error: 'Lead não disponível nesta empresa.' },403)
    }
    const start = text('fidelizacao_inicio') || null
    const months = Number(body.fidelizacao_meses || 0)
    if ((!start && months) || (start && !months)) return reply({ error: 'Preenche o início e a duração da fidelização.' },400)
    let end: string|null = null
    if (start) { try {end = contractEnd(start,months)} catch {return reply({error:'Fidelização inválida.'},400)} }
    const amount = body.amount === '' || body.amount == null ? null : Number(body.amount)
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) return reply({error:'Valor inválido.'},400)
    const cc = text('cc_status') || 'pendente'
    if (!['pendente','recebido','validado'].includes(cc) || (cc === 'validado' && actor.role !== 'admin')) return reply({error:'Estado de CC não permitido.'},400)
    const id = text('id')
    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) return reply({error:'Identificador de venda inválido.'},400)
    const admin = getSignatureAdminClient()
    const {data: existing,error: existingError} = await admin.from('vendas').select('id,seller_id,company_id').eq('id',id).maybeSingle()
    if (existingError) throw existingError
    if (existing) return existing.company_id === actor.company_id && existing.seller_id === sellerId ? reply({ venda:existing }) : reply({error:'Identificador já utilizado.'},409)
    const {data:venda,error} = await admin.from('vendas').insert({
      id,company_id:actor.company_id,seller_id:sellerId,lead_id:leadId,
      client_name:name,client_phone:phone,client_nif:nif||null,
      client_email:text('client_email')||null,client_address:text('client_address')||null,
      service_type:text('service_type')||null,operator:text('operator')||null,plano:text('plano')||null,
      amount,contract_type:text('contract_type')||null,notes:text('notes')||null,status:'pendente',
      fidelizacao_inicio:start,fidelizacao_meses:months||null,fidelizacao_fim:end,cc_status:cc,
    }).select().single()
    if (error) throw error
    if (leadId) await db.from('leads').update({status:'vendido'}).eq('id',leadId)
    return reply({venda},201)
  } catch (error) {
    console.error('[vendas:create]',error)
    return reply({error:'Não foi possível registar a venda. Tenta novamente.'},500)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const ctx = await context()
    if (!ctx) return reply({error:'Sessão inválida.'},401)
    if (ctx.actor.role !== 'admin') return reply({error:'Apenas administradores podem validar a identificação.'},403)
    const body = await req.json()
    const {data:sale,error:lookupError} = await ctx.db.from('vendas').select('id').eq('id',body.id).eq('company_id',ctx.actor.company_id).maybeSingle()
    if (lookupError || !sale) return reply({error:'Venda não disponível.'},404)
    if (!['pendente','recebido','validado'].includes(body.cc_status)) return reply({error:'Estado inválido.'},400)
    const {error} = await ctx.db.from('vendas').update({cc_status:body.cc_status}).eq('id',sale.id)
    if (error) throw error
    return reply({ok:true})
  } catch {return reply({error:'Não foi possível atualizar o CC.'},500)}
}
