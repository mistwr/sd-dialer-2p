import { NextRequest, NextResponse } from 'next/server'
import { AI_CONFIG } from '@/lib/ai/config'

export const maxDuration = 60

function authorize(req: NextRequest): boolean {
  const expected = process.env.REBORN_AGENT_KEY
  if (!expected) return process.env.NODE_ENV !== 'production'
  return (req.headers.get('authorization') ?? '') === `Bearer ${expected}`
}

async function transcribeOpenAICompatible(file: File) {
  const cfg = AI_CONFIG.transcription
  const endpoint = cfg.endpoint && !cfg.endpoint.includes('localhost')
    ? cfg.endpoint.replace(/\/$/, '')
    : 'https://api.openai.com'

  const form = new FormData()
  form.append('file', file, file.name || 'reborn-audio.webm')
  form.append('model', cfg.model === 'base' ? 'whisper-1' : cfg.model)
  form.append('language', cfg.language || 'pt')

  const res = await fetch(`${endpoint}/v1/audio/transcriptions`, {
    method: 'POST',
    headers: cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {},
    body: form,
  })

  if (!res.ok) throw new Error(`STT error ${res.status}: ${await res.text()}`)
  const json = await res.json()
  return String(json?.text ?? '').trim()
}

async function transcribeGeneric(file: File) {
  const cfg = AI_CONFIG.transcription
  const form = new FormData()
  form.append('file', file, file.name || 'reborn-audio.webm')
  form.append('language', cfg.language || 'pt')
  form.append('model', cfg.model || 'base')

  const res = await fetch(cfg.endpoint, {
    method: 'POST',
    headers: cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {},
    body: form,
  })

  if (!res.ok) throw new Error(`STT error ${res.status}: ${await res.text()}`)
  const json = await res.json()
  return String(json?.text ?? json?.transcript ?? '').trim()
}

export async function POST(req: NextRequest) {
  try {
    if (!authorize(req)) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })

    const data = await req.formData()
    const audio = data.get('audio')
    if (!(audio instanceof File)) {
      return NextResponse.json({ error: 'audio ausente' }, { status: 400 })
    }

    const engine = AI_CONFIG.transcription.engine
    if (!engine || engine === 'mock') {
      return NextResponse.json({
        text: '',
        engine: 'mock',
        warning: 'Configura AI_TRANSCRIPTION_ENGINE e a respetiva API para transcricao real.',
      })
    }

    const text = engine === 'openai'
      ? await transcribeOpenAICompatible(audio)
      : await transcribeGeneric(audio)

    return NextResponse.json({ text, engine })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno'
    console.error('[reborn-transcribe]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
