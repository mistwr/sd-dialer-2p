import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function admin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
}

function ipGeo(req: NextRequest): { lat: number; lng: number } | null {
  try {
    const nf = req.headers.get('x-nf-geo')
    if (nf) {
      const g = JSON.parse(Buffer.from(nf, 'base64').toString('utf8'))
      const lat = Number(g?.latitude), lng = Number(g?.longitude)
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
    }
    const la = Number(req.headers.get('x-vercel-ip-latitude')), lo = Number(req.headers.get('x-vercel-ip-longitude'))
    if (Number.isFinite(la) && Number.isFinite(lo) && (la || lo)) return { lat: la, lng: lo }
  } catch {}
  return null
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
  const b = await request.json().catch(() => ({})) as { lat?: number; lng?: number; accuracy?: number; semGps?: boolean }
  if (b.semGps) {
    // Sem permissão de GPS: posição aproximada (cidade) pelos cabeçalhos de IP da plataforma. Não substitui um GPS recente.
    const ip = ipGeo(request)
    if (!ip) return NextResponse.json({ ok: true, aproximada: false })
    const { data: atual } = await c.db.from('user_locations').select('accuracy, updated_at').eq('user_id', c.me.id).maybeSingle()
    // A posição pelo IP é só a cidade da rede (nas redes móveis dá quase sempre o centro do Porto ou de Lisboa).
    // Nunca substitui uma posição real de GPS: nesse caso só regista que a pessoa está online.
    if (atual && Number(atual.accuracy ?? 0) < 5000) {
      await c.db.from('usuarios').update({ last_seen_at: new Date().toISOString() }).eq('id', c.me.id)
      return NextResponse.json({ ok: true, aproximada: false })
    }
    await c.db.from('user_locations').upsert({ user_id: c.me.id, company_id: c.me.company_id, lat: ip.lat, lng: ip.lng, accuracy: 20000, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    return NextResponse.json({ ok: true, aproximada: true })
  }
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
  const todas = !!c.me.is_super_admin
  let q = c.db.from('user_locations').select('user_id, company_id, lat, lng, accuracy, updated_at')
  if (!todas) q = q.eq('company_id', c.me.company_id)
  const { data: locs } = await q
  const cids = Array.from(new Set((locs || []).map((l: any) => l.company_id).filter(Boolean)))
  const { data: emps } = todas && cids.length ? await c.db.from('companies').select('id, name').in('id', cids) : { data: [] as any[] }
  const empresa = new Map((emps || []).map((e: any) => [e.id, e.name]))
  const ids = (locs || []).map(l => l.user_id)
  const { data: users } = ids.length ? await c.db.from('usuarios').select('id, full_name, role').in('id', ids) : { data: [] as any[] }
  const nome = new Map((users || []).map((u: any) => [u.id, u]))
  return NextResponse.json({
    pessoas: (locs || []).map((l: any) => ({ ...l, empresa: todas ? (empresa.get(l.company_id) ?? null) : null, nome: nome.get(l.user_id)?.full_name ?? 'Sem nome', role: nome.get(l.user_id)?.role ?? '' })),
    agora: new Date().toISOString(),
  })
}
