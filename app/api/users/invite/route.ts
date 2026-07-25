import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()

  // Require admin auth
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

  // Check caller is admin
  const { data: caller } = await supabase
    .from('usuarios')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if (!caller || caller.role !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores podem convidar utilizadores' }, { status: 403 })
  }

  const body = await request.json()
  const { email, full_name, role = 'parceiro', phone } = body

  if (!email || !full_name) {
    return NextResponse.json({ error: 'email e full_name sao obrigatorios' }, { status: 400 })
  }

  // Use admin client to send invite
  const supabaseAdmin = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
      auth: { persistSession: false },
    }
  )

  // Invite via Supabase (sends magic link email)
  const { data: inviteData, error: inviteError } = await (supabaseAdmin.auth.admin as any).inviteUserByEmail(email, {
    data: { full_name },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin}/api/auth/callback?next=/parceiro`,
  }).catch(() => ({ data: null, error: new Error('invite_not_available') }))

  if (inviteError) {
    // Fall back: create with temporary password
    const tempPassword = Math.random().toString(36).slice(-10) + 'A1!'
    const { data: signUpData, error: signUpError } = await supabaseAdmin.auth.signUp({
      email,
      password: tempPassword,
      options: { data: { full_name } },
    })
    if (signUpError) {
      return NextResponse.json({ error: signUpError.message }, { status: 400 })
    }
    if (!signUpData.user) {
      return NextResponse.json({ error: 'Utilizador nao criado' }, { status: 500 })
    }
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
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }
    return NextResponse.json({ id: signUpData.user.id, temp_password: tempPassword })
  }

  // Insert profile row
  const newUserId = inviteData?.user?.id
  if (newUserId) {
    await supabaseAdmin.from('usuarios').insert({
      id: newUserId,
      email,
      full_name,
      phone: phone ?? null,
      company_id: caller.company_id,
      role,
      status: 'active',
    }).then(() => {})
  }

  return NextResponse.json({ id: newUserId, invited: true })
}
