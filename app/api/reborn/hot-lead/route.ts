import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Supabase server credentials missing')
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function forwardWebhook(url: string | undefined, payload: unknown) {
  if (!url) return
  await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  }).catch(() => null)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const phone = String(body.phone ?? '').trim()
    if (!phone) return NextResponse.json({ error: 'phone required' }, { status: 400 })

    const campaignId = String(body.campaign_id ?? 'reborn_ai_call')
    const trigger = String(body.trigger ?? 'positive_intent')
    const transcript = body.transcript ? String(body.transcript) : null
    const companyId = process.env.REBORN_DEFAULT_COMPANY_ID
    if (!companyId) {
      return NextResponse.json({ error: 'REBORN_DEFAULT_COMPANY_ID missing' }, { status: 500 })
    }

    const supabase = adminClient()
    const { data: duplicate } = await supabase
      .from('leads')
      .select('id, telefone')
      .eq('telefone', phone)
      .limit(1)

    const observacoes = [
      '🔥 LEAD QUENTE — REBORN AI CALL',
      `Campanha: ${campaignId}`,
      `Gatilho: ${trigger}`,
      transcript ? `Transcrição: ${transcript}` : null,
    ].filter(Boolean).join('\n')

    let leadId: string | null = duplicate?.[0]?.id ?? null

    if (leadId) {
      const { error } = await supabase
        .from('leads')
        .update({
          status: 'novo',
          observacoes,
          custom_fields: {
            source: 'reborn_ai_call_android',
            temperature: 'hot',
            campaign_id: campaignId,
            trigger,
            transcript,
          },
        })
        .eq('id', leadId)
      if (error) throw error
    } else {
      const { data, error } = await supabase
        .from('leads')
        .insert({
          nome: 'Lead REBORN AI',
          telefone: phone,
          company_id: companyId,
          status: 'novo',
          imported_at: new Date().toISOString(),
          observacoes,
          custom_fields: {
            source: 'reborn_ai_call_android',
            temperature: 'hot',
            campaign_id: campaignId,
            trigger,
            transcript,
          },
        })
        .select('id')
        .single()
      if (error) throw error
      leadId = data?.id ?? null
    }

    const event = {
      type: 'reborn.hot_lead',
      lead_id: leadId,
      phone,
      campaign_id: campaignId,
      trigger,
      transcript,
      source: 'reborn_ai_call_android',
      created_at: new Date().toISOString(),
    }

    await Promise.all([
      forwardWebhook(process.env.INDIGO_HOT_LEAD_WEBHOOK, event),
      forwardWebhook(process.env.MYPOUPAR_HOT_LEAD_WEBHOOK, event),
    ])

    return NextResponse.json({ ok: true, lead_id: leadId, status: 'HOT' })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'hot lead error' }, { status: 500 })
  }
}
