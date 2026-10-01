import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

// Route is protected by the service role key itself — only server-side code
// with SUPABASE_SERVICE_ROLE_KEY can call auth.admin.createUser.
// The caller also passes their own JWT so we can verify role and company_id.

export async function POST(request: NextRequest) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY em falta' }, { status: 500 })
  }

  const body = await request.json()
  const { email, full_name, role = 'parceiro', phone, password, company_id, supervisor_id } = body

  if (!email?.trim() || !full_name?.trim()) {
    return NextResponse.json({ error: 'Email e nome sao obrigatorios' }, { status: 400 })
  }
  if (!password?.trim() || password.trim().length < 6) {
    return NextResponse.json({ error: 'Password deve ter pelo menos 6 caracteres' }, { status: 400 })
  }
  if (!company_id) {
    return NextResponse.json({ error: 'Empresa obrigatoria' }, { status: 400 })
  }

  // Verify the caller's JWT (passed explicitly from the browser)
  const authHeader = request.headers.get('Authorization')
  const callerJwt = authHeader?.replace('Bearer ', '')
  if (!callerJwt) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Verify caller is admin/supervisor using their JWT
  const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(callerJwt)
  if (callerError || !callerData.user) {
    return NextResponse.json({ error: 'Sessao invalida' }, { status: 401 })
  }

  const { data: callerProfile } = await supabaseAdmin
    .from('usuarios')
    .select('role, company_id, is_super_admin')
    .eq('id', callerData.user.id)
    .single()

  if (!callerProfile || (callerProfile.role !== 'admin' && callerProfile.role !== 'supervisor')) {
    return NextResponse.json({ error: 'Sem permissao para criar utilizadores' }, { status: 403 })
  }

  const isSuperAdmin = callerProfile.is_super_admin === true
  const callerCompanyId = callerProfile.company_id as string | null

  // Só o super-admin global pode escolher outra empresa ou criar admins.
  // Admin normal: apenas supervisor/parceiro da própria empresa.
  // Supervisor: apenas parceiro da própria empresa.
  if (!isSuperAdmin) {
    if (!callerCompanyId || company_id !== callerCompanyId) {
      return NextResponse.json({ error: 'So pode criar utilizadores na sua propria empresa' }, { status: 403 })
    }

    if (callerProfile.role === 'supervisor' && role !== 'parceiro') {
      return NextResponse.json({ error: 'Supervisor so pode criar parceiros da sua equipa' }, { status: 403 })
    }

    if (callerProfile.role === 'admin' && !['supervisor', 'parceiro'].includes(role)) {
      return NextResponse.json({ error: 'Admin da empresa so pode criar supervisores ou parceiros' }, { status: 403 })
    }
  }

  let effectiveSupervisorId: string | null = null
  if (role === 'parceiro') {
    if (callerProfile.role === 'supervisor') {
      effectiveSupervisorId = callerData.user.id
    } else if (supervisor_id) {
      const { data: supervisor } = await supabaseAdmin
        .from('usuarios')
        .select('id, company_id, role, status')
        .eq('id', supervisor_id)
        .single()

      if (!supervisor || supervisor.role !== 'supervisor' || supervisor.company_id !== company_id || supervisor.status !== 'active') {
        return NextResponse.json({ error: 'Supervisor invalido para esta empresa' }, { status: 400 })
      }
      effectiveSupervisorId = supervisor.id
    }
  }

  // Create the auth user with email_confirm: true (no email required)
  const { data: signUpData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
    email: email.trim(),
    password: password.trim(),
    email_confirm: true,
    user_metadata: { full_name: full_name.trim() },
  })

  if (signUpError) {
    return NextResponse.json({ error: signUpError.message }, { status: 400 })
  }
  if (!signUpData.user) {
    return NextResponse.json({ error: 'Utilizador nao criado' }, { status: 500 })
  }

  // Insert the profile row
  const { error: profileError } = await supabaseAdmin.from('usuarios').insert({
    id: signUpData.user.id,
    email: email.trim(),
    full_name: full_name.trim(),
    phone: phone?.trim() || null,
    company_id,
    role,
    status: 'active',
    created_by: callerData.user.id,
    supervisor_id: effectiveSupervisorId,
  })

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(signUpData.user.id)
    return NextResponse.json({ error: profileError.message }, { status: 400 })
  }

  return NextResponse.json({ id: signUpData.user.id })
}
