import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/server/sd-dialer-livekit'

export const runtime = 'nodejs'

// Diz à app se a empresa do utilizador está desativada (período de teste terminado, etc.).
export async function GET(request: NextRequest) {
  try {
    const accessToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!accessToken) return NextResponse.json({ blocked: false })
    const admin = createAdminClient()
    const { data } = await admin.auth.getUser(accessToken)
    if (!data.user) return NextResponse.json({ blocked: false })
    const { data: profile } = await admin.from('usuarios').select('company_id,role,is_super_admin').eq('id', data.user.id).maybeSingle()
    if (!profile?.company_id || profile.is_super_admin === true || profile.role === 'super_admin') return NextResponse.json({ blocked: false })
    const { data: company } = await admin.from('companies').select('name,status').eq('id', profile.company_id).maybeSingle()
    return NextResponse.json({ blocked: company?.status === 'inactive', company: company?.name || '' })
  } catch {
    return NextResponse.json({ blocked: false })
  }
}
