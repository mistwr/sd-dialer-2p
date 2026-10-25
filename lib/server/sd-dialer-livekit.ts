import { createClient } from '@supabase/supabase-js'
import { LiveKitAPI } from 'livekit-server-sdk'
import { NextRequest, NextResponse } from 'next/server'

const ALLOWED_ROLES = new Set(['parceiro', 'admin', 'supervisor', 'super_admin'])

export class SdDialerError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'SdDialerError'
    this.status = status
  }
}

export function errorResponse(error: unknown, label: string) {
  if (error instanceof SdDialerError) {
    return NextResponse.json(
      { error: error.message, detail: error.message },
      { status: error.status },
    )
  }

  const message = error instanceof Error ? error.message : 'Erro interno'
  console.error('[sd-dialer] ' + label, message)
  return NextResponse.json(
    { error: 'Erro interno ao processar a chamada.', detail: 'Erro interno ao processar a chamada.' },
    { status: 500 },
  )
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new SdDialerError('Supabase não está configurado na Netlify.', 503)
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export function createUserClient(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new SdDialerError('A ligação ao Supabase não está configurada na Netlify.', 503)
  }
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: 'Bearer ' + accessToken } },
  })
}

export async function requireSdDialerUser(request: NextRequest) {
  const accessToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!accessToken) throw new SdDialerError('Sessão expirada. Entra novamente no SD Dialer.', 401)

  const admin = createAdminClient()
  const { data, error } = await admin.auth.getUser(accessToken)
  if (error || !data.user) throw new SdDialerError('Sessão inválida. Entra novamente no SD Dialer.', 401)

  const { data: profile, error: profileError } = await admin
    .from('usuarios')
    .select('id,company_id,role,status,full_name,restricted_admin,is_super_admin')
    .eq('id', data.user.id)
    .maybeSingle()

  if (profileError) throw new SdDialerError('Não foi possível validar o perfil do SD Dialer.', 500)
  if (!profile?.company_id || profile.status !== 'active' || !ALLOWED_ROLES.has(String(profile.role))) {
    throw new SdDialerError('O teu utilizador não tem acesso às chamadas de IA.', 403)
  }

  return { admin, user: data.user, profile, accessToken }
}

export async function requireVoiceCallAccess(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  profile: { role?: string; is_super_admin?: boolean | null },
) {
  if (profile.is_super_admin === true || profile.role === 'super_admin') return { active: true, expiresAt: null as string | null }
  const { data, error } = await admin
    .from('voice_call_subscriptions')
    .select('status,expires_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new SdDialerError('Não foi possível verificar a subscrição das chamadas de IA.', 500)
  const active = data?.status === 'active' && new Date(data.expires_at).getTime() > Date.now()
  if (!active) {
    throw new SdDialerError('As chamadas de IA requerem uma subscrição ativa. Introduz o código de acesso fornecido pelo superadministrador.', 402)
  }
  return { active: true, expiresAt: String(data.expires_at) }
}

export async function requireSdDialerSuperAdmin(request: NextRequest) {
  const auth = await requireSdDialerUser(request)
  if (auth.profile.is_super_admin !== true && auth.profile.role !== 'super_admin') {
    throw new SdDialerError('Esta área é apenas para superadministradores.', 403)
  }
  return auth
}

const TWILIO_CALLER_ID_PROXY_URL = "https://luminai.pt/.netlify/functions/sd-dialer-caller-id"

function getTwilioCallerIdProxyToken() {
  return process.env.SD_DIALER_TWILIO_PROXY_TOKEN
}

export function isTwilioCallerIdConfigured() {
  return Boolean(getTwilioCallerIdProxyToken())
}

async function twilioCallerIdRequest(
  action: "lookup" | "verify",
  payload: { phoneNumber: string; friendlyName?: string },
) {
  const token = getTwilioCallerIdProxyToken()
  if (!token) {
    throw new SdDialerError("A validação de números pessoais não está configurada na Netlify.", 503)
  }

  let response: Response
  try {
    response = await fetch(TWILIO_CALLER_ID_PROXY_URL, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action, ...payload }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    })
  } catch {
    throw new SdDialerError("Não foi possível ligar ao serviço de validação Twilio.", 502)
  }

  const data = await response.json().catch(() => ({})) as Record<string, any>
  if (!response.ok) {
    const message = typeof data?.error === "string"
      ? data.error
      : "A Twilio não conseguiu processar a validação deste número."
    throw new SdDialerError(message, response.status)
  }
  return data
}

