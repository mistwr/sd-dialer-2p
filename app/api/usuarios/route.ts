import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/usuarios
 * Fetch users from the company (admin/supervisor only)
 */
export async function GET(request: NextRequest) {
  const supabase = createClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    const { data: userProfile } = await supabase
      .from('usuarios')
      .select('company_id, role')
      .eq('id', user.id)
      .single()

    if (!userProfile || !['admin', 'supervisor'].includes(userProfile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: users, error, count } = await supabase
      .from('usuarios')
      .select('*', { count: 'exact' })
      .eq('company_id', userProfile.company_id)
      .eq('status', 'active')
      .order('full_name')
      .range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      usuarios: users,
      total: count,
      limit,
      offset,
    })
  } catch (error) {
    console.error('[API] GET /api/usuarios error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/usuarios
 * Create a new user (admin only)
 */
export async function POST(request: NextRequest) {
  const supabase = createClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userProfile } = await supabase
      .from('usuarios')
      .select('company_id, role')
      .eq('id', user.id)
      .single()

    if (!userProfile || userProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // Create usuario record
    const { data: newUser, error } = await supabase
      .from('usuarios')
      .insert({
        id: authData.user.id,
        company_id: userProfile.company_id,
        email: body.email,
        full_name: body.full_name,
        phone: body.phone,
        role: body.role || 'comercial',
        supervisor_id: body.supervisor_id,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(newUser, { status: 201 })
  } catch (error) {
    console.error('[API] POST /api/usuarios error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
