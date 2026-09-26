import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type ChoiceQuestion = {
  type: 'choice'
  instructions?: unknown
  criteria: Record<string, unknown>
}

type ScoreQuestion = {
  type: 'score'
  instructions?: unknown
  criteria: unknown[]
}

type NoulQuestion = {
  type: 'noul'
  instructions?: unknown
  criteria?: Record<string, unknown>
}

type Question = ChoiceQuestion | ScoreQuestion | NoulQuestion

type DecisionRequest = {
  state: unknown
  model?: string
  questions: Record<string, Question>
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Supabase server credentials missing')
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function authenticate(req: NextRequest) {
  const jwt = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!jwt) return null
  const { data, error } = await adminClient().auth.getUser(jwt)
  if (error || !data.user) return null
  return data.user
}

function validateBody(body: unknown): DecisionRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Pedido invalido')
  }

  const raw = body as Record<string, unknown>
  const questions = raw.questions
  if (!questions || typeof questions !== 'object' || Array.isArray(questions)) {
    throw new Error('questions em falta')
  }

  const entries = Object.entries(questions as Record<string, unknown>)
  if (entries.length < 1 || entries.length > 12) {
    throw new Error('questions deve ter entre 1 e 12 entradas')
  }

  const normalized: Record<string, Question> = {}

  for (const [key, value] of entries) {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(key)) throw new Error('question id invalido')
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`question ${key} invalida`)
    const q = value as Record<string, unknown>
    if (q.type === 'choice') {
      if (!q.criteria || typeof q.criteria !== 'object' || Array.isArray(q.criteria)) {
        throw new Error(`criteria invalido em ${key}`)
      }
      const criteria = q.criteria as Record<string, unknown>
      const count = Object.keys(criteria).length
      if (count < 2 || count > 40) throw new Error(`choice ${key} deve ter 2-40 opcoes`)
      normalized[key] = { type: 'choice', instructions: q.instructions, criteria }
    } else if (q.type === 'score') {
      if (!Array.isArray(q.criteria) || q.criteria.length < 2 || q.criteria.length > 10) {
        throw new Error(`score ${key} deve ter 2-10 niveis`)
      }
      normalized[key] = { type: 'score', instructions: q.instructions, criteria: q.criteria }
    } else if (q.type === 'noul') {
      normalized[key] = {
        type: 'noul',
        instructions: q.instructions,
        criteria: q.criteria && typeof q.criteria === 'object' && !Array.isArray(q.criteria)
          ? q.criteria as Record<string, unknown>
          : undefined,
      }
    } else {
      throw new Error(`tipo desconhecido em ${key}`)
    }
  }

  const stateSize = JSON.stringify(raw.state ?? '').length
  if (stateSize > 45000) throw new Error('state demasiado grande')

  return {
    state: raw.state ?? '',
    model: typeof raw.model === 'string' ? raw.model.slice(0, 80) : undefined,
    questions: normalized,
  }
}

function normalizeKevUrl(raw: string) {
  const base = raw.replace(/\/$/, '')
  return base.endsWith('/v1/systemone') ? base : `${base}/v1/systemone`
}

async function callKev(payload: DecisionRequest) {
  const rawUrl = process.env.KEV_SYSTEM_ONE_URL
  if (!rawUrl) return null

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (process.env.KEV_API_KEY) headers.Authorization = `Bearer ${process.env.KEV_API_KEY}`

  const response = await fetch(normalizeKevUrl(rawUrl), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...payload,
      model: payload.model || process.env.KEV_MODEL || 'kev-latest',
    }),
    signal: AbortSignal.timeout(120000),
  })

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 1500)
    throw new Error(`Kev respondeu ${response.status}: ${detail}`)
  }

  return {
    provider: 'kev',
    calibrated: true,
    ...(await response.json()),
  }
}

async function callJev(payload: DecisionRequest) {
  const apiKey = process.env.JEV_API_KEY
  if (!apiKey) return null

  const endpoint = process.env.JEV_DECIDE_URL || 'https://jevtypesafeai.com/api/v1/decide'
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      ...payload,
      model: payload.model || process.env.JEV_MODEL || 'jev-latest',
    }),
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 1500)
    throw new Error(`Jev respondeu ${response.status}: ${detail}`)
  }

  return {
    provider: 'jev',
    calibrated: true,
    ...(await response.json()),
  }
}

function jsonFromText(text: string) {
  const cleaned = text.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim()
  try { return JSON.parse(cleaned) } catch {}
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1))
  throw new Error('Resposta da IA nao contem JSON valido')
}

