import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ALLOWED_ORIGINS = new Set([
  'https://luminai.pt',
  'https://www.luminai.pt',
])

function corsHeaders(origin: string | null) {
  const allowOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://luminai.pt'
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Supabase server credentials missing')
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function clean(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max)
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) })
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')
  const headers = corsHeaders(origin)

  try {
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return NextResponse.json({ error: 'origin not allowed' }, { status: 403, headers })
    }

    const body = await req.json()
    const nome = clean(body.nome, 120)
    const empresa = clean(body.empresa, 160)
    const email = clean(body.email, 180)
    const telefone = clean(body.telefone, 40)
    const equipa = clean(body.equipa, 80)
    const leadsMes = clean(body.leads, 80)
    const problema = clean(body.problema, 180)
    const objetivo = clean(body.objetivo, 1000)
    const utm = clean(body.utm, 1000)
    const resultTitle = clean(body.resultado, 220)

    if (!nome || !telefone || !email) {
      return NextResponse.json({ error: 'nome, telefone e email required' }, { status: 400, headers })
    }

    const companyId = process.env.LUMIN_DEFAULT_COMPANY_ID || process.env.REBORN_DEFAULT_COMPANY_ID
    if (!companyId) {
      return NextResponse.json({ error: 'LUMIN_DEFAULT_COMPANY_ID missing' }, { status: 500, headers })
    }

    const supabase = adminClient()
    const customFields = {
      source: 'luminai.pt',
      temperature: 'hot',
      form: 'diagnostico_gratuito',
      empresa,
      equipa,
      leads_mes: leadsMes,
      problema,
      objetivo,
      resultado: resultTitle,
      utm,
      page_url: 'https://luminai.pt/analise-gratuita/',
    }

    const observacoes = [
      '🔥 LEAD QUENTE — LUMIN AI',
      empresa ? `Empresa: ${empresa}` : null,
      email ? `Email: ${email}` : null,
      equipa ? `Equipa: ${equipa}` : null,
      leadsMes ? `Leads/mês: ${leadsMes}` : null,
      problema ? `Problema: ${problema}` : null,
      objetivo ? `Objetivo: ${objetivo}` : null,
      resultTitle ? `Diagnóstico: ${resultTitle}` : null,
      utm ? `UTM: ${utm}` : null,
    ].filter(Boolean).join('\n')

    const { data: duplicate } = await supabase
      .from('leads')
      .select('id, telefone, email')
      .or(`telefone.eq.${telefone},email.eq.${email}`)
      .limit(1)

    let leadId: string | null = duplicate?.[0]?.id ?? null

    if (leadId) {
      const { error } = await supabase
        .from('leads')
        .update({
          nome,
          email,
          telefone,
          status: 'novo',
          observacoes,
          custom_fields: customFields,
        })
        .eq('id', leadId)
      if (error) throw error
    } else {
      const { data, error } = await supabase
        .from('leads')
        .insert({
          nome,
          email,
          telefone,
          company_id: companyId,
          status: 'novo',
          imported_at: new Date().toISOString(),
          observacoes,
          custom_fields: customFields,
        })
        .select('id')
        .single()
      if (error) throw error
      leadId = data?.id ?? null
    }

    return NextResponse.json({ ok: true, lead_id: leadId, status: 'HOT' }, { headers })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'lead capture error' }, { status: 500, headers })
  }
}
