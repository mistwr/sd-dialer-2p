'use client'
import useSWR from 'swr'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { ShoppingBag, Plus, Download, Clock, CheckCircle, Hourglass, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { PageSpinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { StatCard } from '@/components/ui/StatCard'

const CRM_REPORT_URL = 'https://lblnhttwadvofhkhkbsv.supabase.co/functions/v1/sd-sales-report'

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

async function fetchCrmResumo(email: string) {
  const url = new URL(CRM_REPORT_URL)
  url.searchParams.set('seller_email', email)
  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) throw new Error('Nao foi possivel consultar o CRM Mae')
  return res.json()
}

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  ativo: 'Ativo',
  validado: 'Validado',
  cancelado: 'Cancelado',
  cancelada: 'Cancelada',
}
const STATUS_COLOR: Record<string, string> = {
  pendente: '#D97706',
  aprovado: '#2563EB',
  ativo: '#16A34A',
  validado: '#16A34A',
  cancelado: '#DC2626',
  cancelada: '#DC2626',
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
  const { data: crmResumo, isLoading: crmLoading } = useSWR(
    user?.email ? ['crm-mae-vendas', user.email] : null,
    () => fetchCrmResumo(user!.email!),
    { refreshInterval: 30000 }
  )

  if (authLoading || isLoading || crmLoading) return <PageSpinner />

  const byStatus = crmResumo?.by_status ?? {}
  const totalOficial = crmResumo?.total_sales ?? vendas.length
  const validadas = (byStatus.validado ?? 0) + (byStatus.validada ?? 0) + (byStatus.aprovado ?? 0) + (byStatus.ativo ?? 0)
  const pendentes = byStatus.pendente ?? 0
  const canceladas = (byStatus.cancelado ?? 0) + (byStatus.cancelada ?? 0)

  return (
    <div className="anim-fade-in" style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShoppingBag size={20} /> As Minhas Vendas
          </h1>
          <p style={{ fontSize: 13, color: '#64748B', margin: '4px 0 0' }}>
            {totalOficial} venda{totalOficial !== 1 ? 's' : ''} no CRM Mae · fonte oficial
          </p>
        </div>
        <Link href="/parceiro/vendas/nova" style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 10,
          background: '#2563EB', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none',
        }}>
          <Plus size={15} /> Nova Venda
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 22 }}>
        <StatCard label="Vendas CRM Mae" value={totalOficial} icon={ShoppingBag} color="#2563EB" />
        <StatCard label="Validadas/Ativas" value={validadas} icon={CheckCircle} color="#16A34A" />
        <StatCard label="Pendentes" value={pendentes} icon={Hourglass} color="#D97706" />
        <StatCard label="Canceladas" value={canceladas} icon={XCircle} color="#DC2626" />
      </div>

      <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, background: '#FFF7DD', color: '#8A6511', fontSize: 12, border: '1px solid #E9D48B' }}>
        O total acima vem diretamente do CRM Mae. Os cartoes abaixo sao apenas os registos detalhados que ainda existem no Lumin AI CRM.
      </div>

      {vendas.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="Sem registos locais no Lumin AI CRM" description="A tua producao oficial continua a ser contabilizada no CRM Mae acima." />
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
