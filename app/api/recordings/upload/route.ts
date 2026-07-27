/**
 * POST /api/recordings/upload
 * Accepts: multipart/form-data with fields:
 *   file          — audio blob
 *   call_history_id, lead_id, campanha_id — UUIDs (optional)
 *
 * Auth: reads session from cookie (SSR) OR Authorization: Bearer <jwt> header.
 * Storage: uses service role key to bypass RLS on storage.objects.
 * DB insert: uses the user's own client (RLS applies → parceiro_id = auth.uid()).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export const maxDuration = 60 // seconds — allow large audio files

// Admin client — only used for storage upload (bypasses storage RLS)
function getAdminClient() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate: try cookie session first, then Bearer header
    const supabase = await createClient()
    let userId: string | null = null
    let companyId: string | null = null

    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      userId = user.id
    } else {
      // Fallback: extract JWT from Authorization header and verify via admin
      const authHeader = req.headers.get('authorization') ?? ''
      const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
      if (jwt) {
        const admin = getAdminClient()
        const { data } = await admin.auth.getUser(jwt)
        if (data?.user) userId = data.user.id
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    // 2. Get parceiro company_id (use admin to avoid RLS issues)
    const admin = getAdminClient()
    const { data: parceiro } = await admin
      .from('usuarios')
      .select('company_id')
      .eq('id', userId)
      .single()

    companyId = parceiro?.company_id ?? null

    // 3. Parse form data
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'Ficheiro ausente ou vazio' }, { status: 400 })
    }

    const call_history_id = (form.get('call_history_id') as string | null) || null
    const lead_id = (form.get('lead_id') as string | null) || null
    const campanha_id = (form.get('campanha_id') as string | null) || null

    // 4. Determine file extension
    const mime = file.type || 'audio/webm'
    const ext = mime.includes('ogg') ? 'ogg'
              : mime.includes('mp4') || mime.includes('m4a') ? 'm4a'
              : mime.includes('wav') ? 'wav'
              : mime.includes('mpeg') || mime.includes('mp3') ? 'mp3'
              : 'webm'

    const storagePath = `${companyId ?? userId}/${userId}/${Date.now()}.${ext}`

    // 5. Upload using admin (service role) — avoids storage RLS issues
    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadErr } = await admin.storage
      .from('recordings')
      .upload(storagePath, arrayBuffer, {
        contentType: mime,
        upsert: false,
      })

    if (uploadErr) {
      console.error('[upload] storage error:', uploadErr.message)
      return NextResponse.json(
        { error: `Falha no armazenamento: ${uploadErr.message}` },
        { status: 500 }
      )
    }

    // 6. Create signed URL valid for 30 days
    const { data: signedData, error: signErr } = await admin.storage
      .from('recordings')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 30)

    if (signErr) {
      console.error('[upload] signed url error:', signErr.message)
    }

    const audio_url = signedData?.signedUrl ?? null

    // 7. Insert recording row via admin (parceiro_id is set explicitly)
    const { data: recording, error: insertErr } = await admin
      .from('call_recordings')
      .insert({
        call_history_id,
        lead_id,
        parceiro_id: userId,
        company_id: companyId,
        campanha_id,
        audio_url,
        file_name: file.name || `gravacao.${ext}`,
        file_size: file.size,
        mime_type: mime,
        duration_sec: 0,
        status: 'uploaded',
      })
      .select()
      .single()

    if (insertErr) {
      console.error('[upload] db insert error:', insertErr.message)
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    return NextResponse.json({ recording }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    console.error('[upload] unexpected error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
