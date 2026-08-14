'use client'
import useSWR from 'swr'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { ShoppingBag, Plus, Download, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { PageSpinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'

async function fetchVendas(userId: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('vendas')
    .select('*')
    .eq('seller_id', userId)
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
  useEffect(() => {
    if (!path) return
    const sb = createClient()
    sb.storage.from('documentos-vendas').createSignedUrl(path, 3600).then(({ data }) => setUrl(data?.signedUrl ?? null))
  }, [path])
  if (!path) return null
  return url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: '#2563EB', textDecoration: 'none' }}>
      <Download size={12} /> {label}
    </a>
  ) : null
}

export default function VendasPage() {
  const { user, loading: authLoading } = useAuth()
  const { data: vendas = [], isLoading } = useSWR(user?.id ? ['vendas', user.id] : null, () => fetchVendas(user!.id))

  if (authLoading || isLoading) return <PageSpinner />

  return (
    <div className="anim-fade-in" style={{ maxWidth: 800 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShoppingBag size={20} /> As Minhas Vendas
          </h1>
          <p style={{ fontSize: 13, color: '#64748B', margin: '4px 0 0' }}>{vendas.length} venda{vendas.length !== 1 ? 's' : ''} registada{vendas.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/parceiro/vendas/nova" style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 10,
          background: '#2563EB', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none',
        }}>
          <Plus size={15} /> Nova Venda
        </Link>
      </div>

      {vendas.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="Ainda sem vendas registadas" description="Regista a tua primeira venda para começares a acompanhar aqui." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {vendas.map((v: any) => (
            <div key={v.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{v.client_name}</div>
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                    {v.service_type || '—'} {v.operator ? `· ${v.operator}` : ''} {v.plano ? `· ${v.plano}` : ''}
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
