import { NextResponse } from 'next/server'
import { campanhasUser } from '@/lib/server/campanhas-auth'

export async function GET() {
  const ctx = await campanhasUser()
  if (!ctx) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
  const { data, error } = await ctx.admin
    .from('campanhas_operadoras')
    .select('id, title, description, operator, service_type, status, published_at, campanhas_operadoras_ficheiros(id, file_name, file_type, file_size)')
    .eq('company_id', ctx.me.company_id)
    .eq('status', 'ativa')
    .order('published_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ campanhas: data ?? [] })
}
