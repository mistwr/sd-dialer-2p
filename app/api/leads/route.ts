import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/leads
 * Fetch leads for the authenticated user's company
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

    // Get user's company
    const { data: userProfile } = await supabase
      .from('usuarios')
      .select('company_id, role')
      .eq('id', user.id)
      .single()

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const campaign_id = searchParams.get('campaign_id')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // Build query
    let query = supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .eq('company_id', userProfile.company_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Filter by campaign if provided
    if (campaign_id) {
      query = query.eq('campaign_id', campaign_id)
    }

    // Filter by status if provided
    if (status) {
      query = query.eq('status', status)
    }

    // For comercial users, only show their assigned leads
    if (userProfile.role === 'comercial') {
      query = query.eq('assigned_to', user.id)
    }

    const { data: leads, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      leads,
      total: count,
      limit,
      offset,
    })
  } catch (error) {
    console.error('[API] GET /api/leads error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/leads
 * Create a new lead (admin/supervisor only)
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

    // Check if user is admin or supervisor
    const { data: userProfile } = await supabase
      .from('usuarios')
      .select('company_id, role')
      .eq('id', user.id)
      .single()

    if (!userProfile || !['admin', 'supervisor'].includes(userProfile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()

    const { data: lead, error } = await supabase
      .from('leads')
      .insert({
        company_id: userProfile.company_id,
        ...body,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(lead, { status: 201 })
  } catch (error) {
    console.error('[API] POST /api/leads error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
