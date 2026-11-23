import { NextRequest, NextResponse } from 'next/server'
import { errorResponse, requireSdDialerUser, SdDialerError } from '@/lib/server/sd-dialer-livekit'
import { MODULO_IDS } from '@/lib/formacao-conteudo'

// Progresso da formação de cada utilizador (módulos com quiz passado).
// Guardado no app_metadata do utilizador (sem tabelas novas).

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Progresso = Record<string, string> // moduloId -> data em que passou

export async function GET(request: NextRequest) {
  try {
    const { admin, user } = await requireSdDialerUser(request)
    const { data } = await admin.auth.admin.getUserById(user.id)
    return NextResponse.json({ progresso: ((data?.user?.app_metadata as any)?.formacao || {}) as Progresso })
  } catch (err) {
    return errorResponse(err, 'formacao')
  }
}

export async function POST(request: NextRequest) {
  try {
    const { admin, user } = await requireSdDialerUser(request)
    const body = await request.json().catch(() => ({}))
    const modulo = String(body?.modulo || '')
    if (!MODULO_IDS.includes(modulo)) throw new SdDialerError('Módulo desconhecido.', 400)
    const { data } = await admin.auth.admin.getUserById(user.id)
    const meta = (data?.user?.app_metadata || {}) as any
    const progresso: Progresso = { ...(meta.formacao || {}) }
    if (!progresso[modulo]) progresso[modulo] = new Date().toISOString()
    await admin.auth.admin.updateUserById(user.id, { app_metadata: { ...meta, formacao: progresso } })
    return NextResponse.json({ progresso })
  } catch (err) {
    return errorResponse(err, 'formacao')
  }
}
