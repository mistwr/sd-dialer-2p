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
    .select('id,company_id,role,status,full_name,restricted_admin')
    .eq('id', data.user.id)
    .maybeSingle()

  if (profileError) throw new SdDialerError('Não foi possível validar o perfil do SD Dialer.', 500)
  if (!profile?.company_id || profile.status !== 'active' || !ALLOWED_ROLES.has(String(profile.role))) {
    throw new SdDialerError('O teu utilizador não tem acesso às chamadas de IA.', 403)
  }

  return { admin, user: data.user, profile, accessToken }
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
  const callerId = process.env.LUMIN_CALLER_ID

  if (!configuredUrl || !apiKey || !secret || !trunkId || !callerId) {
    throw new SdDialerError('A ligação LiveKit ainda não está completa nas variáveis da Netlify.', 503)
  }

  const host = configuredUrl
    .replace(/^wss:/i, 'https:')
    .replace(/^ws:/i, 'http:')
    .replace(/\/+$/, '')

  return {
    api: new LiveKitAPI({ host, apiKey, secret, requestTimeout: 20 }),
    trunkId,
    callerId,
    agentName: process.env.LIVEKIT_AGENT_NAME || 'lumin-web',
  }
}

export async function resolveCallerId(admin: ReturnType<typeof createAdminClient>, userId: string, companyId: string) {
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
  const personalNumber = String(data?.phone_number || '').trim()
  const companyNumber = String(process.env.LUMIN_CALLER_ID || '').trim()
  return {
    phoneNumber: companyNumber || personalNumber,
    usingPersonalNumber: !companyNumber && Boolean(personalNumber),
  }
}

export function buildAgentProfile(agentId: string, companyName: string) {
  const company = companyName || 'Lumin'
  const profiles: Record<string, Record<string, string>> = {
    'lumin-telecom': {
      id: 'lumin-telecom',
      name: 'Lumin',
      description: 'Assistente virtual de telecomunicações da Compara+.',
      objective: 'Perceber a necessidade principal e, havendo interesse, agendar um contacto com um consultor para comparar opções de internet e televisão.',
      opening: 'Boa tarde, [nome]. Sou o Lumin, assistente virtual da Compara+. O que gostava de melhorar na sua internet?',
      product: 'A Compara+ compara opções residenciais de internet e televisão. Não inventes preços, cobertura, poupanças ou condições. Ouve a necessidade concreta e oferece uma comparação com um consultor, sem compromisso.',
      offer: 'Quando a pessoa mostrar uma necessidade ou interesse, oferece um contacto com um consultor para comparar opções. Não prometas poupança, preço, cobertura ou mudança de operador.',
      objections: 'Recusa clara: agradece e termina sem insistir. Se a pessoa estiver satisfeita, oferece uma comparação sem compromisso uma única vez. Se pedir para não voltar a ser contactada, confirma brevemente e termina.',
      notes: 'Usa apenas o nome fornecido pela lead. Não perguntes dados já respondidos. Começa por perguntar o que gostaria de melhorar na internet. Se houver interesse, oferece um contacto com consultor e pergunta o melhor dia e hora. Se aceitar e indicar dia e hora, agenda com schedule_follow_up uma única vez, usando Europe/Lisbon. Só confirmes a marcação se a ferramenta devolver sucesso. Se não houver interesse, agradece e termina.',
      tone: 'Português de Portugal, próximo, natural e direto. Frases curtas, uma pergunta de cada vez, sem tom de questionário ou insistência.',
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
  return {
    ...selected,
    company,
    voice: 'clear',
    voiceEngine: 'xai',
    voiceSource: 'system',
    scriptVersion: agentId === 'lumin-telecom' ? 7 : 1,
    followUpEnabled: true,
  }
}

[executed on device: LuminAI (a8ce5ed1-2d12-42b0-9a33-2bf4b649b392)]