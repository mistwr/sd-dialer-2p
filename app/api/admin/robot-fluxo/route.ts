import { NextRequest, NextResponse } from 'next/server'
import { errorResponse, requireSdDialerUser, SdDialerError } from '@/lib/server/sd-dialer-livekit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Painel do fluxo robot -> vendedor: números, leads em curso, desempenho por vendedor e definições.
// Só admin/supervisor da empresa (superadmin pode escolher a empresa com ?companyId=).

const PADRAO = { ativo: true, sla_minutos: 30, hora_inicio: 9, hora_fim: 20, dias: [1, 2, 3, 4, 5, 6], max_reatribuicoes: 2, excluidos: [] as string[] }

async function gestor(request: NextRequest, companyIdPedido?: string | null) {
  const ctx = await requireSdDialerUser(request)
  const p: any = ctx.profile
  const superAdmin = p.is_super_admin === true || p.role === 'super_admin'
  if (!superAdmin && !['admin', 'supervisor'].includes(String(p.role))) throw new SdDialerError('Só admins e supervisores.', 403)
  const companyId = superAdmin && companyIdPedido ? companyIdPedido : String(p.company_id)
  return { ...ctx, companyId, podeEditar: superAdmin || p.role === 'admin' }
}

function semTabela(e: any) { return !!e && (e.code === '42P01' || e.code === 'PGRST205' || /robot_handoff/.test(String(e.message || ''))) }

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const { admin, companyId, podeEditar } = await gestor(request, url.searchParams.get('companyId'))
    const dias = Math.max(1, Math.min(90, Number(url.searchParams.get('dias')) || 7))
    const desde = new Date(Date.now() - dias * 86_400_000).toISOString()

    const [{ data: cfg, error: cErr }, { data: hs, error: hErr }, { data: vend }] = await Promise.all([
      admin.from('robot_handoff_settings').select('*').eq('company_id', companyId).maybeSingle(),
      admin.from('robot_handoffs').select('id,lead_id,nivel,estado,assigned_to,assigned_at,prazo,contactada_em,resultado,reatribuicoes,admin_avisado,created_at,historico')
        .eq('company_id', companyId).or(`created_at.gte.${desde},estado.in.(atribuida,sem_vendedor)`).order('created_at', { ascending: false }).limit(2000),
      admin.from('usuarios').select('id,full_name,role,status').eq('company_id', companyId).eq('role', 'parceiro'),
    ])
    if (semTabela(cErr) || semTabela(hErr)) return NextResponse.json({ instalado: false })
    if (hErr) throw new SdDialerError('Não foi possível carregar o fluxo.', 500)

    const lista = hs || []
    const leadIds = Array.from(new Set(lista.map(h => h.lead_id)))
    const leads = new Map<string, any>()
    for (let i = 0; i < leadIds.length; i += 300) {
      const { data } = await admin.from('leads').select('id,nome,telefone').in('id', leadIds.slice(i, i + 300))
      for (const l of data || []) leads.set(String(l.id), l)
    }
    const nomes = new Map((vend || []).map((v: any) => [String(v.id), v.full_name || 'Sem nome']))

    const periodo = lista.filter(h => h.created_at >= desde)
    const contactadas = periodo.filter(h => h.contactada_em)
    const minutos = (h: any) => Math.max(0, (new Date(h.contactada_em).getTime() - new Date(h.assigned_at || h.created_at).getTime()) / 60000)
    const aTempo = contactadas.filter(h => !h.prazo || new Date(h.contactada_em) <= new Date(h.prazo))
    const mediana = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return Math.round(s[Math.floor(s.length / 2)]) }

    const kpis = {
      qualificadas: periodo.length,
      emCurso: lista.filter(h => h.estado === 'atribuida' && !h.contactada_em).length,
      atrasadas: lista.filter(h => h.estado === 'atribuida' && !h.contactada_em && h.prazo && new Date(h.prazo) < new Date()).length,
      semVendedor: lista.filter(h => h.estado === 'sem_vendedor').length,
      contactadas: contactadas.length,
      aTempoPct: contactadas.length ? Math.round((aTempo.length / contactadas.length) * 100) : null,
      respostaMedianaMin: mediana(contactadas.map(minutos)),
      vendas: periodo.filter(h => h.estado === 'venda').length,
      conversaoPct: periodo.length ? Math.round((periodo.filter(h => h.estado === 'venda').length / periodo.length) * 1000) / 10 : null,
      reatribuidas: periodo.filter(h => h.reatribuicoes > 0).length,
    }

    // Por vendedor: o que recebeu no período (inclui as que lhe passaram por prazo).
    const porVend = new Map<string, { recebidas: number; contactadas: number; aTempo: number; vendas: number; perdeuPrazo: number; tempos: number[]; emCurso: number }>()
    const get = (id: string) => { if (!porVend.has(id)) porVend.set(id, { recebidas: 0, contactadas: 0, aTempo: 0, vendas: 0, perdeuPrazo: 0, tempos: [], emCurso: 0 }); return porVend.get(id)! }
    for (const h of periodo) {
      for (const e of (Array.isArray(h.historico) ? h.historico : [])) {
        if (e?.evento === 'atribuida' && e.vendedor) get(String(e.vendedor)).recebidas++
        if (e?.evento === 'atribuida' && e.motivo === 'prazo' && e.anterior) get(String(e.anterior)).perdeuPrazo++
      }
      if (h.assigned_to && h.contactada_em) {
        const v = get(String(h.assigned_to)); v.contactadas++; v.tempos.push(minutos(h))
        if (!h.prazo || new Date(h.contactada_em) <= new Date(h.prazo)) v.aTempo++
        if (h.estado === 'venda') v.vendas++
      }
    }
    for (const h of lista) if (h.estado === 'atribuida' && !h.contactada_em && h.assigned_to) get(String(h.assigned_to)).emCurso++
    const cfgEf = { ...PADRAO, ...(cfg || {}) }
    const vendedores = (vend || []).map((v: any) => {
      const s = porVend.get(String(v.id)) || { recebidas: 0, contactadas: 0, aTempo: 0, vendas: 0, perdeuPrazo: 0, tempos: [], emCurso: 0 }
      return { id: v.id, nome: v.full_name || 'Sem nome', ativo: (v.status || 'active') === 'active', participa: !cfgEf.excluidos.includes(v.id),
        recebidas: s.recebidas, emCurso: s.emCurso, contactadas: s.contactadas, aTempo: s.aTempo, vendas: s.vendas, perdeuPrazo: s.perdeuPrazo, respostaMedianaMin: mediana(s.tempos) }
    }).sort((a: any, b: any) => b.vendas - a.vendas || b.contactadas - a.contactadas || a.nome.localeCompare(b.nome))

    const emCurso = lista.filter(h => ['atribuida', 'sem_vendedor'].includes(h.estado) && !h.contactada_em)
      .sort((a, b) => String(a.prazo || '9').localeCompare(String(b.prazo || '9')))
      .slice(0, 100)
      .map(h => ({ id: h.id, leadId: h.lead_id, nome: leads.get(String(h.lead_id))?.nome || 'Sem nome', nivel: h.nivel, estado: h.estado,
        vendedor: h.assigned_to ? nomes.get(String(h.assigned_to)) || '—' : null, vendedorId: h.assigned_to, prazo: h.prazo, reatribuicoes: h.reatribuicoes, criada: h.created_at }))

    const recentes = lista.filter(h => h.contactada_em).slice(0, 30).map(h => ({ id: h.id, leadId: h.lead_id, nome: leads.get(String(h.lead_id))?.nome || 'Sem nome',
      estado: h.estado, resultado: h.resultado, vendedor: h.assigned_to ? nomes.get(String(h.assigned_to)) || '—' : null, minutos: Math.round(minutos(h)),
      aTempo: !h.prazo || new Date(h.contactada_em) <= new Date(h.prazo) }))

    return NextResponse.json({ instalado: true, podeEditar, dias, definicoes: cfgEf, kpis, emCurso, recentes, vendedores })
  } catch (error) {
    return errorResponse(error, 'admin robot-fluxo GET')
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as Record<string, any>
    const { admin, companyId, podeEditar, profile } = await gestor(request, body.companyId)
    if (!podeEditar) throw new SdDialerError('Só o admin pode mudar as definições.', 403)
    const int = (v: any, min: number, max: number, d: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d }
    const dias = Array.isArray(body.dias) ? Array.from(new Set(body.dias.map(Number).filter((d: number) => d >= 1 && d <= 7))).sort() : PADRAO.dias
    const { data: vend } = await admin.from('usuarios').select('id').eq('company_id', companyId)
    const validos = new Set((vend || []).map((v: any) => String(v.id)))
    const row = {
      company_id: companyId,
      ativo: body.ativo !== false,
      sla_minutos: int(body.sla_minutos, 5, 1440, 30),
      hora_inicio: int(body.hora_inicio, 0, 23, 9),
      hora_fim: int(body.hora_fim, 1, 24, 20),
      dias: dias.length ? dias : PADRAO.dias,
      max_reatribuicoes: int(body.max_reatribuicoes, 0, 10, 2),
      excluidos: (Array.isArray(body.excluidos) ? body.excluidos.map(String) : []).filter((id: string) => validos.has(id)),
      updated_at: new Date().toISOString(),
      updated_by: profile.id,
    }
    if (row.hora_fim <= row.hora_inicio) throw new SdDialerError('A hora de fim tem de ser depois da hora de início.', 400)
    const { error } = await admin.from('robot_handoff_settings').upsert(row, { onConflict: 'company_id' })
    if (error) throw new SdDialerError(semTabela(error) ? 'O fluxo ainda não está instalado na base de dados.' : 'Não foi possível guardar.', 500)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return errorResponse(error, 'admin robot-fluxo PUT')
  }
}

