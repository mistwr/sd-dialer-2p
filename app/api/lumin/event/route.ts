import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ALLOWED_ORIGINS = new Set([
  'https://luminai.pt',
  'https://www.luminai.pt',
])

const EVENT_TYPES = new Set([
  'page_view',
  'robot_click',
  'pro_click',
  'checkout_click',
  'whatsapp_click',
  'simulation_click',
  'simulation_result',
  'analysis_click',
  'lead_submit',
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
    const eventType = clean(body.event_type, 60)
    if (!EVENT_TYPES.has(eventType)) {
      return NextResponse.json({ error: 'invalid event_type' }, { status: 400, headers })
    }

    const eventData =
      body.event_data && typeof body.event_data === 'object' && !Array.isArray(body.event_data)
        ? JSON.parse(JSON.stringify(body.event_data).slice(0, 4000))
        : {}

    const payload = {
      event_type: eventType,
      page_path: clean(body.page_path, 300) || '/',
      utm_source: clean(body.utm_source, 120) || null,
      utm_medium: clean(body.utm_medium, 120) || null,
      utm_campaign: clean(body.utm_campaign, 160) || null,
      utm_content: clean(body.utm_content, 160) || null,
      referrer_domain: clean(body.referrer_domain, 200) || null,
      session_id: clean(body.session_id, 120) || null,
      event_data: eventData,
    }

    const supabase = adminClient()
    const { error } = await supabase.from('lumin_analytics_events').insert(payload)
    if (error) throw error

    return NextResponse.json({ ok: true }, { headers })
  } catch (error: any) {
    console.error('LUMIN analytics event error', error)
    return NextResponse.json({ error: error?.message ?? 'analytics error' }, { status: 500, headers })
  }
}
