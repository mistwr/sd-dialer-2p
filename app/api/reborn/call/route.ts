import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 30

function normalizePtPhone(input: string): string {
  const digits = String(input || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('351')) return `+${digits}`
  if (digits.startsWith('00')) return `+${digits.slice(2)}`
  if (digits.length === 9) return `+351${digits}`
  return `+${digits}`
}

async function authContext(request: NextRequest) {
  const jwt = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!jwt) throw new Error('UNAUTHORIZED')
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data, error } = await sb.auth.getUser(jwt)
  if (error || !data.user) throw new Error('UNAUTHORIZED')
  return { sb, user: data.user }
}

async function originateViaLumin(payload: Record<string, unknown>) {
  const url = process.env.LUMIN_GSM_BRIDGE_URL || process.env.REBORN_ORIGINATE_URL
  if (!url) return null
  const key = process.env.LUMIN_GSM_BRIDGE_KEY || process.env.REBORN_ORIGINATE_KEY
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) }, body: JSON.stringify(payload), signal: AbortSignal.timeout(12000) })
  const text = await response.text()
  if (!response.ok) throw new Error(`Lumin GSM Bridge ${response.status}: ${text.slice(0, 300)}`)
  let data: any = {}; try { data = text ? JSON.parse(text) : {} } catch { data = { raw: text } }
  return { provider: 'lumin-gsm', ...data }
}

export async function POST(request: NextRequest) {
  try {
    const { sb, user } = await authContext(request)
    const body = await request.json().catch(() => ({})) as { lead_id?: string; phone?: string }
    let phone = body.phone || ''; let lead: any = null
    if (body.lead_id) {
      const { data, error } = await sb.from('leads').select('id,nome,telefone,company_id,assigned_to,campanha_id,operador,observacoes').eq('id', body.lead_id).single()
      if (error || !data) return NextResponse.json({ error: 'Lead nao encontrada' }, { status: 404 })
      lead = data
      if (data.assigned_to && data.assigned_to !== user.id) {
        const { data: profile } = await sb.from('usuarios').select('role,company_id').eq('id', user.id).single()
        if (!profile || profile.company_id !== data.company_id || !['admin','supervisor'].includes(profile.role)) return NextResponse.json({ error: 'Sem permissao para esta lead' }, { status: 403 })
      }
      phone = data.telefone
    }
    const to = normalizePtPhone(phone)
    if (!to) return NextResponse.json({ error: 'Numero de telefone invalido' }, { status: 400 })
    const result = await originateViaLumin({ to, lead_id: lead?.id ?? body.lead_id ?? null, lead_name: lead?.nome ?? null, campaign_id: lead?.campanha_id ?? null, operator: lead?.operador ?? null, notes: lead?.observacoes ?? null, requested_by: user.id })
    if (result) return NextResponse.json({ ok: true, ...result })
    return NextResponse.json({ error: 'Lumin GSM Bridge ainda nao configurado.', code: 'LUMIN_GSM_BRIDGE_NOT_CONFIGURED' }, { status: 503 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno'
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
    console.error('[lumin-gsm-call]', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
