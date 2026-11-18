import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const origins = new Set(['https://luminai.pt', 'https://www.luminai.pt'])
const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && origins.has(origin) ? origin : 'https://luminai.pt',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  Vary: 'Origin',
})
const clean = (v: unknown, n = 180) => String(v ?? '').trim().slice(0, n)
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get('origin')) })
}
export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')
  const headers = cors(origin)
  if (!origin || !origins.has(origin)) return NextResponse.json({ error: 'Origem não autorizada' }, { status: 403, headers })
  try {
    const body = await req.json()
    // Honeypot: bots that fill hidden fields do not create contacts.
    if (body.website) return NextResponse.json({ ok: true }, { headers })
    const nome = clean(body.nome, 120), telefone = clean(body.telefone, 32)
    const email = clean(body.email, 180), localidade = clean(body.localidade, 120)
    const experiencia = clean(body.experiencia, 500), disponibilidade = clean(body.disponibilidade, 160)
    if (nome.length < 2 || !/^\+?[0-9\s()-]{9,24}$/.test(telefone) || !body.consentimento) {
      return NextResponse.json({ error: 'Confirma o nome, telefone e consentimento.' }, { status: 400, headers })
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email inválido.' }, { status: 400, headers })
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('Supabase não configurado')
    const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
    let companyId = process.env.LUMIN_DEFAULT_COMPANY_ID || ''
    if (!companyId) {
      const { data, error } = await sb.from('companies').select('id').ilike('name', 'LUMIN AI').limit(1).maybeSingle()
      if (error) throw error
      companyId = data?.id || ''
    }
    if (!companyId) throw new Error('Empresa LUMIN AI não configurada')
    const { data: lead, error: insertError } = await sb.from('leads').insert({
      company_id: companyId, nome, telefone, email: email || null, status: 'novo',
      imported_at: new Date().toISOString(),
      observacoes: ['CANDIDATURA — RECRUTAMENTO REMOTO', 'Localidade: '+localidade,
        'Experiência: '+experiencia, 'Disponibilidade: '+disponibilidade].join('\n'),
      custom_fields: { source: 'luminai.pt', form: 'recrutamento_remoto',
        tipo: 'candidatura', localidade, experiencia, disponibilidade,
        page_url: 'https://luminai.pt/recrutamento/' },
    }).select('id').single()
    if (insertError) throw insertError

    // Destinatário explícito: nunca notificar automaticamente outros parceiros.
    // Definir LUMIN_RECRUITMENT_NOTIFY_USER_ID com o UUID da conta administradora.
    const notifyUserId = process.env.LUMIN_RECRUITMENT_NOTIFY_USER_ID
    let notified = false
    if (notifyUserId) {
      const { error } = await sb.from('notificacoes').insert({
        user_id: notifyUserId, type: 'nova_lead', title: 'Nova candidatura LUMIN AI',
        message: nome + (localidade ? ' · ' + localidade : ''),
        read: false, data: { lead_id: lead.id, tipo: 'recrutamento', company_id: companyId },
      })
      if (error) console.error('Recruitment notification failed', error.message)
      else notified = true
    } else console.warn('LUMIN_RECRUITMENT_NOTIFY_USER_ID missing; lead saved without bell notification')
    return NextResponse.json({ ok: true, notification_sent: notified }, { headers })
  } catch (error) {
    console.error('Recruitment submission error', error)
    return NextResponse.json({ error: 'Não foi possível enviar a candidatura. Tenta novamente.' }, { status: 500, headers })
  }
}
