import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/server/sd-dialer-livekit'
import data from '@/data/nos-import.json'

export const runtime = 'nodejs'
export const maxDuration = 60

// Rota TEMPORÁRIA de importação única. Apagar depois de usada.
const COMPANY_ID = 'e27c8324-989a-4a68-b3a3-902cba74696c'
const CAMPANHA_ID = '4e05a0a1-0000-4000-8000-00000000a105'
const USER_ID = '8c43ee2a-9c99-4493-a215-abcb0849b8bf'

export async function POST(request: NextRequest) {
  const secret = process.env.CAMPAIGN_CRON_SECRET
  if (!secret || request.headers.get('x-cron-secret') !== secret) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }
  const admin = createAdminClient()
  const rows = data as { n: string; t: string; x: string[]; d: string }[]
  const existing = new Set<string>()
  for (let i = 0; i < rows.length; i += 300) {
    const phones = rows.slice(i, i + 300).map((r) => r.t)
    const { data: found, error } = await admin.from('leads').select('telefone').eq('company_id', COMPANY_ID).in('telefone', phones)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    for (const f of found || []) existing.add(String(f.telefone))
  }
  const toInsert = rows
    .filter((r) => !existing.has(r.t))
    .map((r) => ({
      company_id: COMPANY_ID,
      campanha_id: CAMPANHA_ID,
      assigned_to: USER_ID,
      nome: r.n,
      telefone: r.t,
      operador: 'NOS',
      status: 'novo',
      origem: 'importacao',
      data_termino_contrato: r.d,
      custom_fields: { telefones_extra: r.x, fim_contrato: r.d.slice(0, 7) },
      imported_by: USER_ID,
      skip_auto_assign: true,
    }))
  let inserted = 0
  for (let i = 0; i < toInsert.length; i += 300) {
    const { error } = await admin.from('leads').insert(toInsert.slice(i, i + 300))
    if (error) return NextResponse.json({ error: error.message, inserted }, { status: 500 })
    inserted += Math.min(300, toInsert.length - i)
  }
  return NextResponse.json({ ok: true, total: rows.length, ja_existiam: existing.size, inseridas: inserted })
}
