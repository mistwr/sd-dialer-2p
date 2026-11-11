import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export function campanhasAdmin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function campanhasUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = campanhasAdmin()
  const { data: me } = await admin
    .from('usuarios')
    .select('id, role, status, company_id')
    .eq('id', user.id)
    .maybeSingle()
  if (!me || me.status !== 'active' || !me.company_id) return null
  return { admin, me }
}
