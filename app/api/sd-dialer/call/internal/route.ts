import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, errorResponse, SdDialerError } from '@/lib/server/sd-dialer-livekit'
import { reconcileCall, startOutboundCall } from '@/lib/server/sd-dialer-call'

// Chamadas de IA iniciadas pelo LUMIN Comando (servidor a servidor).
// Protegido por COMANDO_CALL_SECRET; age como o super-admin COMANDO_CALL_USER_ID e só liga a leads existentes.

export const runtime = 'nodejs'
export const maxDuration = 60

const DEFAULT_USER = '8c43ee2a-9c99-4493-a215-abcb0849b8bf'

const SD_DIALER_PITCH: Record<string, string> = {
  description: 'Assistente virtual do SD Dialer, um CRM e marcador para equipas comerciais portuguesas (telecom e energia).',
  objective: 'Perceber se a empresa tem uma equipa comercial a ligar a leads e, havendo interesse, marcar uma demonstração de 15 minutos com o Miguel.',
  opening: 'Olá, [nome]. Sou o Lumin, assistente virtual do SD Dialer. Falo com quem gere a equipa comercial? É uma pergunta rápida.',
  product: 'O SD Dialer organiza leads, distribui-as pela equipa, liga a partir do telemóvel de cada comercial (sem VoIP nem centrais), regista resultados e follow-ups e dá relatórios ao supervisor. Custa 70€ por mês por administrador mais 10€ por comercial, com 14 dias grátis. Usado por equipas de telecomunicações e energia em Portugal. Não inventes outros preços, integrações ou resultados.',
  offer: 'Se houver interesse, propõe uma demonstração de 15 minutos com o Miguel e pergunta o melhor dia e hora.',
  objections: 'JÁ TEMOS CRM: pergunta o que mais lhes custa hoje (tempo entre chamadas, leads esquecidas, controlo da equipa) e oferece a demonstração uma vez. SEM TEMPO: propõe outro dia e hora. ENVIE EMAIL: diz que o Miguel envia a informação e pergunta se pode marcar 15 minutos na mesma. RECUSA ou PEDIDO PARA NÃO CONTACTAR: agradece e termina de imediato.',
  notes: 'A abertura já é dita; não a repitas. Se não for a pessoa certa, pergunta com quem falar e o melhor horário, agradece e termina. Pergunta quantos comerciais têm e como trabalham as leads hoje; uma pergunta de cada vez. Se aceitarem demonstração e indicarem dia e hora, chama schedule_follow_up uma vez, com Europe/Lisbon; só confirmes se a ferramenta indicar sucesso. Frases curtas, português de Portugal, sem pressão.',
  tone: 'Português de Portugal, profissional, próximo e direto. Uma pergunta de cada vez.',
}

function secretOk(given: string | null) {
  const expected = process.env.COMANDO_CALL_SECRET || ''
  if (!expected || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: NextRequest) {
  try {
    if (!secretOk(request.headers.get('x-comando-secret'))) throw new SdDialerError('Não autorizado.', 401)
    const body = await request.json().catch(() => ({})) as { lead_id?: string; agent_id?: string; pitch?: string }
    if (!body.lead_id) throw new SdDialerError('Indica a lead a contactar.', 400)

    const admin = createAdminClient()
    const userId = process.env.COMANDO_CALL_USER_ID || DEFAULT_USER
    const { data: profile } = await admin
      .from('usuarios')
      .select('id,company_id,role,status,is_super_admin')
      .eq('id', userId)
      .maybeSingle()
    if (!profile?.company_id || profile.status !== 'active' || (profile.is_super_admin !== true && profile.role !== 'super_admin')) {
      throw new SdDialerError('Utilizador do Comando sem permissões de super-admin.', 403)
    }

    const pitch = body.pitch === 'sd-dialer' || !body.pitch
    const result = await startOutboundCall(
      admin,
      userId,
      profile,
      { lead_id: body.lead_id, agent_id: body.agent_id || 'lumin-ai' },
      pitch ? { profileOverrides: SD_DIALER_PITCH } : {},
    )
    return NextResponse.json(result)
  } catch (error) {
    return errorResponse(error, 'internal call POST')
  }
}

// Estado de uma chamada iniciada pelo Comando (para mostrar "a tocar / em chamada / terminou").
export async function GET(request: NextRequest) {
  try {
    if (!secretOk(request.headers.get('x-comando-secret'))) throw new SdDialerError('Não autorizado.', 401)
    const callId = request.nextUrl.searchParams.get('callId') || ''
    if (!/^[0-9a-f-]{36}$/i.test(callId)) throw new SdDialerError('Identificador inválido.', 400)
    const admin = createAdminClient()
    const { data: call } = await admin
      .from('voice_calls')
      .select('id,status,livekit_room,started_at,created_at,ended_at,duration_seconds,error_message,summary,interest_level,next_action')
      .eq('id', callId)
      .maybeSingle()
    if (!call) throw new SdDialerError('Chamada não encontrada.', 404)
    let status = await reconcileCall(admin, call).catch(() => String(call.status || ''))
    const began = new Date(call.started_at || call.created_at).getTime()
    if ((status === 'ringing' || status === 'dialing') && Date.now() - began > 95_000) {
      await admin.from('voice_calls').update({ status: 'failed', error_message: 'A chamada não foi atendida ou expirou.', ended_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', call.id)
      status = 'failed'
    }
    const { data: fresh } = await admin.from('voice_calls').select('status,duration_seconds,error_message,summary,interest_level,next_action').eq('id', callId).maybeSingle()
    return NextResponse.json({ callId, ...(fresh || {}), status })
  } catch (error) {
    return errorResponse(error, 'internal call GET')
  }
}
