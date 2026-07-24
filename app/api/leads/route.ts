import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateLead } from '@/lib/utils/validators'

/**
 * GET /api/leads
 * Fetch leads for the authenticated user's company
 * Query params: campaign_id, status, search, limit, offset
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's company and role
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
    const search = searchParams.get('search')
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

    // Search by name or phone
    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,mobile.ilike.%${search}%,email.ilike.%${search}%`
      )
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
      data: leads,
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
  const supabase = await createClient()

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

    // Validate data
    const validation = validateLead(body)
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.errors }, { status: 400 })
    }

    const { data: lead, error } = await supabase
      .from('leads')
      .insert({
        company_id: userProfile.company_id,
        first_name: body.first_name,
        last_name: body.last_name,
        email: body.email,
        phone: body.phone,
        mobile: body.mobile,
        address: body.address,
        postal_code: body.postal_code,
        city: body.city,
        nif: body.nif,
        operator: body.operator,
        campaign_id: body.campaign_id,
        status: 'new',
        notes: body.notes,
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

/**
 * PATCH /api/leads
 * Update multiple leads (bulk status update)
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { ids, updates } = body

    if (!ids || !Array.isArray(ids) || !updates) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    // Get user's company
    const { data: userProfile } = await supabase
      .from('usuarios')
      .select('company_id, role')
      .eq('id', user.id)
      .single()

    // Update leads
    const { data, error } = await supabase
      .from('leads')
      .update(updates)
      .in('id', ids)
      .eq('company_id', userProfile.company_id)
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('[API] PATCH /api/leads error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
