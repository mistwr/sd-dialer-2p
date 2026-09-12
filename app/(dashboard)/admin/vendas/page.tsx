'use client'

import { useEffect, useMemo, useState } from 'react'
import { ShoppingBag, CheckCircle2, Clock3, XCircle, Users, Building2 } from 'lucide-react'
import { PageSpinner } from '@/components/ui/Spinner'
import { StatCard } from '@/components/ui/StatCard'

const CRM_SALES_REPORT = 'https://lblnhttwadvofhkhkbsv.supabase.co/functions/v1/sd-sales-report'

function todayStr() { return new Date().toISOString().slice(0, 10) }
function pastStr(days: number) {
  const d = new Date(); d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

type Seller = { user_id: string; email: string | null; full_name: string; sales: number }
type Report = {
  total_sales: number
  by_seller: Seller[]
  by_status: Record<string, number>
  by_operator: Record<string, number>
}

export default function AdminVendasPage() {
  const [from, setFrom] = useState(pastStr(30))
  const [to, setTo] = useState(todayStr())
  const [data, setData] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`${CRM_SALES_REPORT}?from=${from}&to=${to}`, { cache: 'no-store' })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Falha ao carregar vendas')
        setData(json)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao carregar vendas')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [from, to])

  const status = data?.by_status ?? {}
  const validadas = useMemo(() => Object.entries(status).filter(([k]) => ['validado','validada','concluido','concluida','ativo','ativa'].includes(k.toLowerCase())).reduce((s,[,v]) => s + v, 0), [status])
  const pendentes = useMemo(() => Object.entries(status).filter(([k]) => k.toLowerCase().includes('pendent')).reduce((s,[,v]) => s + v, 0), [status])
  const canceladas = useMemo(() => Object.entries(status).filter(([k]) => k.toLowerCase().includes('cancel')).reduce((s,[,v]) => s + v, 0), [status])

  return (
    <div className="anim-fade-in" style={{ maxWidth: 1100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', margin: 0 }}>Vendas CRM Mãe</h1>
          <p style={{ color: '#64748B', fontSize: 14, margin: '4px 0 0' }}>Fonte oficial de produção. O SD Dialer deixa de depender apenas das vendas marcadas nas chamadas.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ padding: '8px 10px', border: '1px solid #CBD5E1', borderRadius: 8 }} />
          <span style={{ color: '#94A3B8' }}>até</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ padding: '8px 10px', border: '1px solid #CBD5E1', borderRadius: 8 }} />
        </div>
      </div>

      {loading ? <PageSpinner /> : error ? (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', padding: 16, borderRadius: 12 }}>{error}</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14, marginBottom: 24 }}>
            <StatCard label="Vendas CRM" value={data?.total_sales ?? 0} icon={ShoppingBag} color="#16A34A" />
            <StatCard label="Validadas" value={validadas} icon={CheckCircle2} color="#15803D" />
            <StatCard label="Pendentes" value={pendentes} icon={Clock3} color="#D97706" />
            <StatCard label="Canceladas" value={canceladas} icon={XCircle} color="#DC2626" />
            <StatCard label="Comerciais com vendas" value={data?.by_seller?.filter(x => x.sales > 0).length ?? 0} icon={Users} color="#2563EB" />
            <StatCard label="Operadores" value={Object.keys(data?.by_operator ?? {}).length} icon={Building2} color="#7C3AED" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18 }}>
            <section style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '16px 18px', borderBottom: '1px solid #F1F5F9', fontWeight: 800, color: '#0F172A' }}>Ranking de comerciais</div>
              {(data?.by_seller ?? []).length === 0 ? (
                <div style={{ padding: 28, color: '#94A3B8', textAlign: 'center' }}>Sem vendas neste período.</div>
              ) : (
                data!.by_seller.map((s, i) => (
                  <div key={s.user_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px', borderBottom: i < data!.by_seller.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: i === 0 ? '#FEF3C7' : '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: i === 0 ? '#D97706' : '#64748B' }}>{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.full_name}</div>
                      <div style={{ fontSize: 12, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.email ?? 'Sem email associado'}</div>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#16A34A' }}>{s.sales}</div>
                  </div>
                ))
              )}
            </section>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <section style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ padding: '16px 18px', borderBottom: '1px solid #F1F5F9', fontWeight: 800, color: '#0F172A' }}>Estados</div>
                {Object.entries(data?.by_status ?? {}).map(([name, count], i, arr) => (
                  <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 18px', borderBottom: i < arr.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                    <span style={{ color: '#475569', textTransform: 'capitalize' }}>{name.replaceAll('_', ' ')}</span>
                    <strong style={{ color: '#0F172A' }}>{count}</strong>
                  </div>
                ))}
              </section>

              <section style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ padding: '16px 18px', borderBottom: '1px solid #F1F5F9', fontWeight: 800, color: '#0F172A' }}>Por operador</div>
                {Object.entries(data?.by_operator ?? {}).map(([name, count], i, arr) => (
                  <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 18px', borderBottom: i < arr.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                    <span style={{ color: '#475569' }}>{name}</span>
                    <strong style={{ color: '#0F172A' }}>{count}</strong>
                  </div>
                ))}
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
