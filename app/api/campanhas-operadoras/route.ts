import { NextResponse } from 'next/server'
import { campanhasUser } from '@/lib/server/campanhas-auth'

// Catálogo partilhado de campanhas das operadoras (carregado pelo super admin) + campanhas próprias da empresa.
const CATALOGO = process.env.CATALOGO_COMPANY_ID || 'e27c8324-989a-4a68-b3a3-902cba74696c'

export async function GET() {
  const ctx = await campanhasUser()
  if (!ctx) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
  const { data, error } = await ctx.admin
    .from('campanhas_operadoras')
    .select('id, title, description, operator, service_type, status, published_at, campanhas_operadoras_ficheiros(id, file_name, file_type, file_size)')
    .in('company_id', Array.from(new Set([ctx.me.company_id, CATALOGO])))
    .eq('status', 'ativa')
    .order('published_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ campanhas: data ?? [] })
}