export async function findTwilioOutgoingCallerId(phoneNumber: string) {
  const data = await twilioCallerIdRequest("lookup", { phoneNumber })
  const callerId = data?.callerId
  return callerId?.sid
    ? { sid: String(callerId.sid), phone_number: String(callerId.phone_number || phoneNumber) }
    : null
}

export async function startTwilioCallerIdVerification(phoneNumber: string, friendlyName: string) {
  const data = await twilioCallerIdRequest("verify", { phoneNumber, friendlyName })
  return {
    validationCode: String(data?.validationCode || ""),
    callSid: String(data?.callSid || ""),
    phoneNumber: String(data?.phoneNumber || phoneNumber),
  }
}

export function normalizePtPhone(input: unknown): string {
  const raw = String(input || '').trim()
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  if (raw.startsWith('00')) return digits.length > 2 ? '+' + digits.slice(2) : ''
  if (digits.startsWith('351')) return '+' + digits
  if (digits.length === 9) return '+351' + digits
  if ((raw.startsWith('+') || digits.length >= 10) && digits.length <= 15 && digits[0] !== '0') {
    return '+' + digits
  }
  return ''
}

export function getLiveKitConfig() {
  const configuredUrl = process.env.LIVEKIT_URL
  const apiKey = process.env.LIVEKIT_API_KEY
  const secret = process.env.LIVEKIT_API_SECRET
  const trunkId = process.env.LUMIN_OUTBOUND_TRUNK_ID || process.env.LIVEKIT_OUTBOUND_TRUNK_ID

  if (!configuredUrl || !apiKey || !secret || !trunkId) {
    throw new SdDialerError('A ligação LiveKit ainda não está completa nas variáveis da Netlify.', 503)
  }

  const host = configuredUrl
    .replace(/^wss:/i, 'https:')
    .replace(/^ws:/i, 'http:')
    .replace(/\/+$/, '')

  return {
    api: new LiveKitAPI({ host, apiKey, secret, requestTimeout: 20 }),
    trunkId,
    agentName: process.env.LIVEKIT_AGENT_NAME || 'lumin-web',
  }
}

export async function resolveCallerId(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  companyId: string,
  allowSuperAdminLegacyCallerId = false,
) {
  const { data, error } = await admin
    .from('sd_dialer_caller_ids')
    .select('id,phone_number,verification_status,is_active,requested_at,verified_at')
    .eq('user_id', userId)
    .eq('company_id', companyId)
    .eq('verification_status', 'verified')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new SdDialerError('Não foi possível carregar o número de saída.', 500)
  if (!data?.phone_number) {
    const legacyCallerId = allowSuperAdminLegacyCallerId
      ? normalizePtPhone(process.env.LUMIN_CALLER_ID || '')
      : ''
    if (legacyCallerId) {
      return {
        id: 'superadmin-legacy-caller-id',
        phoneNumber: legacyCallerId,
        usingPersonalNumber: false,
      }
    }
    throw new SdDialerError('Valida o teu número pessoal antes de iniciar chamadas de IA.', 409)
  }
  return {
    id: String(data.id),
    phoneNumber: String(data.phone_number).trim(),
    usingPersonalNumber: true,
  }
}

