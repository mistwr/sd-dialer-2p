import { NextRequest, NextResponse } from 'next/server'
import { errorResponse, requireSdDialerSuperAdmin, SdDialerError } from '@/lib/server/sd-dialer-livekit'
import { computeVoiceAnalytics } from '@/lib/server/voice-analytics'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Assistente de análise do robot. Só leitura: recebe números agregados já calculados
// (sem nomes nem telefones de clientes) e explica-os. Não escreve na base de dados.
export async function POST(request: NextRequest) {
  try {
    const { admin } = await requireSdDialerSuperAdmin(request)
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) throw new SdDialerError('GROQ_API_KEY em falta na Netlify.', 503)

    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const question = String(body.question || '').trim().slice(0, 1500)
    if (!question) throw new SdDialerError('Escreve uma pergunta.', 400)
    const days = Math.max(1, Math.min(90, Number(body.days) || 14))
    const companyId = String(body.companyId || '')
    const history = Array.isArray(body.history)
      ? (body.history as any[]).slice(-6).filter(m => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string').map(m => ({ role: m.role, content: String(m.content).slice(0, 2000) }))
      : []

    const analytics = await computeVoiceAnalytics(admin, days, companyId)

    const system = [
      'És o analista do robot de chamadas do SD Dialer. Respondes em português de Portugal, direto e curto, a um dono de negócio de telecomunicações.',
      'REGRAS: usa APENAS os números do contexto abaixo. Nunca inventes valores. Se o contexto não tiver o que precisas (por exemplo, dados por campanha ou por lead), diz isso claramente e sugere o que seria preciso.',
      'Os custos são estimativas (duração das chamadas × tarifa por minuto); a fatura real está na Twilio. Quando fizer sentido, termina com 1 ou 2 ações concretas.',
      'Nesta análise não tens nomes nem telefones de clientes, só totais.',
      `CONTEXTO (últimos ${days} dias):`,
      JSON.stringify(analytics),
    ].join('\n')

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [{ role: 'system', content: system }, ...history, { role: 'user', content: question }],
        temperature: 0.3,
        max_tokens: 900,
      }),
    })
    if (!response.ok) throw new SdDialerError('Não foi possível contactar o modelo de IA.', 502)
    const data = await response.json()
    return NextResponse.json({ reply: String(data.choices?.[0]?.message?.content || '').trim() })
  } catch (error) {
    return errorResponse(error, 'admin voice calls assistant POST')
  }
}
