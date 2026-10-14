import { createClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

export type TwilioCallerId = {
  phoneNumber: string
  friendlyName: string
  source: 'Número Twilio' | 'Caller ID verificado'
}

export class CallerIdError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export type CallerIdProfile = { id: string; role: string; company_id: string }
type TwilioItem = { phone_number?: string; friendly_name?: string }
type CallerIdCache = { accountSid: string; expiresAt: number; callerIds: TwilioCallerId[] }
export type CompanyCallerId = {
  company_id: string
  phone_number: string
  friendly_name: string
  status: 'pending' | 'verified'
  verification_method: 'sms' | 'call' | 'existing'
  requested_by: string | null
  expires_at: string | null
  verified_at: string | null
}

let callerIdCache: CallerIdCache | null = null
const allowedRoles = new Set(['parceiro', 'admin', 'supervisor', 'super_admin'])

function supabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new CallerIdError(503, 'Integração de autenticação não configurada.')
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export function normalizeCallerId(value: unknown): string {
  const phoneNumber = String(value ?? '').trim().replace(/[^\d+]/g, '')
  if (!/^\+[1-9]\d{7,14}$/.test(phoneNumber)) {
    throw new CallerIdError(400, 'Introduz um número internacional válido, por exemplo +351912345678.')
  }
  return phoneNumber
}

export async function requireSdCallerIdUser(request: NextRequest): Promise<CallerIdProfile> {
  const jwt = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!jwt) throw new CallerIdError(401, 'Sessão do SD Dialer em falta.')

  const supabase = supabaseAdmin()
  const { data: authData, error: authError } = await supabase.auth.getUser(jwt)
  if (authError || !authData.user) throw new CallerIdError(401, 'Sessão do SD Dialer inválida.')

  const { data: profile, error: profileError } = await supabase
    .from('usuarios')
    .select('id,role,company_id')
    .eq('id', authData.user.id)
    .single()

  if (profileError || !profile || !profile.company_id) {
    throw new CallerIdError(403, 'Perfil do SD Dialer sem empresa.')
  }
  if (!allowedRoles.has(profile.role)) {
    throw new CallerIdError(403, 'Perfil sem permissão para chamadas IA.')
  }
  return profile as CallerIdProfile
}

function twilioCredentials() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!accountSid || !authToken) {
    throw new CallerIdError(503, 'Configura TWILIO_ACCOUNT_SID e TWILIO_AUTH_TOKEN no SD Dialer.')
  }
  return {
    accountSid,
    authorization: 'Basic ' + Buffer.from(accountSid + ':' + authToken).toString('base64'),
  }
}