function fallbackPrompt(payload: DecisionRequest) {
  const contract = Object.fromEntries(
    Object.entries(payload.questions).map(([id, q]) => {
      if (q.type === 'choice') {
        return [id, {
          type: 'choice',
          allowed: Object.keys(q.criteria),
          return: { choice: 'one allowed key', probabilities: 'object keyed by allowed values, numbers 0..1', confidence: '0..1' },
        }]
      }
      if (q.type === 'score') {
        return [id, {
          type: 'score',
          levels: q.criteria,
          return: { score: `number 0..${q.criteria.length - 1}`, probabilities: 'object keyed by level index', confidence: '0..1' },
        }]
      }
      return [id, {
        type: 'noul',
        return: { noul: 'probability 0..1' },
      }]
    })
  )

  return [
    'You are a typed decision engine. Return ONLY strict JSON.',
    'Do not add prose or markdown.',
    'Each decision must use only the supplied state and its own question.',
    'Probability values must be between 0 and 1.',
    'For choice, choice must be one of the allowed keys.',
    '',
    'STATE:',
    JSON.stringify(payload.state),
    '',
    'QUESTIONS:',
    JSON.stringify(payload.questions),
    '',
    'REQUIRED OUTPUT CONTRACT:',
    JSON.stringify({ answers: contract }),
  ].join('\n')
}

function clamp01(value: unknown) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

function normalizeCompatAnswers(payload: DecisionRequest, raw: any) {
  const source = raw?.answers && typeof raw.answers === 'object' ? raw.answers : raw
  const answers: Record<string, unknown> = {}

  for (const [id, q] of Object.entries(payload.questions)) {
    const candidate = source?.[id] ?? {}

    if (q.type === 'choice') {
      const keys = Object.keys(q.criteria)
      const proposed = String(candidate?.choice ?? '')
      const choice = keys.includes(proposed) ? proposed : keys[0]
      const incoming = candidate?.probabilities && typeof candidate.probabilities === 'object'
        ? candidate.probabilities
        : {}
      const probabilities: Record<string, number> = {}
      let total = 0
      for (const key of keys) {
        const p = clamp01(incoming[key])
        probabilities[key] = p
        total += p
      }
      if (total <= 0) {
        for (const key of keys) probabilities[key] = key === choice ? 1 : 0
      } else {
        for (const key of keys) probabilities[key] = probabilities[key] / total
      }
      answers[id] = {
        type: 'choice',
        choice,
        probabilities,
        confidence: clamp01(candidate?.confidence ?? Math.max(...Object.values(probabilities))),
      }
    } else if (q.type === 'score') {
      const max = q.criteria.length - 1
      const score = Math.max(0, Math.min(max, Number(candidate?.score ?? 0)))
      const probabilities: Record<string, number> = {}
      for (let i = 0; i <= max; i += 1) probabilities[String(i)] = i === Math.round(score) ? 1 : 0
      answers[id] = {
        type: 'score',
        score,
        probabilities,
        legend: Object.fromEntries(q.criteria.map((v, i) => [String(i), String(v)])),
        confidence: clamp01(candidate?.confidence ?? 0.5),
      }
    } else {
      answers[id] = {
        type: 'noul',
        noul: clamp01(candidate?.noul ?? candidate?.probability ?? 0.5),
      }
    }
  }

  return answers
}

async function callGroqCompat(payload: DecisionRequest) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('Nenhum motor de decisao configurado')

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.LUMIN_DECISION_FALLBACK_MODEL || 'openai/gpt-oss-120b',
      messages: [{ role: 'user', content: fallbackPrompt(payload) }],
      temperature: 0,
      max_tokens: 1800,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 1500)
    throw new Error(`Groq respondeu ${response.status}: ${detail}`)
  }

  const data = await response.json()
  const text = data?.choices?.[0]?.message?.content ?? '{}'
  const parsed = jsonFromText(text)

  return {
    provider: 'groq-compat',
    calibrated: false,
    model: data?.model || process.env.LUMIN_DECISION_FALLBACK_MODEL || 'openai/gpt-oss-120b',
    answers: normalizeCompatAnswers(payload, parsed),
    usage: data?.usage ?? null,
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await authenticate(req)
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })

    const raw = await req.json()
    if (JSON.stringify(raw).length > 65000) {
      return NextResponse.json({ error: 'Pedido demasiado grande' }, { status: 413 })
    }

    const payload = validateBody(raw)

    const kev = await callKev(payload)
    if (kev) return NextResponse.json(kev)

    const jev = await callJev(payload)
    if (jev) return NextResponse.json(jev)

    return NextResponse.json(await callGroqCompat(payload))
  } catch (error: any) {
    console.error('[LUMIN decision]', error)
    return NextResponse.json(
      { error: error?.message ?? 'Erro no motor de decisao' },
      { status: 500 }
    )
  }
}
