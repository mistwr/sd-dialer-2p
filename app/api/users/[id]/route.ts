import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

function makeAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function verifyCallerIsAdmin(request: NextRequest) {
  const jwt = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!jwt) return null
  const admin = makeAdmin()
  const { data, error } = await admin.auth.getUser(jwt)
  if (error || !data.user) return null
  const { data: profile } = await admin.from('usuarios').select('role').eq('id', data.user.id).single()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'supervisor')) return null
  return data.user
}

// PATCH /api/users/[id] — change password
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return NextResponse.json({ error: 'Configuracao em falta' }, { status: 500 })

  const caller = await verifyCallerIsAdmin(request)
  if (!caller) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { password } = body

  if (!password?.trim() || password.trim().length < 6) {
    return NextResponse.json({ error: 'Password deve ter pelo menos 6 caracteres' }, { status: 400 })
  }

  const admin = makeAdmin()
  const { error } = await admin.auth.admin.updateUserById(id, {
    password: password.trim(),
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/users/[id] — delete auth user + profile
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return NextResponse.json({ error: 'Configuracao em falta' }, { status: 500 })

  const caller = await verifyCallerIsAdmin(request)
  if (!caller) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })

  const { id } = await params

  // Prevent self-deletion
  if (caller.id === id) {
    return NextResponse.json({ error: 'Nao pode apagar a sua propria conta' }, { status: 400 })
  }

  const admin = makeAdmin()

  // Delete profile row first (FK constraint)
  await admin.from('usuarios').delete().eq('id', id)

  // Delete auth user
  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
