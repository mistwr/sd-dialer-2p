import { NextRequest, NextResponse } from 'next/server'
import { errorResponse, requireSdDialerSuperAdmin, SdDialerError } from '@/lib/server/sd-dialer-livekit'
import { responderIA } from '@/lib/server/ia-central'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Assistente de análise do robot. Só leitura: recebe números agregados já calculados
// (sem nomes nem telefones de clientes) e explica-os. Não escreve na base de dados.
export async function POST(request: NextRequest) {
  try {
    const { admin } = await requireSdDialerSuperAdmin(request)
    if (!process.env.GROQ_API_KEY) throw new SdDialerError('GROQ_API_KEY em falta na Netlify.', 503)

    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const question = String(body.question || '').trim().slice(0, 1500)
    if (!question) throw new SdDialerError('Escreve uma pergunta.', 400)
    const days = Math.max(1, Math.min(90, Number(body.days) || 14))
    const companyId = String(body.companyId || '')
    const history = Array.isArray(body.history)
      ? (body.history as any[]).slice(-6).filter(m => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string').map(m => ({ role: m.role, content: String(m.content).slice(0, 2000) }))
      : []

    let nome = 'a empresa'
    if (companyId) { const { data: c } = await admin.from('companies').select('name').eq('id', companyId).maybeSingle(); if (c?.name) nome = c.name }
    const out = await responderIA({ db: admin, companyId, companyName: nome, quem: 'o super admin', role: 'super_admin', question, history, days })
    return NextResponse.json({ reply: out.reply })
  } catch (error) {
    return errorResponse(error, 'admin voice calls assistant POST')
  }
}