// POST: passar uma lead a outro vendedor à mão ({ handoffId, para? }). Sem "para", escolhe o que tem menos.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as Record<string, any>
    const { admin, companyId } = await gestor(request, body.companyId)
    const handoffId = String(body.handoffId || '')
    if (!handoffId) throw new SdDialerError('Falta a lead.', 400)
    const { data: h } = await admin.from('robot_handoffs').select('id,company_id').eq('id', handoffId).maybeSingle()
    if (!h || String(h.company_id) !== companyId) throw new SdDialerError('Lead não encontrada.', 404)
    let para: string | null = body.para ? String(body.para) : null
    if (para) {
      const { data: u } = await admin.from('usuarios').select('id,company_id,role').eq('id', para).maybeSingle()
      if (!u || String(u.company_id) !== companyId || u.role !== 'parceiro') throw new SdDialerError('Vendedor inválido.', 400)
    }
    const { data, error } = await admin.rpc('robot_atribuir', { p_handoff: handoffId, p_motivo: 'manual', p_para: para })
    if (error) throw new SdDialerError('Não foi possível passar a lead.', 500)
    if (!data) throw new SdDialerError('Não há outro vendedor disponível.', 409)
    return NextResponse.json({ ok: true, para: data })
  } catch (error) {
    return errorResponse(error, 'admin robot-fluxo POST')
  }
}
