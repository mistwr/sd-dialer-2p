import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/historico
 * Fetch call history
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
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    const { data: userProfile } = await supabase
      .from('usuarios')
      .select('company_id, role')
      .eq('id', user.id)
      .single()

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    let query = supabase
      .from('call_history')
      .select('*, leads(first_name, last_name, phone)', { count: 'exact' })
      .eq('company_id', userProfile.company_id)
      .order('call_date', { ascending: false })
      .order('call_time', { ascending: false })
      .range(offset, offset + limit - 1)

    // For comercial users, only show their own call history
    if (userProfile.role === 'comercial') {
      query = query.eq('usuario_id', user.id)
    }

    const { data: history, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      history,
      total: count,
      limit,
      offset,
    })
  } catch (error) {
    console.error('[API] GET /api/historico error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/historico
 * Create a new call history record
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
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    const body = await request.json()

    const { data: history, error } = await supabase
      .from('call_history')
      .insert({
        company_id: userProfile.company_id,
        usuario_id: user.id,
        call_date: new Date().toISOString().split('T')[0],
        call_time: new Date().toTimeString().split(' ')[0],
        ...body,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(history, { status: 201 })
  } catch (error) {
    console.error('[API] POST /api/historico error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
