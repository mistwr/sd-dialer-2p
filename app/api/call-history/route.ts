import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validatePhoneCall } from '@/lib/utils/validators'

/**
 * GET /api/call-history
 * Listar histórico de chamadas do utilizador autenticado
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const leadId = searchParams.get('lead_id')

    let query = supabase
      .from('call_history')
      .select(
        `
        *,
        leads(first_name, last_name, mobile),
        usuarios(full_name)
      `
      )
      .eq('usuario_id', user.id)
      .order('call_date', { ascending: false })
      .order('call_time', { ascending: false })
      .range(offset, offset + limit - 1)

    if (leadId) {
      query = query.eq('lead_id', leadId)
    }

    const { data, error, count } = await query

    if (error) throw error

    return NextResponse.json({
      data,
      total: count,
      limit,
      offset,
    })
  } catch (error: any) {
    console.error('[API] Erro ao listar call history:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * POST /api/call-history
 * Registar nova chamada
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Validar dados
    const validation = validatePhoneCall(body)
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.errors }, { status: 400 })
    }

    // Obter dados do utilizador (company_id)
    const { data: userData, error: userError } = await supabase
      .from('usuarios')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (userError) throw userError

    const { data, error } = await supabase.from('call_history').insert({
      lead_id: body.lead_id,
      usuario_id: user.id,
      company_id: userData.company_id,
      campaign_id: body.campaign_id,
      call_date: body.call_date || new Date().toISOString().split('T')[0],
      call_time: body.call_time || new Date().toTimeString().split(' ')[0],
      duration_seconds: body.duration_seconds || 0,
      result: body.result,
      notes: body.notes,
      follow_up_date: body.follow_up_date,
      follow_up_time: body.follow_up_time,
    })

    if (error) throw error

    // Atualizar status do lead se necessário
    if (body.result === 'venda') {
      await supabase
        .from('leads')
        .update({ status: 'vendido' })
        .eq('id', body.lead_id)
    } else if (body.result === 'nao_interessado') {
      await supabase
        .from('leads')
        .update({ status: 'nao_interessado' })
        .eq('id', body.lead_id)
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error: any) {
    console.error('[API] Erro ao criar call history:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
