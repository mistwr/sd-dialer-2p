import { NextRequest, NextResponse } from 'next/server'

function xmlEscape(value: string) {
  return value.replace(/[<>&'\"]/g, ch => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[ch]!))
}

function xml(body: string) {
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>\n<Response>${body}</Response>`, {
    status: 200,
    headers: { 'Content-Type': 'text/xml; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

function conversationRelay(request: NextRequest) {
  const wsUrl = process.env.REBORN_VOICE_WS_URL
  if (!wsUrl || !wsUrl.startsWith('wss://')) return null

  const leadId = request.nextUrl.searchParams.get('lead_id') || ''
  const language = process.env.TWILIO_CONVERSATION_LANGUAGE || 'pt-PT'
  const greeting = process.env.REBORN_VOICE_GREETING || 'Olá. Sou o assistente Reborn. Em que posso ajudar?'

  const ws = new URL(wsUrl)
  if (leadId) ws.searchParams.set('lead_id', leadId)

  const attrs = [
    `url="${xmlEscape(ws.toString())}"`,
    `welcomeGreeting="${xmlEscape(greeting)}"`,
    `language="${xmlEscape(language)}"`,
    'interruptByDtmf="true"',
  ]

  if (process.env.TWILIO_TRANSCRIPTION_PROVIDER) {
    attrs.push(`transcriptionProvider="${xmlEscape(process.env.TWILIO_TRANSCRIPTION_PROVIDER)}"`)
  }
  if (process.env.TWILIO_SPEECH_MODEL) {
    attrs.push(`speechModel="${xmlEscape(process.env.TWILIO_SPEECH_MODEL)}"`)
  }
  if (process.env.TWILIO_TTS_VOICE) {
    attrs.push(`voice="${xmlEscape(process.env.TWILIO_TTS_VOICE)}"`)
  }

  return xml(`<Connect><ConversationRelay ${attrs.join(' ')} /></Connect>`)
}

function asteriskSip(request: NextRequest) {
  const host = process.env.ASTERISK_PUBLIC_HOST || process.env.REBORN_ASTERISK_SIP_HOST
  const user = process.env.REBORN_ASTERISK_SIP_USER || 'reborn'
  if (!host) return null

  const leadId = request.nextUrl.searchParams.get('lead_id') || ''
  const sipUri = `sip:${user}@${host}${leadId ? `?x-reborn-lead=${encodeURIComponent(leadId)}` : ''}`
  const username = process.env.REBORN_ASTERISK_SIP_USERNAME
  const password = process.env.REBORN_ASTERISK_SIP_PASSWORD
  const authAttrs = username && password
    ? ` username="${xmlEscape(username)}" password="${xmlEscape(password)}"`
    : ''

  return xml(`<Dial answerOnBridge="true" timeout="25"><Sip${authAttrs}>${xmlEscape(sipUri)}</Sip></Dial>`)
}

export async function POST(request: NextRequest) {
  const mode = (process.env.REBORN_TWIML_MODE || 'auto').toLowerCase()

  if (mode === 'conversation-relay' || mode === 'twilio-ai') {
    return conversationRelay(request) ?? xml('<Say language="pt-PT">Serviço de voz IA temporariamente indisponível.</Say><Hangup/>')
  }

  if (mode === 'asterisk') {
    return asteriskSip(request) ?? xml('<Say language="pt-PT">Serviço temporariamente indisponível.</Say><Hangup/>')
  }

  // AUTO: prefer the native Twilio AI bridge when a secure WSS endpoint is configured;
  // otherwise preserve the existing Asterisk/SIP route.
  return conversationRelay(request)
    ?? asteriskSip(request)
    ?? xml('<Say language="pt-PT">Serviço temporariamente indisponível.</Say><Hangup/>')
}

export const GET = POST
