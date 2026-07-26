/**
 * POST /api/recordings/upload
 * Accepts: multipart/form-data with fields:
 *   file          — audio blob
 *   call_history_id, lead_id, campanha_id — UUIDs (optional)
 *
 * Uploads to Supabase Storage → inserts call_recordings row → returns id + url
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    // Get parceiro company_id
    const { data: parceiro } = await supabase
      .from('usuarios')
      .select('company_id')
      .eq('id', user.id)
      .single()

    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Ficheiro ausente' }, { status: 400 })

    const call_history_id = form.get('call_history_id') as string | null
    const lead_id = form.get('lead_id') as string | null
    const campanha_id = form.get('campanha_id') as string | null

    // Upload to Supabase Storage
    const ext = file.type.includes('ogg') ? 'ogg'
              : file.type.includes('mp4') || file.type.includes('m4a') ? 'm4a'
              : file.type.includes('wav') ? 'wav'
              : 'webm'

    const path = `${parceiro?.company_id ?? user.id}/${user.id}/${Date.now()}.${ext}`
    const arrayBuffer = await file.arrayBuffer()

    const { error: uploadErr } = await supabase.storage
      .from('recordings')
      .upload(path, arrayBuffer, { contentType: file.type, upsert: false })

    if (uploadErr) {
      return NextResponse.json({ error: `Upload falhou: ${uploadErr.message}` }, { status: 500 })
    }

    // Get signed URL (valid 7 days)
    const { data: signedData } = await supabase.storage
      .from('recordings')
      .createSignedUrl(path, 60 * 60 * 24 * 7)

    const audio_url = signedData?.signedUrl ?? null

    // Insert recording row
    const { data: recording, error: insertErr } = await supabase
      .from('call_recordings')
      .insert({
        call_history_id: call_history_id || null,
        lead_id: lead_id || null,
        parceiro_id: user.id,
        company_id: parceiro?.company_id,
        campanha_id: campanha_id || null,
        audio_url,
        file_name: file.name || path.split('/').pop(),
        file_size: file.size,
        mime_type: file.type,
        status: 'uploaded',
      })
      .select()
      .single()

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    return NextResponse.json({ recording }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