async function twilioGet(url: string, authorization: string): Promise<any> {
  const parsed = new URL(url)
  const accountPrefix = '/2010-04-01/Accounts/'
  if (parsed.origin !== 'https://api.twilio.com' || !parsed.pathname.includes(accountPrefix)) {
    throw new CallerIdError(502, 'A paginação devolvida pela Twilio é inválida.')
  }

  const response = await fetch(parsed.toString(), {
    headers: { Authorization: authorization, Accept: 'application/json' },
    cache: 'no-store',
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new CallerIdError(502, result?.message || 'Não foi possível consultar os números Twilio.')
  }
  return result
}

async function listTwilioResource(
  accountSid: string,
  authorization: string,
  resource: 'IncomingPhoneNumbers' | 'OutgoingCallerIds',
  itemKey: 'incoming_phone_numbers' | 'outgoing_caller_ids',
): Promise<TwilioItem[]> {
  let nextUrl: string | null =
    'https://api.twilio.com/2010-04-01/Accounts/' +
    encodeURIComponent(accountSid) + '/' + resource + '.json?PageSize=100'
  const items: TwilioItem[] = []
  let pages = 0

  while (nextUrl && pages < 10) {
    const page = await twilioGet(nextUrl, authorization)
    if (Array.isArray(page?.[itemKey])) items.push(...page[itemKey])
    nextUrl = page?.next_page_uri
      ? new URL(page.next_page_uri, 'https://api.twilio.com').toString()
      : null
    pages += 1
  }
  return items
}

export async function listTwilioCallerIds(forceRefresh = false): Promise<TwilioCallerId[]> {
  const { accountSid, authorization } = twilioCredentials()
  if (!forceRefresh && callerIdCache?.accountSid === accountSid && callerIdCache.expiresAt > Date.now()) {
    return callerIdCache.callerIds
  }

  const [ownedNumbers, verifiedNumbers] = await Promise.all([
    listTwilioResource(accountSid, authorization, 'IncomingPhoneNumbers', 'incoming_phone_numbers'),
    listTwilioResource(accountSid, authorization, 'OutgoingCallerIds', 'outgoing_caller_ids'),
  ])

  const numbers = new Map<string, TwilioCallerId>()
  for (const [items, source] of [
    [ownedNumbers, 'Número Twilio'],
    [verifiedNumbers, 'Caller ID verificado'],
  ] as const) {
    for (const item of items) {
      const phoneNumber = item.phone_number
      if (!phoneNumber || !/^\+[1-9]\d{7,14}$/.test(phoneNumber)) continue
      if (!numbers.has(phoneNumber) || source === 'Número Twilio') {
        numbers.set(phoneNumber, {
          phoneNumber,
          friendlyName: String(item.friendly_name || phoneNumber).slice(0, 64),
          source,
        })
      }
    }
  }

  const callerIds = [...numbers.values()].sort((a, b) => a.phoneNumber.localeCompare(b.phoneNumber))
  callerIdCache = { accountSid, expiresAt: Date.now() + 30_000, callerIds }
  return callerIds
}

export function getDefaultTwilioCallerId(): string {
  const phoneNumber = process.env.TWILIO_FROM_NUMBER || ''
  return /^\+[1-9]\d{7,14}$/.test(phoneNumber) ? phoneNumber : ''
}

export async function listCompanyCallerIds(companyId: string): Promise<CompanyCallerId[]> {
  const { data, error } = await supabaseAdmin()
    .from('company_caller_ids')
    .select('company_id,phone_number,friendly_name,status,verification_method,requested_by,expires_at,verified_at')
    .eq('company_id', companyId)
    .eq('status', 'verified')
    .order('created_at', { ascending: false })
  if (error) throw new CallerIdError(502, 'Não foi possível carregar os números desta empresa.')
  return (data ?? []) as CompanyCallerId[]
}

export async function findCallerIdAssociation(phoneNumber: string): Promise<CompanyCallerId | null> {
  const { data, error } = await supabaseAdmin()
    .from('company_caller_ids')
    .select('company_id,phone_number,friendly_name,status,verification_method,requested_by,expires_at,verified_at')
    .eq('phone_number', phoneNumber)
    .maybeSingle()
  if (error) throw new CallerIdError(502, 'Não foi possível consultar a associação do número.')
  return (data ?? null) as CompanyCallerId | null
}

export async function beginCompanyCallerIdVerification(
  profile: CallerIdProfile,
  phoneNumber: string,
  friendlyName: string,
  method: 'sms' | 'call',
): Promise<{ alreadyLinked: boolean }> {
  const supabase = supabaseAdmin()
  const current = await findCallerIdAssociation(phoneNumber)
  if (current && current.company_id !== profile.company_id) {
    throw new CallerIdError(409, 'Este número já está associado a outra empresa.')
  }
  if (current?.status === 'verified') return { alreadyLinked: true }

  const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString()
  const values = {
    company_id: profile.company_id,
    phone_number: phoneNumber,
    friendly_name: friendlyName.slice(0, 64),
    status: 'pending',
    verification_method: method,
    requested_by: profile.id,
    expires_at: expiresAt,
  }

  const result = current
    ? await supabase.from('company_caller_ids').update(values).eq('phone_number', phoneNumber)
    : await supabase.from('company_caller_ids').insert(values)
  if (result.error) {
    if (result.error.code === '23505') {
      throw new CallerIdError(409, 'Este número já está associado a outra empresa.')
    }
    throw new CallerIdError(502, 'Não foi possível iniciar a associação do número.')
  }
  return { alreadyLinked: false }
}

export async function completeCompanyCallerIdVerification(
  profile: CallerIdProfile,
  phoneNumber: string,
): Promise<{ alreadyLinked: boolean }> {
  const supabase = supabaseAdmin()
  const current = await findCallerIdAssociation(phoneNumber)
  if (!current || current.company_id !== profile.company_id) {
    throw new CallerIdError(404, 'Não existe uma verificação pendente deste número para a empresa.')
  }
  if (current.status === 'verified') return { alreadyLinked: true }
  if (!current.expires_at || Date.parse(current.expires_at) <= Date.now()) {
    await supabase
      .from('company_caller_ids')
      .delete()
      .eq('company_id', profile.company_id)
      .eq('phone_number', phoneNumber)
      .eq('status', 'pending')
    throw new CallerIdError(410, 'A verificação expirou. Inicia novamente o processo.')
  }
  if (!(await isTwilioCallerIdVerified(phoneNumber, true))) {
    throw new CallerIdError(409, 'A Twilio ainda não confirmou este número. Termina a verificação e tenta novamente.')
  }

  const { error } = await supabase
    .from('company_caller_ids')
    .update({ status: 'verified', verified_at: new Date().toISOString(), expires_at: null })
    .eq('company_id', profile.company_id)
    .eq('phone_number', phoneNumber)
    .eq('status', 'pending')
  if (error) throw new CallerIdError(502, 'Não foi possível concluir a associação do número.')
  return { alreadyLinked: false }
}

export async function associateExistingCallerId(
  profile: CallerIdProfile,
  phoneNumber: string,
  friendlyName: string,
): Promise<void> {
  if (!['admin', 'super_admin'].includes(profile.role)) {
    throw new CallerIdError(403, 'Só um administrador pode associar um número que já estava verificado.')
  }
  if (!(await isTwilioCallerIdVerified(phoneNumber, true))) {
    throw new CallerIdError(404, 'Este número ainda não está verificado na conta Twilio.')
  }

  const current = await findCallerIdAssociation(phoneNumber)
  if (current?.company_id === profile.company_id && current.status === 'verified') return
  if (current) throw new CallerIdError(409, 'Este número já está associado a outra empresa.')

  const { error } = await supabaseAdmin().from('company_caller_ids').insert({
    company_id: profile.company_id,
    phone_number: phoneNumber,
    friendly_name: friendlyName.slice(0, 64),
    status: 'verified',
    verification_method: 'existing',
    requested_by: profile.id,
    verified_at: new Date().toISOString(),
    expires_at: null,
  })
  if (error) {
    if (error.code === '23505') throw new CallerIdError(409, 'Este número já está associado a outra empresa.')
    throw new CallerIdError(502, 'Não foi possível associar o número existente.')
  }
}

export async function isCompanyCallerIdAuthorized(companyId: string, phoneNumber: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from('company_caller_ids')
    .select('phone_number')
    .eq('company_id', companyId)
    .eq('phone_number', phoneNumber)
    .eq('status', 'verified')
    .maybeSingle()
  if (error) throw new CallerIdError(502, 'Não foi possível validar a empresa deste Caller ID.')
  return Boolean(data)
}

export async function isTwilioCallerIdVerified(phoneNumber: string, forceRefresh = false): Promise<boolean> {
  const callerIds = await listTwilioCallerIds(forceRefresh)
  return callerIds.some((callerId) => callerId.phoneNumber === phoneNumber)
}

export async function startTwilioCallerIdVerification(
  phoneNumber: string,
  friendlyName: string,
): Promise<{ callSid: string; validationCode: string }> {
  const { accountSid, authorization } = twilioCredentials()
  const body = new URLSearchParams({
    PhoneNumber: phoneNumber,
    FriendlyName: friendlyName.slice(0, 64),
  })
  const response = await fetch(
    'https://api.twilio.com/2010-04-01/Accounts/' +
      encodeURIComponent(accountSid) + '/OutgoingCallerIds.json',
    {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
      cache: 'no-store',
    },
  )
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new CallerIdError(502, result?.message || 'A Twilio não conseguiu iniciar a verificação por chamada.')
  }

  callerIdCache = null
  return {
    callSid: String(result?.call_sid || ''),
    validationCode: String(result?.validation_code || ''),
  }
}
