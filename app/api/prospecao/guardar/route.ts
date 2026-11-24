import { NextRequest, NextResponse } from 'next/server'
import { campanhasUser } from '@/lib/server/campanhas-auth'

export const dynamic = 'force-dynamic'

const clip = (v: unknown, n: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n)

function telPT(raw: unknown): string | null {
  let d = String(raw ?? '').replace(/\D/g, '')
  if (d.startsWith('00351')) d = d.slice(5)
  else if (d.startsWith('351') && d.length === 12) d = d.slice(3)
  return /^[239]\d{8}$/.test(d) ? d : null
}

// Guarda negócios escolhidos pelo comercial como leads dele (status novo).
export async function POST(req: NextRequest) {
  const ctx = await campanhasUser()
  if (!ctx) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as { negocios?: any[] }
  const lista = Array.isArray(body.negocios) ? body.negocios.slice(0, 30) : []
  if (!lista.length) return NextResponse.json({ error: 'Nada para guardar.' }, { status: 400 })

  const linhas: any[] = []
  for (const n of lista) {
    const tel = telPT(n?.telefone)
    const nome = clip(n?.nome, 100)
    if (!tel || !nome) continue
    const obs = ['Pesquisa IA (empresas)', n?.sugestao ? `Sugestão: ${clip(n.sugestao, 220)}` : '', n?.site ? `Site: ${clip(n.site, 200)}` : '', n?.redes ? `Redes: ${clip(n.redes, 200)}` : '', n?.fonte_url ? `Fonte: ${clip(n.fonte_url, 200)}` : '']
      .filter(Boolean).join('\n')
    linhas.push({
      company_id: ctx.me.company_id, assigned_to: ctx.me.id, nome, telefone: tel,
      email: clip(n?.email, 100) || null, morada: clip(n?.morada, 160) || null, localidade: clip(n?.localidade, 60) || null,
      observacoes: obs, status: 'novo', origem: 'outro', skip_auto_assign: true, imported_at: new Date().toISOString(),
    })
  }
  if (!linhas.length) return NextResponse.json({ error: 'Nenhum tem telefone válido.' }, { status: 400 })

  const { data: ja } = await ctx.admin.from('leads').select('telefone')
    .eq('company_id', ctx.me.company_id).in('telefone', linhas.map((l) => l.telefone))
  const existentes = new Set((ja || []).map((x: any) => x.telefone))
  const novas = linhas.filter((l) => !existentes.has(l.telefone))
  if (novas.length) {
    const { error } = await ctx.admin.from('leads').insert(novas)
    if (error) return NextResponse.json({ error: 'Não foi possível guardar.' }, { status: 500 })
  }
  return NextResponse.json({ guardadas: novas.length, repetidas: linhas.length - novas.length })
}
