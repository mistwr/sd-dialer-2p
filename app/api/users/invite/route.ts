import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()

  // Verify the caller is authenticated and is an admin
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  }

  const { data: caller } = await supabase
    .from('usuarios')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if (!caller || (caller.role !== 'admin' && caller.role !== 'supervisor')) {
    return NextResponse.json({ error: 'Apenas administradores podem criar utilizadores' }, { status: 403 })
  }

  const body = await request.json()
  const { email, full_name, role = 'parceiro', phone, password } = body

  if (!email || !full_name) {
    return NextResponse.json({ error: 'email e full_name sao obrigatorios' }, { status: 400 })
  }

  // Admin client: uses createClient from @supabase/supabase-js (not SSR)
  // so that .auth.admin methods are available
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return NextResponse.json({ error: 'Configuracao do servidor incompleta (SUPABASE_SERVICE_ROLE_KEY em falta)' }, { status: 500 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Try to create user with password directly (most reliable path)
  const effectivePassword = password?.trim() || (Math.random().toString(36).slice(-10) + 'A1!')
  const { data: signUpData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: effectivePassword,
    email_confirm: true,       // skip email confirmation
    user_metadata: { full_name },
  })

  if (signUpError) {
    return NextResponse.json({ error: signUpError.message }, { status: 400 })
  }

  if (!signUpData.user) {
    return NextResponse.json({ error: 'Utilizador nao criado' }, { status: 500 })
  }

  // Insert the profile row in the public usuarios table
  const { error: profileError } = await supabaseAdmin.from('usuarios').insert({
    id: signUpData.user.id,
    email,
    full_name,
    phone: phone ?? null,
    company_id: caller.company_id,
    role,
    status: 'active',
  })

  if (profileError) {
    // Clean up the auth user so the admin can retry
    await supabaseAdmin.auth.admin.deleteUser(signUpData.user.id)
    return NextResponse.json({ error: profileError.message }, { status: 400 })
  }

  return NextResponse.json({ id: signUpData.user.id })
}