export function buildAgentProfile(agentId: string, companyName: string, overrides: Record<string, unknown> = {}) {
  const company = agentId === 'lumin-telecom' ? 'Compara+' : (companyName || 'Lumin')
  const profiles: Record<string, Record<string, string>> = {
    'lumin-telecom': {
      id: 'lumin-telecom',
      name: 'Lumin',
      description: 'Assistente virtual da Compara+ para chamadas breves sobre serviços residenciais de internet e televisão.',
      objective: 'Perceber a necessidade principal e, quando houver interesse, marcar um contacto com um consultor da Compara+ para comparar opções.',
      opening: 'Boa tarde, [nome]. Sou o Lumin, assistente virtual da Compara+. Posso fazer-lhe uma pergunta rápida sobre o serviço de internet e televisão de casa?',
      product: 'A Compara+ ajuda a comparar opções residenciais de internet e televisão. Não inventes preços, cobertura, poupanças, condições ou resultados. Usa a necessidade descrita pela pessoa para propor, se fizer sentido, uma conversa com um consultor.',
      offer: 'Se a pessoa revelar uma necessidade ou interesse, oferece um contacto sem compromisso com um consultor da Compara+ para comparar opções. Pergunta o melhor dia e hora. Nunca prometas uma poupança, preço, cobertura ou mudança de operador.',
      objections: 'RECUSA: agradece e termina sem insistir. PESSOA SATISFEITA: reconhece e oferece uma comparação sem compromisso uma única vez; se não quiser, termina. PREÇO OU COBERTURA: explica brevemente que o consultor pode confirmar as opções para o caso concreto; não inventes. PEDIDO PARA NÃO VOLTAR A CONTACTAR: confirma brevemente e termina.',
      notes: 'CONVERSA: Usa apenas o nome recebido da lead ou do campo manual. A abertura já é dita; não a repitas. Se a pessoa aceitar conversar, pergunta o que gostaria de melhorar no serviço atual. Ouve e reconhece a resposta em poucas palavras; faz apenas a pergunta seguinte necessária, sem transformar a chamada num questionário. Não peças dados de conta, morada completa, email ou dados de pagamento. Se a pessoa disser operadora, mensalidade, fidelização ou problema, aproveita a informação e não voltes a perguntar. Relaciona a necessidade com uma comparação da Compara+, sem prometer preço, poupança, cobertura, mudança ou resultado. Se houver interesse, oferece contacto com consultor sem compromisso e pergunta dia e hora. Se ambos forem indicados, chama schedule_follow_up uma vez, com Europe/Lisbon; se faltar um, pergunta só pelo dado em falta. Só confirmes a marcação se a ferramenta indicar sucesso. Se não houver interesse, agradece e termina. Respeita de imediato um pedido para não voltar a contactar. Usa frases curtas e português de Portugal.',
      tone: 'Português de Portugal, natural, próximo e profissional. Uma pergunta de cada vez, sem pressão, sem monólogo e sem tom de questionário.',
    },
    'lumin-energia': {
      id: 'lumin-energia',
      name: 'Lumin',
      description: 'Assistente virtual de energia da Lumin.',
      objective: 'Compreender a necessidade de energia e, havendo interesse, marcar um contacto com um consultor.',
      opening: 'Olá, [nome]. Sou o Lumin, assistente virtual. O que gostaria de melhorar na sua fatura de energia?',
      product: 'Ajuda a pessoa a explorar opções de energia com um consultor. Não inventes preços, poupanças, cobertura ou condições.',
      offer: 'Se a pessoa mostrar interesse, propõe um contacto com um consultor e pergunta o melhor dia e hora.',
      objections: 'Respeita uma recusa clara e termina sem insistir. Se pedir para não voltar a ser contactada, confirma brevemente e termina.',
      notes: 'Usa apenas o nome fornecido pela lead. Não perguntes dados já respondidos. Faz uma pergunta de cada vez. Se a pessoa aceitar um contacto e indicar dia e hora, agenda com schedule_follow_up uma única vez, usando Europe/Lisbon. Só confirmes a marcação se a ferramenta devolver sucesso.',
      tone: 'Português de Portugal, próximo, claro e profissional. Frases curtas e uma pergunta de cada vez.',
    },
    'lumin-ai': {
      id: 'lumin-ai',
      name: 'Lumin',
      description: 'Assistente virtual comercial da Lumin AI.',
      objective: 'Perceber as necessidades de atendimento e, havendo interesse, marcar uma demonstração com a equipa.',
      opening: 'Olá, [nome]. Sou o Lumin, assistente virtual da Lumin AI. Como tratam atualmente as chamadas dos vossos clientes?',
      product: 'A Lumin AI ajuda empresas a automatizar conversas por voz. Não prometas resultados, preços ou integrações que não estejam confirmados.',
      offer: 'Se existir interesse, propõe uma demonstração com a equipa e pergunta o melhor dia e hora.',
      objections: 'Respeita uma recusa clara e termina sem insistir. Se pedirem para não voltar a contactar, confirma brevemente e termina.',
      notes: 'Usa apenas o nome fornecido pela lead. Não inventes funcionalidades nem resultados. Faz uma pergunta de cada vez. Se aceitarem uma demonstração e indicarem dia e hora, agenda com schedule_follow_up uma única vez, usando Europe/Lisbon. Só confirmes a marcação se a ferramenta devolver sucesso.',
      tone: 'Português de Portugal, próximo, profissional e direto. Frases curtas e uma pergunta de cada vez.',
    },
  }

  const selected = profiles[agentId] || profiles['lumin-telecom']
  const safeOverrides: Record<string, string> = {}
  for (const key of ['name', 'description', 'objective', 'opening', 'product', 'offer', 'objections', 'notes', 'tone', 'voice', 'voiceEngine', 'voiceSource']) {
    const value = overrides[key]
    if (typeof value === 'string') safeOverrides[key] = value.slice(0, key === 'notes' ? 12000 : 3000)
  }
  // Compatibility for the saved legacy Energy script, which repeats the introduction
  // already spoken by the call flow and jumps to scheduling before understanding the need.
  if (
    agentId === 'lumin-energia' &&
    safeOverrides.opening === 'Boa tarde, [nome]. Sou o Lumin, assistente virtual da Compara+. Posso fazer-lhe uma pergunta rápida sobre a energia da sua empresa?'
  ) {
    safeOverrides.opening = 'O que gostaria de melhorar na energia da sua empresa?'
    safeOverrides.objective = 'Compreender primeiro a necessidade de energia da empresa. Se houver uma necessidade concreta e interesse explícito, apresentar a possibilidade de comparar soluções Compara+ EDP Empresarial e solar; só marcar contacto depois de a pessoa aceitar e indicar dia e hora.'
    safeOverrides.notes = 'A apresentação inicial já foi dita pelo fluxo da chamada; não cumprimentes novamente nem repitas o teu nome, a Lumin ou a Compara+. Continua diretamente com uma pergunta sobre o que a pessoa gostaria de melhorar na energia da empresa. Uma resposta como “sim, posso” autoriza apenas a pergunta seguinte e não significa interesse numa marcação. Faz uma pergunta de cada vez e ouve a resposta antes de avançar; não saltes para a agenda. Só quando compreenderes uma necessidade concreta e a pessoa mostrar interesse explícito em explorar soluções Compara+ EDP Empresarial ou solar, oferece contacto com um consultor. Agenda apenas após a pessoa aceitar e indicar dia e hora; se faltar um deles, pergunta só pelo que falta. Usa schedule_follow_up uma vez, com Europe/Lisbon, e confirma apenas se a ferramenta indicar sucesso. Se a resposta parecer repetida ou não fizer sentido, pede para repetir uma vez; não inventes nem confirmes dados. Respeita recusas e pedidos para não voltar a contactar. Usa frases curtas e português de Portugal.'
  }
  const scriptVersion = Number(overrides.scriptVersion)
  return {
    ...selected,
    company,
    voice: 'clear',
    voiceEngine: 'xai',
    voiceSource: 'system',
    scriptVersion: Number.isFinite(scriptVersion) && scriptVersion > 0 ? Math.min(scriptVersion, 9999) : (agentId === 'lumin-telecom' ? 8 : 1),
    followUpEnabled: overrides.followUpEnabled === false ? false : true,
    ...safeOverrides,
  }
}
