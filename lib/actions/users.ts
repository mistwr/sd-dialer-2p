'use server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createUserAction(data: {
  email: string
  password: string
  full_name: string
  phone?: string
  company_id: string
  role: 'admin' | 'supervisor' | 'parceiro'
}) {
  const cookieStore = await cookies()

  // Use the service role key for admin operations
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

  // Sign up the user via standard signup (works without service role)
  // The admin sees all users via RLS admin policies
  const { data: authData, error: signUpError } = await supabaseAdmin.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: { full_name: data.full_name },
    },
  })

  if (signUpError) throw new Error(signUpError.message)
  if (!authData.user) throw new Error('Utilizador nao criado')

  const { error: profileError } = await supabaseAdmin.from('usuarios').insert({
    id: authData.user.id,
    email: data.email,
    full_name: data.full_name,
    phone: data.phone ?? null,
    company_id: data.company_id,
    role: data.role,
    status: 'active',
  })

  if (profileError) throw new Error(profileError.message)

  return { id: authData.user.id }
}
