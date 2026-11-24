import { NextRequest, NextResponse } from 'next/server'
import { errorResponse, requireSdDialerUser, SdDialerError } from '@/lib/server/sd-dialer-livekit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FECHADO = new Set(['venda', 'nao_interessado', 'numero_errado', 'numero_nao_atribuido', 'pertence_outra_pessoa'])
const semTabela = (e: any) => !!e && (e.code === '42P01' || e.code === 'PGRST205' || /robot_handoffs/.test(String(e.message || '')))

function infoDaChamada(c: any, l: any) {
  const info = (c?.extracted_facts && c.extracted_facts.call_info) || {}
  return {
    resumo: c?.summary || '',
    proximoPasso: c?.next_action || '',
    operadora: info.operadora_atual || l?.operador || null,
    valor: info.valor_atual || null,
    agendado: info.consultor_agendado || null,
  }
}

// GET: leads que o robot qualificou e que estão com este vendedor, com o prazo para ligar.
// Só lê; só devolve leads da própria empresa e atribuídas ao próprio utilizador.
export async function GET(request: NextRequest) {
  try {
    const { admin, profile } = await requireSdDialerUser(request)
    const desde = new Date(Date.now() - 14 * 86_400_000).toISOString()

    const { data: hs, error: hErr } = await admin
      .from('robot_handoffs')
      .select('id,lead_id,voice_call_id,nivel,estado,prazo,assigned_at,contactada_em,resultado,created_at')
      .eq('assigned_to', profile.id)
      .eq('company_id', profile.company_id)
      .or(`estado.eq.atribuida,updated_at.gte.${desde}`)
      .order('created_at', { ascending: false })
      .limit(60)

    if (!hErr) {
      const lista = hs || []
      if (!lista.length) return NextResponse.json({ rows: [], fluxo: true })
      const leadIds = lista.map(h => h.lead_id)
      const callIds = lista.map(h => h.voice_call_id).filter(Boolean)
      const [{ data: leads }, { data: calls }] = await Promise.all([
        admin.from('leads').select('id,nome,telefone,status,operador').in('id', leadIds),
        callIds.length ? admin.from('voice_calls').select('id,summary,next_action,extracted_facts').in('id', callIds) : Promise.resolve({ data: [] as any[] }),
      ])
      const L = new Map((leads || []).map((l: any) => [String(l.id), l]))
      const C = new Map((calls || []).map((c: any) => [String(c.id), c]))
      const rows = lista.map(h => {
        const l = L.get(String(h.lead_id)); const c = C.get(String(h.voice_call_id))
        return {
          leadId: h.lead_id, nome: l?.nome || 'Sem nome', telefone: l?.telefone, estado: h.estado === 'atribuida' ? (l?.status || null) : h.estado,
          porLigar: h.estado === 'atribuida' && !h.contactada_em, prazo: h.prazo, nivel: h.nivel, quando: h.assigned_at || h.created_at,
          ...infoDaChamada(c, l),
        }
      })
      rows.sort((a, b) => Number(b.porLigar) - Number(a.porLigar) || String(a.prazo || '').localeCompare(String(b.prazo || '')) || String(b.quando).localeCompare(String(a.quando)))
      return NextResponse.json({ rows: rows.slice(0, 50), fluxo: true })
    }
    if (!semTabela(hErr)) throw new SdDialerError('Não foi possível carregar as leads do robot.', 500)

    // Sem a tabela do fluxo (migração ainda não aplicada): leads qualificadas já atribuídas ao vendedor.
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
    const { data: calls, error } = await admin
      .from('voice_calls')
      .select('id,lead_id,interest_level,summary,next_action,created_at,extracted_facts')
      .eq('company_id', profile.company_id).in('interest_level', ['alto', 'medio']).not('lead_id', 'is', null)
      .gte('created_at', since).order('created_at', { ascending: false }).limit(1000)
    if (error) throw new SdDialerError('Não foi possível carregar as leads do robot.', 500)
    const ultima = new Map<string, any>()
    for (const c of calls || []) if (!ultima.has(String(c.lead_id))) ultima.set(String(c.lead_id), c)
    const ids = Array.from(ultima.keys())
    const leads: any[] = []
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await admin.from('leads').select('id,nome,telefone,status,operador')
        .in('id', ids.slice(i, i + 200)).eq('assigned_to', profile.id).eq('company_id', profile.company_id)
      leads.push(...(data || []))
    }
    const rows = leads.map(l => {
      const c = ultima.get(String(l.id))
      return { leadId: l.id, nome: l.nome || 'Sem nome', telefone: l.telefone, estado: l.status, porLigar: !FECHADO.has(String(l.status)), prazo: null, nivel: c?.interest_level, quando: c?.created_at, ...infoDaChamada(c, l) }
    })
    rows.sort((a, b) => Number(b.porLigar) - Number(a.porLigar) || String(b.quando).localeCompare(String(a.quando)))
    return NextResponse.json({ rows: rows.slice(0, 50), fluxo: false })
  } catch (error) {
    return errorResponse(error, 'parceiro leads-robot GET')
  }
}
