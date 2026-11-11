import { NextRequest, NextResponse } from 'next/server'
import { campanhasUser } from '@/lib/server/campanhas-auth'

export async function GET(req: NextRequest) {
  const ctx = await campanhasUser()
  if (!ctx) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id') || ''
  const { data: f } = await ctx.admin
    .from('campanhas_operadoras_ficheiros')
    .select('source_path, campanhas_operadoras!inner(company_id)')
    .eq('id', id)
    .maybeSingle()
  const owner = (f as any)?.campanhas_operadoras?.company_id
  if (!f || owner !== ctx.me.company_id) return NextResponse.json({ error: 'Ficheiro nao encontrado' }, { status: 404 })
  const url = process.env.CAMPANHAS_SIGN_URL
  const token = process.env.CAMPANHAS_SIGN_TOKEN
  if (!url || !token) return NextResponse.json({ error: 'Servico de ficheiros nao configurado' }, { status: 503 })
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-sd-token': token },
    body: JSON.stringify({ path: (f as any).source_path }),
  })
  if (!r.ok) return NextResponse.json({ error: 'Nao foi possivel abrir o ficheiro' }, { status: 502 })
  const { url: signed } = await r.json()
  return NextResponse.redirect(signed)
}
