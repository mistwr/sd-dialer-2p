import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type LeadRow = {
  id: string
  nome: string | null
  email: string | null
  telefone: string
  status: string | null
  observacoes: string | null
  custom_fields: unknown
}

const INTERESTS = new Set(['telecomunicacoes', 'energia', 'ambos'])

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

function phoneVariants(e164: string) {
  const digits = e164.slice(1)
  const variants = [e164, digits, '00' + digits]
  if (digits.startsWith('351') && digits.length === 12) variants.push(digits.slice(3))
  return [...new Set(variants)]
}

function asCustomFields(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function hasCallId(fields: Record<string, unknown>, callId: string) {
  const callIds = fields.voice_call_ids
  return Array.isArray(callIds) && callIds.includes(callId)
}

function appendNotes(existing: string | null, additions: string[]) {
  return [clean(existing, 8000), ...additions.filter(Boolean)].filter(Boolean).join('\n')
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
  const phoneInput = clean(body.phone, 40)
  const phone = normalizePhone(phoneInput)
  const name = clean(body.name, 120)
  const email = clean(body.email, 180).toLowerCase()
  const interest = clean(body.interest, 40).toLowerCase()
  const currentOperator = clean(body.current_operator, 120)
  const summary = clean(body.summary, 1000)
  const nextAction = clean(body.next_action, 500)

  if (body.consent_to_contact !== true) {
    return NextResponse.json({ error: 'explicit contact consent required' }, { status: 400 })
  }
  if (!callId || !phone || !name || !INTERESTS.has(interest)) {
    return NextResponse.json({ error: 'call_id, valid phone, name and valid interest are required' }, { status: 400 })
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'invalid email' }, { status: 400 })
  }

  const companyId =
    process.env.LUMIN_VOICE_DEFAULT_COMPANY_ID ||
    process.env.LUMIN_DEFAULT_COMPANY_ID ||
    process.env.REBORN_DEFAULT_COMPANY_ID
  if (!companyId) {
    return NextResponse.json({ error: 'voice lead company is not configured' }, { status: 503 })
  }

  try {
    const supabase = adminClient()
    const { data: callMatch, error: callLookupError } = await supabase
      .from('leads')
      .select('id,nome,email,telefone,status,observacoes,custom_fields')
      .eq('company_id', companyId)
      .contains('custom_fields', { voice_call_ids: [callId] })
      .limit(1)
      .maybeSingle()

    if (callLookupError) throw callLookupError

    let existing = callMatch as LeadRow | null
    if (!existing) {
      const { data: phoneMatch, error: phoneLookupError } = await supabase
        .from('leads')
        .select('id,nome,email,telefone,status,observacoes,custom_fields')
        .eq('company_id', companyId)
        .in('telefone', phoneVariants(phone))
        .limit(1)
        .maybeSingle()
      if (phoneLookupError) throw phoneLookupError
      existing = phoneMatch as LeadRow | null
    }

    const consentAt = new Date().toISOString()
    const previousFields = asCustomFields(existing?.custom_fields)
    const previousCallIds = Array.isArray(previousFields.voice_call_ids)
      ? previousFields.voice_call_ids.filter((id): id is string => typeof id === 'string')
      : []
    const voiceCallIds = [...new Set([...previousCallIds, callId])].slice(-20)
    const customFields = {
      ...previousFields,
      source: existing ? previousFields.source || 'lumin_voice_agent' : 'lumin_voice_agent',
      temperature: existing ? previousFields.temperature : 'warm',
      voice_call_id: callId,
      voice_call_ids: voiceCallIds,
      voice_interest: interest,
      voice_current_operator: currentOperator || null,
      voice_summary: summary || null,
      voice_next_action: nextAction || null,
      voice_contact_consent: true,
      voice_contact_consent_at: consentAt,
    }

    const notes = appendNotes(existing?.observacoes ?? null, [
      'Lead de chamada telefónica — Lumin AI',
      'Chamada: ' + callId,
      'Interesse: ' + interest,
      currentOperator ? 'Operador atual: ' + currentOperator : '',
      summary ? 'Resumo: ' + summary : '',
      nextAction ? 'Próxima ação: ' + nextAction : '',
      'Autorização de contacto confirmada em ' + consentAt,
    ])

    let leadId: string
    let status: string
    let created = false

    if (existing) {
      const existingName = clean(existing.nome, 120)
      const placeholderName = /^(lead|contacto|cliente)\b/i.test(existingName)
      const { error } = await supabase
        .from('leads')
        .update({
          nome: !existingName || placeholderName ? name : existingName,
          email: existing.email || email || null,
          observacoes: notes,
          custom_fields: customFields,
        })
        .eq('id', existing.id)
        .eq('company_id', companyId)
      if (error) throw error
      leadId = existing.id
      status = existing.status || 'novo'
    } else {
      const { data, error } = await supabase
        .from('leads')
        .insert({
          nome: name,
          telefone: phone,
          email: email || null,
          company_id: companyId,
          status: 'novo',
          origem: 'outro',
          imported_at: consentAt,
          observacoes: notes,
          custom_fields: customFields,
        })
        .select('id')
        .single()
      if (error) throw error
      leadId = data.id
      status = 'novo'
      created = true
    }

    return NextResponse.json({ ok: true, lead_id: leadId, created, status })
  } catch (error) {
    console.error('Lumin voice lead capture failed', error)
    return NextResponse.json({ error: 'voice lead capture failed' }, { status: 500 })
  }
}
