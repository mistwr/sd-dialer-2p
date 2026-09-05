'use client'
import useSWR from 'swr'
import { useState } from 'react'
import { ShoppingBag, Download, Clock, ShieldCheck, Filter } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { PageSpinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'

async function fetchAllVendas() {
  const sb = createClient()
  const { data, error } = await sb
    .from('vendas')
    .select('*, vendedor:seller_id(full_name, email)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  ativo: 'Ativo',
  cancelado: 'Cancelado',
}
const STATUS_COLOR: Record<string, string> = {
  pendente: '#D97706',
  aprovado: '#2563EB',
  ativo: '#16A34A',
  cancelado: '#DC2626',
}

function DocLink({ path, label }: { path: string | null; label: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const load = () => {
    if (url || !path) return
    const sb = createClient()
    sb.storage.from('documentos-vendas').createSignedUrl(path, 3600).then(({ data }) => setUrl(data?.signedUrl ?? null))
  }
  if (!path) return null
  return url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: '#2563EB', textDecoration: 'none' }}>
      <Download size={12} /> {label}
    </a>
  ) : (
    <button onClick={load} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
      <Download size={12} /> {label}
    </button>
  )
}

export default function AdminVendasPage() {
  const { profile, loading: authLoading } = useAuth()
  const isAllowed = profile?.role === 'admin' || profile?.role === 'supervisor' || profile?.is_super_admin
  const { data: vendas = [], isLoading } = useSWR(isAllowed ? 'admin-vendas' : null, fetchAllVendas)
  const [vendedorFiltro, setVendedorFiltro] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('')

  if (authLoading) return <PageSpinner />

  if (!isAllowed) {
    return (
      <div style={{ maxWidth: 500, margin: '60px auto' }}>
        <EmptyState icon={ShieldCheck} title="Acesso restrito" description="Esta página é apenas para administradores e supervisores." />
      </div>
    )
  }

  if (isLoading) return <PageSpinner />

  const vendedores = Array.from(new Set(vendas.map((v: any) => v.vendedor?.full_name).filter(Boolean))) as string[]

  const filtradas = vendas.filter((v: any) => {
    if (vendedorFiltro && v.vendedor?.full_name !== vendedorFiltro) return false
    if (statusFiltro && v.status !== statusFiltro) return false
    return true
  })

  const valorTotal = filtradas.reduce((sum: number, v: any) => sum + (Number(v.amount) || 0), 0)

  return (
    <div className="anim-fade-in" style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShoppingBag size={20} /> Vendas dos Parceiros
        </h1>
        <p style={{ fontSize: 13, color: '#64748B', margin: '4px 0 0' }}>
          {filtradas.length} venda{filtradas.length !== 1 ? 's' : ''} registada{filtradas.length !== 1 ? 's' : ''}
          {valorTotal > 0 ? ` · ${valorTotal.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}` : ''}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <Filter size={14} color="#94A3B8" />
        <select value={vendedorFiltro} onChange={e => setVendedorFiltro(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13 }}>
          <option value="">Todos os parceiros</option>
          {vendedores.map(nome => <option key={nome} value={nome}>{nome}</option>)}
        </select>
        <select value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13 }}>
          <option value="">Todos os estados</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {filtradas.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="Sem vendas para mostrar" description="Ainda não há vendas registadas com estes filtros." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtradas.map((v: any) => (
            <div key={v.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{v.client_name}</div>
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                    {v.service_type || '—'} {v.operator ? `· ${v.operator}` : ''} {v.plano ? `· ${v.plano}` : ''}
                    {v.amount ? ` · ${Number(v.amount).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}` : ''}
                  </div>
                  <div style={{ fontSize: 12, color: '#2563EB', marginTop: 4, fontWeight: 600 }}>
                    {v.vendedor?.full_name ?? 'Vendedor desconhecido'}
                  </div>
                </div>
                <Badge style={{ background: `${STATUS_COLOR[v.status] ?? '#94A3B8'}18`, color: STATUS_COLOR[v.status] ?? '#64748B' }}>
                  {STATUS_LABEL[v.status] ?? v.status}
                </Badge>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={11} /> {new Date(v.created_at).toLocaleDateString('pt-PT')}
                </span>
                <DocLink path={v.documento_url} label="Contrato" />
                <DocLink path={v.documento_extra_url} label="Comprovativo" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
