import { NextRequest, NextResponse } from 'next/server'
import { errorResponse, requireSdDialerUser, SdDialerError } from '@/lib/server/sd-dialer-livekit'

// Histórico de TODAS as chamadas de todas as empresas — só para o super admin.
// Filtros: vendedor, empresa, resultado, dias (período) e pesquisa por nome/telefone da lead.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { admin, profile } = await requireSdDialerUser(request)
    if (!profile.is_super_admin) throw new SdDialerError('Só o super admin vê o histórico de todos.', 403)
    const sp = request.nextUrl.searchParams
    const dias = Math.min(Math.max(Number(sp.get('dias')) || 7, 1), 365)
    const vendedor = sp.get('vendedor') || ''
    const empresa = sp.get('empresa') || ''
    const resultado = sp.get('resultado') || ''
    const q = (sp.get('q') || '').trim()
    const desde = new Date(Date.now() - dias * 86400000).toISOString()

    let query = admin.from('call_history')
      .select('id, result, duration_sec, notes, called_at, parceiro_id, company_id, ai_summary, lead:lead_id(id, nome, telefone)')
      .gte('called_at', desde).order('called_at', { ascending: false }).limit(1000)
    if (vendedor) query = query.eq('parceiro_id', vendedor)
    if (empresa) query = query.eq('company_id', empresa)
    if (resultado) query = query.eq('result', resultado)
    const { data: rows, error } = await query
    if (error) throw new SdDialerError(error.message, 500)

    const [{ data: users }, { data: emps }] = await Promise.all([
      admin.from('usuarios').select('id, full_name, company_id, status').order('full_name'),
      admin.from('companies').select('id, name').order('name'),
    ])
    const nomeU = new Map<string, string>((users || []).map((u: any) => [String(u.id), String(u.full_name || 'Sem nome')]))
    const nomeE = new Map<string, string>((emps || []).map((e: any) => [String(e.id), String(e.name || '')]))
    const ql = q.toLowerCase()
    const chamadas = (rows || []).map((r: any) => ({
      ...r, vendedor: nomeU.get(String(r.parceiro_id)) || '—', empresa: nomeE.get(String(r.company_id)) || '—',
    })).filter((r: any) => !ql || String(r.lead?.nome || '').toLowerCase().includes(ql) || String(r.lead?.telefone || '').includes(q) || r.vendedor.toLowerCase().includes(ql))

    return NextResponse.json({
      chamadas,
      vendedores: (users || []).filter((u: any) => u.status === 'active').map((u: any) => ({ id: u.id, nome: u.full_name || 'Sem nome', empresa: nomeE.get(String(u.company_id)) || '' })),
      empresas: (emps || []).map((e: any) => ({ id: e.id, nome: e.name })),
      limitado: (rows || []).length >= 1000,
    })
  } catch (err) {
    return errorResponse(err, 'historico-todos')
  }
}
