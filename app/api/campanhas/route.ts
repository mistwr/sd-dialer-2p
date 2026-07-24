import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/campanhas
 * Fetch campaigns for the user's company
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
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    const { data: userProfile } = await supabase
      .from('usuarios')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    let query = supabase
      .from('campanhas')
      .select('*', { count: 'exact' })
      .eq('company_id', userProfile.company_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    const { data: campaigns, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      campaigns,
      total: count,
      limit,
      offset,
    })
  } catch (error) {
    console.error('[API] GET /api/campanhas error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/campanhas
 * Create a new campaign (admin only)
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

    const { data: campaign, error } = await supabase
      .from('campanhas')
      .insert({
        company_id: userProfile.company_id,
        created_by: user.id,
        ...body,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(campaign, { status: 201 })
  } catch (error) {
    console.error('[API] POST /api/campanhas error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
