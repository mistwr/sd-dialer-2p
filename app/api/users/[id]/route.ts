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
  const { data: profile } = await admin
    .from('usuarios')
    .select('role, company_id, is_super_admin')
    .eq('id', data.user.id)
    .single()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'supervisor')) return null
  return { user: data.user, profile }
}

function canManageTarget(
  caller: { user: { id: string }; profile: { role: string; company_id: string | null; is_super_admin: boolean } },
  target: { id: string; company_id: string | null; role: string; created_by: string | null; supervisor_id: string | null; is_super_admin: boolean }
) {
  if (caller.profile.is_super_admin) return true
  if (!caller.profile.company_id || target.company_id !== caller.profile.company_id) return false
  if (target.is_super_admin) return false

  if (caller.profile.role === 'admin') {
    return target.role === 'supervisor' || target.role === 'parceiro'
  }

  if (caller.profile.role === 'supervisor') {
    return target.role === 'parceiro' && (target.supervisor_id === caller.user.id || (!target.supervisor_id && target.created_by === caller.user.id))
  }

  return false
}

// PATCH /api/users/[id] — update profile data OR change password
// If body contains `password` → change password only
// Otherwise → update profile fields (full_name, phone, company_id, status, role)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    return NextResponse.json({ error: 'Configuracao em falta' }, { status: 500 })

  const caller = await verifyCallerIsAdmin(request)
  if (!caller) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const admin = makeAdmin()

  const { data: target } = await admin
    .from('usuarios')
    .select('id, company_id, role, created_by, supervisor_id, is_super_admin')
    .eq('id', id)
    .single()

  if (!target || !canManageTarget(caller as any, target as any)) {
    return NextResponse.json({ error: 'Sem permissao para gerir este utilizador' }, { status: 403 })
  }

  // ── Password change ──────────────────────────────────────────────────────
  if (body.password !== undefined) {
    const { password } = body
    if (!password?.trim() || password.trim().length < 6)
      return NextResponse.json({ error: 'Password deve ter pelo menos 6 caracteres' }, { status: 400 })

    const { error } = await admin.auth.admin.updateUserById(id, { password: password.trim() })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  // ── Profile update ───────────────────────────────────────────────────────
  const { full_name, phone, company_id, status, role, equipa, meta_ligacoes_dia, supervisor_id } = body

  if (!caller.profile.is_super_admin) {
    if (company_id !== undefined && company_id !== caller.profile.company_id) {
      return NextResponse.json({ error: 'Nao pode mover utilizadores para outra empresa' }, { status: 403 })
    }
    if (caller.profile.role === 'supervisor' && role !== undefined && role !== 'parceiro') {
      return NextResponse.json({ error: 'Supervisor so pode gerir parceiros da sua equipa' }, { status: 403 })
    }
    if (caller.profile.role === 'admin' && role !== undefined && !['supervisor', 'parceiro'].includes(role)) {
      return NextResponse.json({ error: 'Admin da empresa so pode gerir supervisores ou parceiros' }, { status: 403 })
    }
  }

  let effectiveSupervisorId: string | null | undefined = undefined
  if (supervisor_id !== undefined || role !== undefined) {
    const resultingRole = role ?? target.role
    if (resultingRole !== 'parceiro') {
      effectiveSupervisorId = null
    } else if (caller.profile.role === 'supervisor' && !caller.profile.is_super_admin) {
      effectiveSupervisorId = caller.user.id
    } else if (supervisor_id) {
      const { data: supervisor } = await admin
        .from('usuarios')
        .select('id, company_id, role, status')
        .eq('id', supervisor_id)
        .single()

      const targetCompany = company_id ?? target.company_id
      if (!supervisor || supervisor.role !== 'supervisor' || supervisor.company_id !== targetCompany || supervisor.status !== 'active') {
        return NextResponse.json({ error: 'Supervisor invalido para esta empresa' }, { status: 400 })
      }
      effectiveSupervisorId = supervisor.id
    } else if (supervisor_id === null || supervisor_id === '') {
      effectiveSupervisorId = null
    }
  }

  const updatePayload: Record<string, any> = {}
  if (full_name !== undefined)  updatePayload.full_name  = full_name?.trim() || null
  if (phone !== undefined)      updatePayload.phone      = phone?.trim()     || null
  if (company_id !== undefined) updatePayload.company_id = company_id
  if (status !== undefined)     updatePayload.status     = status
  if (role !== undefined)       updatePayload.role       = role
  if (equipa !== undefined)     updatePayload.equipa     = equipa?.trim() || null
  if (meta_ligacoes_dia !== undefined) updatePayload.meta_ligacoes_dia = Number(meta_ligacoes_dia) || 150
  if (effectiveSupervisorId !== undefined) updatePayload.supervisor_id = effectiveSupervisorId

  if (Object.keys(updatePayload).length === 0)
    return NextResponse.json({ error: 'Nenhum campo para actualizar' }, { status: 400 })

  const { error } = await admin.from('usuarios').update(updatePayload).eq('id', id)
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
  if (caller.user.id === id) {
    return NextResponse.json({ error: 'Nao pode apagar a sua propria conta' }, { status: 400 })
  }

  const admin = makeAdmin()
  const { data: target } = await admin
    .from('usuarios')
    .select('id, company_id, role, created_by, supervisor_id, is_super_admin')
    .eq('id', id)
    .single()

  if (!target || !canManageTarget(caller as any, target as any)) {
    return NextResponse.json({ error: 'Sem permissao para apagar este utilizador' }, { status: 403 })
  }

  // Delete profile row first (FK constraint)
  await admin.from('usuarios').delete().eq('id', id)

  // Delete auth user
  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
