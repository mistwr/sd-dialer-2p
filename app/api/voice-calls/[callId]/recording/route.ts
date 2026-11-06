import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { canViewVoiceSeller, type VoiceSeller } from '@/lib/utils/voice-leads'

// Devolve um link temporário (10 min) para ouvir a gravação de uma chamada de IA.
// O ficheiro está num bucket privado; só quem já pode ver a chamada recebe o link.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BUCKET = 'voice-recordings'

function getAdminClient() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function resolveUserId(req: NextRequest): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) return user.id
  const authHeader = req.headers.get('authorization') ?? ''
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!jwt) return null
  const { data } = await getAdminClient().auth.getUser(jwt)
  return data?.user?.id ?? null
}

export async function GET(req: NextRequest, context: { params: Promise<{ callId: string }> }) {
  try {
    const { callId } = await context.params
    if (!/^[0-9a-f-]{36}$/i.test(callId || '')) {
      return NextResponse.json({ error: 'Chamada invalida' }, { status: 400 })
    }

    const userId = await resolveUserId(req)
    if (!userId) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

    const admin = getAdminClient()
    const { data: me } = await admin
      .from('usuarios')
      .select('id, full_name, role, status, company_id, supervisor_id, created_by, restricted_admin, is_super_admin')
      .eq('id', userId)
      .maybeSingle()
    if (!me || me.status !== 'active' || !me.company_id) {
      return NextResponse.json({ error: 'Sem permissao' }, { status: 403 })
    }

    const { data: call } = await admin
      .from('voice_calls')
      .select('id, company_id, created_by, recording_url')
      .eq('id', callId)
      .maybeSingle()
    if (!call) return NextResponse.json({ error: 'Chamada nao encontrada' }, { status: 404 })

    const isSuperAdmin = Boolean(me.is_super_admin) || me.role === 'super_admin'
    if (!isSuperAdmin && call.company_id !== me.company_id) {
      return NextResponse.json({ error: 'Chamada nao encontrada' }, { status: 404 })
    }

    // Mesmas regras de visibilidade do historico de chamadas (/api/voice-calls).
    const canSeeCompany = isSuperAdmin || (me.role === 'admin' && !me.restricted_admin)
    if (!canSeeCompany && call.created_by !== userId) {
      const { data: owner } = await admin
        .from('usuarios')
        .select('id, full_name, role, status, company_id, supervisor_id, created_by, restricted_admin')
        .eq('id', call.created_by)
        .maybeSingle()
      const allowed = owner && (me.role === 'supervisor' || me.role === 'admin')
        && canViewVoiceSeller(me as VoiceSeller, owner as VoiceSeller)
      if (!allowed) return NextResponse.json({ error: 'Sem permissao para esta gravacao' }, { status: 403 })
    }

    const prefix = `${BUCKET}/`
    const path = String(call.recording_url || '')
    if (!path.startsWith(prefix)) {
      return NextResponse.json({ error: 'Esta chamada nao tem gravacao' }, { status: 404 })
    }

    const { data: signed, error } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(path.slice(prefix.length), 600)
    if (error || !signed?.signedUrl) {
      console.error('[voice-recording] sign failed', error?.message)
      return NextResponse.json({ error: 'Nao foi possivel abrir a gravacao' }, { status: 500 })
    }

    return NextResponse.json({ url: signed.signedUrl, expiresIn: 600 })
  } catch (err) {
    console.error('[voice-recording] unexpected', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
