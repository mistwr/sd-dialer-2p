import { createHash, randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { AccessToken } from 'livekit-server-sdk'
import { buildAgentProfile, createAdminClient, getLiveKitConfig } from '@/lib/server/sd-dialer-livekit'

// Demonstração pública de voz do luminai.pt: o visitante fala no browser com o agente validado no LiveKit Cloud.
// Sem chamadas telefónicas. Limites: 3 sessões/10 min por IP e 40/hora no total.

export const runtime = 'nodejs'
export const maxDuration = 30

const ALLOWED = new Set(['https://luminai.pt', 'https://www.luminai.pt', 'https://heartfelt-cupcake-12d08b.netlify.app'])
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) : '')

function cors(origin: string): Record<string, string> {
  return ALLOWED.has(origin)
    ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600', Vary: 'Origin' }
    : {}
}
function reply(origin: string, body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { ...cors(origin), 'Cache-Control': 'no-store' } })
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin') || ''
  return new NextResponse(null, { status: ALLOWED.has(origin) ? 204 : 403, headers: cors(origin) })
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin') || ''
  if (!ALLOWED.has(origin)) return reply(origin, { error: 'Origem não permitida.' }, 403)
  try {
    const raw = await request.text()
    if (raw.length > 4000) return reply(origin, { error: 'Configuração demasiado longa.' }, 413)
    const body = JSON.parse(raw || '{}') as { agent?: Record<string, unknown> }
    const a = body.agent || {}

    const ip = (request.headers.get('x-nf-client-connection-ip') || request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'desconhecido'
    const ipHash = createHash('sha256').update(ip + '|lumin-voz').digest('hex').slice(0, 32)
    const admin = createAdminClient()
    const since10 = new Date(Date.now() - 10 * 60_000).toISOString()
    const since60 = new Date(Date.now() - 60 * 60_000).toISOString()
    const [{ count: mine }, { count: all }] = await Promise.all([
      admin.from('voice_demo_sessions').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', since10),
      admin.from('voice_demo_sessions').select('id', { count: 'exact', head: true }).gte('created_at', since60),
    ])
    if ((mine || 0) >= 3) return reply(origin, { error: 'Fizeste vários testes seguidos. Espera uns minutos e tenta outra vez.' }, 429)
    if ((all || 0) >= 40) return reply(origin, { error: 'Muitas pessoas a testar agora. Tenta daqui a pouco ou pede uma demonstração.' }, 429)

    const name = clean(a.name, 48) || 'Lumin'
    const company = clean(a.company, 64) || 'LUMIN AI'
    const voice = ['natural', 'clear', 'commercial'].includes(String(a.voice)) ? String(a.voice) : 'natural'
    const agentProfile = buildAgentProfile('lumin-ai', company, {
      name,
      description: clean(a.objective, 180) || 'Assistente virtual de demonstração.',
      objective: clean(a.objective, 180) || 'Conversar, esclarecer dúvidas e mostrar como um agente de voz ajuda a empresa.',
      product: clean(a.product, 500),
      opening: clean(a.opening, 180) || `Olá! Sou o ${name}, assistente virtual da ${company}. Como posso ajudar?`,
      notes: 'Demonstração pública no browser: não há chamada telefónica, CRM nem agendamento real. Não digas que marcaste ou registaste nada. Respostas curtas, uma pergunta de cada vez. Não peças dados pessoais sensíveis.',
      tone: voice === 'commercial' ? 'Comercial, enérgico e cordial' : voice === 'clear' ? 'Claro, calmo e objetivo' : 'Natural, profissional e direto',
      voice,
    })

    const { api } = getLiveKitConfig()
    const serverUrl = String(process.env.LIVEKIT_URL || '').replace(/^https:/i, 'wss:')
    const roomName = `demo-${randomUUID()}`
    const identity = `visitante-${randomUUID().slice(0, 8)}`
    const agentName = process.env.LIVEKIT_DEMO_AGENT_NAME || process.env.LIVEKIT_PRIMARY_AGENT_NAME || process.env.LIVEKIT_TELECOM_AGENT_NAME || 'lumin-compara-lab'

    await api.room.createRoom({ name: roomName, emptyTimeout: 60, departureTimeout: 10, maxParticipants: 3 })
    await api.agentDispatch.createDispatch(roomName, agentName, {
      metadata: JSON.stringify({ agentProfile, name: '', source: 'web-demo', mode: 'web' }),
    })
    await admin.from('voice_demo_sessions').insert({ ip_hash: ipHash, room: roomName, origin })

    const at = new AccessToken(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!, { identity, name: 'Visitante', ttl: '5m' })
    at.addGrant({ room: roomName, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true })
    return reply(origin, { serverUrl, token: await at.toJwt(), roomName, maxDurationSeconds: 180 })
  } catch (error) {
    console.error('[voz-demo]', error instanceof Error ? error.message : error)
    return reply(origin, { error: 'O agente de voz não ficou disponível. Tenta daqui a um minuto.' }, 503)
  }
}
