import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

// Lista as gravações das chamadas de IA terminadas depois de "since", com link temporário (1 h),
// para o Google Apps Script do Miguel as guardar na pasta do Google Drive.
// Protegido por RECORDINGS_EXPORT_TOKEN (query ?token= ou header x-export-token).

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BUCKET = 'voice-recordings'
// O egress só fecha o ficheiro uns segundos depois de a chamada acabar.
const SETTLE_MS = 3 * 60 * 1000

export async function GET(req: NextRequest) {
  const expected = process.env.RECORDINGS_EXPORT_TOKEN || ''
  const token = req.nextUrl.searchParams.get('token') || req.headers.get('x-export-token') || ''
  if (!expected || token !== expected) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const since = req.nextUrl.searchParams.get('since') || new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const until = new Date(Date.now() - SETTLE_MS).toISOString()
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || 40), 100)

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: calls, error } = await admin
    .from('voice_calls')
    .select('id, ended_at, created_at, client_name, phone_number, status, interest_level, recording_url, duration_seconds')
    .like('recording_url', `${BUCKET}/%`)
    .gt('ended_at', since)
    .lte('ended_at', until)
    .order('ended_at', { ascending: true })
    .limit(limit)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const items = []
  for (const c of calls || []) {
    const path = String(c.recording_url).slice(BUCKET.length + 1)
    const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(path, 3600)
    items.push({
      id: c.id,
      ended_at: c.ended_at,
      started_at: c.created_at,
      client_name: c.client_name,
      phone: c.phone_number,
      status: c.status,
      interest: c.interest_level,
      duration: c.duration_seconds,
      url: signed?.signedUrl || null,
    })
  }
  return NextResponse.json({ items, until })
}
