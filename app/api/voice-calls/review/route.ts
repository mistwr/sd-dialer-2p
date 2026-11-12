import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { applyCallOutcome } from '@/lib/server/voice-call-outcome'

const DECISIONS = ['voltar_a_ligar', 'passar_consultor', 'nao_ligar', 'ok'] as const
type Decision = (typeof DECISIONS)[number]

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: me } = await admin
    .from('usuarios')
    .select('id, full_name, role, status, company_id, is_super_admin')
    .eq('id', user.id)
    .maybeSingle()
  const allowed = me && me.status === 'active' && me.company_id &&
    (me.is_super_admin || me.role === 'super_admin' || me.role === 'admin' || me.role === 'supervisor')
  if (!allowed) return NextResponse.json({ error: 'Sem permissao' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const callId = String(body.call_id || '')
  const decision = String(body.decision || '') as Decision
  const note = String(body.note || '').slice(0, 300)
  if (!/^[0-9a-f-]{36}$/i.test(callId) || !DECISIONS.includes(decision)) {
    return NextResponse.json({ error: 'Pedido invalido' }, { status: 400 })
  }

  const { data: call } = await admin
    .from('voice_calls')
    .select('id, company_id, lead_id, extracted_facts')
    .eq('id', callId)
    .maybeSingle()
  if (!call || call.company_id !== me.company_id) return NextResponse.json({ error: 'Chamada nao encontrada' }, { status: 404 })

  const now = new Date().toISOString()
  const facts = call.extracted_facts && typeof call.extracted_facts === 'object' ? call.extracted_facts : {}
  const review = { decision, by: me.full_name || 'Utilizador', by_id: me.id, at: now, note: note || null }
  const { error } = await admin
    .from('voice_calls')
    .update({ extracted_facts: { ...facts, review }, updated_at: now })
    .eq('id', callId)
  if (error) return NextResponse.json({ error: 'Nao foi possivel guardar' }, { status: 500 })

  // Efeito na lead (nunca rebaixa leads vendidas).
  if (call.lead_id) {
    if (decision === 'nao_ligar') {
      await applyCallOutcome(admin, callId, { doNotCall: true })
    } else if (decision === 'voltar_a_ligar' || decision === 'passar_consultor') {
      const target = decision === 'voltar_a_ligar' ? 'ligar_depois' : 'contactado'
      const { data: lead } = await admin.from('leads').select('id,status').eq('id', call.lead_id).maybeSingle()
      if (lead && String(lead.status || '').toLowerCase() !== 'vendido') {
        await admin.from('leads').update({ status: target, updated_at: now }).eq('id', lead.id)
      }
    }
  }
  return NextResponse.json({ ok: true, review })
}
