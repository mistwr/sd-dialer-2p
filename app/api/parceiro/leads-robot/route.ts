import { NextRequest, NextResponse } from 'next/server'
import { errorResponse, requireSdDialerUser, SdDialerError } from '@/lib/server/sd-dialer-livekit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET: leads que o robot qualificou (interesse alto/médio) e que já foram atribuídas a este vendedor.
// Só lê; só devolve leads da própria empresa e com assigned_to = o próprio utilizador.
export async function GET(request: NextRequest) {
  try {
    const { admin, profile } = await requireSdDialerUser(request)
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString()

    const { data: calls, error } = await admin
      .from('voice_calls')
      .select('id,lead_id,interest_level,summary,next_action,created_at,extracted_facts')
      .eq('company_id', profile.company_id)
      .in('interest_level', ['alto', 'medio'])
      .not('lead_id', 'is', null)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1000)
    if (error) throw new SdDialerError('Não foi possível carregar as leads do robot.', 500)

    const ultima = new Map<string, any>()
    for (const c of calls || []) if (!ultima.has(String(c.lead_id))) ultima.set(String(c.lead_id), c)
    const ids = Array.from(ultima.keys())
    if (!ids.length) return NextResponse.json({ rows: [] })

    const leads: any[] = []
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await admin.from('leads').select('id,nome,telefone,status,operador')
        .in('id', ids.slice(i, i + 200)).eq('assigned_to', profile.id).eq('company_id', profile.company_id)
      leads.push(...(data || []))
    }

    const rows = leads.map(l => {
      const c = ultima.get(String(l.id))
      const info = (c?.extracted_facts && c.extracted_facts.call_info) || {}
      return {
        leadId: l.id,
        nome: l.nome || 'Sem nome',
        telefone: l.telefone,
        estado: l.status,
        nivel: c?.interest_level,
        resumo: c?.summary || '',
        proximoPasso: c?.next_action || '',
        operadora: info.operadora_atual || l.operador || null,
        valor: info.valor_atual || null,
        agendado: info.consultor_agendado || null,
        quando: c?.created_at,
      }
    })
    const fechado = new Set(['venda', 'nao_interessado', 'numero_errado', 'numero_nao_atribuido', 'pertence_outra_pessoa'])
    rows.sort((a, b) => Number(fechado.has(String(a.estado))) - Number(fechado.has(String(b.estado)))
      || (a.nivel === b.nivel ? 0 : a.nivel === 'alto' ? -1 : 1)
      || String(b.quando).localeCompare(String(a.quando)))
    return NextResponse.json({ rows: rows.slice(0, 50) })
  } catch (error) {
    return errorResponse(error, 'parceiro leads-robot GET')
  }
}
