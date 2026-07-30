import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY em falta' }, { status: 500 })
  }

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
    return NextResponse.json({ error: 'Sem permissao' }, { status: 403 })
  }

  let query = supabaseAdmin.from('companies').select('id, name').order('name')

  if (!callerProfile.is_super_admin) {
    query = query.eq('id', callerProfile.company_id)
  }

  const { data: companies, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(companies ?? [])
}