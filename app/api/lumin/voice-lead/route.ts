import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type VoiceLeadResult = {
  lead_id: string
  created: boolean
  deduplicated: boolean
  status: string
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Supabase server credentials missing')
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

function clean(value: unknown, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function safeKeyMatch(provided: string, expected: string) {
  const providedBytes = Buffer.from(provided)
  const expectedBytes = Buffer.from(expected)
  return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes)
}

function normalizePhone(value: string): string | null {
  const trimmed = value.trim()
  let digits = trimmed.replace(/\D/g, '')
  if (trimmed.startsWith('00')) digits = digits.slice(2)
  else if (!trimmed.startsWith('+') && digits.length === 9) digits = '351' + digits

  if (digits.length < 8 || digits.length > 15 || digits.startsWith('0')) return null
  return '+' + digits
}

function consentTimestamp(value: unknown) {
  const parsed = Date.parse(clean(value, 64))
  const now = Date.now()
  if (!Number.isFinite(parsed) || parsed > now + 5 * 60 * 1000) {
    return new Date(now).toISOString()
  }
  return new Date(parsed).toISOString()
}

export async function POST(request: NextRequest) {
  const expectedKey = process.env.LUMIN_VOICE_LEAD_API_KEY
  if (!expectedKey) {
    return NextResponse.json({ error: 'LUMIN_VOICE_LEAD_API_KEY missing' }, { status: 503 })
  }

  const providedKey = request.headers.get('x-api-key') || ''
  if (!safeKeyMatch(providedKey, expectedKey)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    const parsed = await request.json()
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
    }
    body = parsed as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const callId = clean(body.call_id, 80)
  const phone = normalizePhone(clean(body.phone, 40))
  const name = clean(body.name, 120)
  const email = clean(body.email, 180).toLowerCase()
  const interest = clean(body.interest, 40).toLowerCase()
  const currentOperator = clean(body.current_operator, 120)
  const summary = clean(body.summary, 1000)
  const nextAction = clean(body.next_action, 500)
  const consentAt = consentTimestamp(body.consent_at)

  if (body.consent_to_contact !== true) {
    return NextResponse.json({ error: 'explicit contact consent required' }, { status: 400 })
  }
  if (!callId || !phone || !name || !['telecomunicacoes', 'energia', 'ambos'].includes(interest)) {
    return NextResponse.json({ error: 'call_id, valid phone, name and valid interest are required' }, { status: 400 })
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'invalid email' }, { status: 400 })
  }

  const companyId =
    process.env.LUMIN_VOICE_DEFAULT_COMPANY_ID ||
    process.env.LUMIN_DEFAULT_COMPANY_ID ||
    process.env.REBORN_DEFAULT_COMPANY_ID
  if (!companyId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(companyId)) {
    return NextResponse.json({ error: 'voice lead company is not configured with a valid ID' }, { status: 503 })
  }

  try {
    const supabase = adminClient()
    const { data, error } = await supabase.rpc('lumin_voice_register_lead', {
      p_company_id: companyId,
      p_call_id: callId,
      p_phone: phone,
      p_name: name,
      p_email: email || null,
      p_interest: interest,
      p_current_operator: currentOperator || null,
      p_summary: summary || null,
      p_next_action: nextAction || null,
      p_consent_at: consentAt,
      p_consent_to_contact: true,
    })
    if (error) throw error

    const result = (Array.isArray(data) ? data[0] : data) as VoiceLeadResult | null
    if (!result?.lead_id) throw new Error('Lead registration returned no lead ID')

    return NextResponse.json({
      ok: true,
      lead_id: result.lead_id,
      created: result.created,
      deduplicated: result.deduplicated,
      status: result.status,
    })
  } catch (error) {
    console.error('Lumin voice lead capture failed', error)
    return NextResponse.json({ error: 'voice lead capture failed' }, { status: 500 })
  }
}
