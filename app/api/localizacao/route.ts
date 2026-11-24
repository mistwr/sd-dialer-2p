import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function admin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function quem() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const db = admin()
  const { data: me } = await db.from('usuarios').select('id, full_name, role, company_id, is_super_admin, status').eq('id', user.id).maybeSingle()
  if (!me || me.status !== 'active' || !me.company_id) return null
  return { db, me }
}

// O telemóvel/browser de cada utilizador envia a sua posição (só a última fica guardada).
export async function POST(request: NextRequest) {
  const c = await quem()
  if (!c) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const b = await request.json().catch(() => ({})) as { lat?: number; lng?: number; accuracy?: number }
  const lat = Number(b.lat), lng = Number(b.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return NextResponse.json({ error: 'Posição inválida' }, { status: 400 })
  const { error } = await c.db.from('user_locations').upsert({
    user_id: c.me.id, company_id: c.me.company_id, lat, lng,
    accuracy: Number.isFinite(Number(b.accuracy)) ? Number(b.accuracy) : null, updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
  if (error) return NextResponse.json({ error: 'Não foi possível guardar.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// Admin/supervisor: posição de toda a equipa da empresa.
export async function GET(request: NextRequest) {
  const c = await quem()
  if (!c) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (new URL(request.url).searchParams.get('me') === '1') {
    const { data: eu } = await c.db.from('user_locations').select('lat, lng, accuracy, updated_at').eq('user_id', c.me.id).maybeSingle()
    return NextResponse.json({ posicao: eu || null })
  }
  if (!['admin', 'supervisor'].includes(String(c.me.role)) && !c.me.is_super_admin) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  const { data: locs } = await c.db.from('user_locations').select('user_id, lat, lng, accuracy, updated_at').eq('company_id', c.me.company_id)
  const ids = (locs || []).map(l => l.user_id)
  const { data: users } = ids.length ? await c.db.from('usuarios').select('id, full_name, role').in('id', ids) : { data: [] as any[] }
  const nome = new Map((users || []).map((u: any) => [u.id, u]))
  return NextResponse.json({
    pessoas: (locs || []).map(l => ({ ...l, nome: nome.get(l.user_id)?.full_name ?? 'Sem nome', role: nome.get(l.user_id)?.role ?? '' })),
    agora: new Date().toISOString(),
  })
}
