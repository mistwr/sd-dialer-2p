'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { Users, PhoneCall, Shuffle, CheckCircle2, AlertCircle, UserCheck } from 'lucide-react'
import { leadService, usuarioService } from '@/lib/services'
import { useAuth } from '@/lib/hooks/useAuth'
import { PageSpinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'

export default function DistribuicaoPage() {
  const { profile } = useAuth()
  const [distributing, setDistributing] = useState(false)
  const [result, setResult] = useState<{ assigned: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data: unassigned = [], isLoading: loadingLeads, mutate } = useSWR(
    'unassigned-leads',
    () => leadService.getAll({ assigned_to: 'null' }).catch(() => [])
  )
  const { data: allLeads = [], mutate: mutateAll } = useSWR(
    'all-leads-dist',
    () => leadService.getAll().catch(() => [])
  )
  const { data: parceiros = [], isLoading: loadingParceiros } = useSWR(
    profile?.company_id ? ['parceiros', profile.company_id] : null,
    () => usuarioService.getByCompany(profile!.company_id!).then(u => u.filter(x => x.role === 'parceiro' && x.status === 'active'))
  )

  const handleAutoDistribute = async () => {
    if (!parceiros.length || !unassigned.length) return
    setDistributing(true); setError(null); setResult(null)
    try {
      // Round-robin distribution
      let assigned = 0
      const batchSize = Math.ceil(unassigned.length / parceiros.length)
      for (let i = 0; i < parceiros.length; i++) {
        const batch = unassigned.slice(i * batchSize, (i + 1) * batchSize)
        if (!batch.length) break
        await leadService.assign(batch.map(l => l.id), parceiros[i].id)
        assigned += batch.length
      }
      setResult({ assigned })
      mutate(); mutateAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao distribuir')
    } finally {
      setDistributing(false)
    }
  }

  const isLoading = loadingLeads || loadingParceiros

  return (
    <div className="anim-fade-in" style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0 }}>Distribuicao de Leads</h1>
        <p style={{ color: '#64748B', fontSize: 14, margin: '4px 0 0' }}>Atribua leads automaticamente aos parceiros ativos</p>
      </div>

      {isLoading ? <PageSpinner /> : (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 28 }}>
            {[
              { label: 'Leads por Atribuir', value: unassigned.length, color: '#D97706', bg: '#FFFBEB' },
              { label: 'Parceiros Ativos', value: parceiros.length, color: '#2563EB', bg: '#EFF6FF' },
              { label: 'Por Parceiro', value: parceiros.length ? Math.ceil(unassigned.length / parceiros.length) : 0, color: '#16A34A', bg: '#F0FDF4' },
            ].map(s => (
              <div key={s.label} style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ fontSize: 30, fontWeight: 800, color: s.color, marginBottom: 4 }}>{s.value}</div>
                <div style={{ fontSize: 13, color: '#64748B', fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Auto distribute button */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: '24px', marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Distribuicao Automatica</h2>
            <p style={{ color: '#64748B', fontSize: 14, margin: '0 0 20px' }}>
              Distribui todas as leads nao atribuidas pelos parceiros ativos de forma equitativa (round-robin).
            </p>
            {result && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#F0FDF4', borderRadius: 8, marginBottom: 16 }}>
                <CheckCircle2 size={16} color="#16A34A" />
                <span style={{ fontSize: 13, color: '#166534', fontWeight: 600 }}>{result.assigned} leads distribuidas com sucesso</span>
              </div>
            )}
            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#FEF2F2', borderRadius: 8, marginBottom: 16 }}>
                <AlertCircle size={16} color="#DC2626" />
                <span style={{ fontSize: 13, color: '#991B1B' }}>{error}</span>
              </div>
            )}
            <button
              onClick={handleAutoDistribute}
              disabled={distributing || !unassigned.length || !parceiros.length}
              style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '12px 24px', borderRadius: 10, border: 'none',
                background: (!unassigned.length || !parceiros.length) ? '#94A3B8' : '#2563EB',
                color: '#fff', fontWeight: 700, fontSize: 15, cursor: (!unassigned.length || !parceiros.length) ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
              }}
            >
              <Shuffle size={18} />
              {distributing ? 'A distribuir...' : `Distribuir ${unassigned.length} Leads`}
            </button>
            {!parceiros.length && (
              <p style={{ margin: '12px 0 0', fontSize: 13, color: '#94A3B8' }}>Nao existem parceiros ativos para distribuir.</p>
            )}
          </div>

          {/* Parceiros status */}
          {parceiros.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0F172A' }}>Parceiros Ativos</h2>
                <span style={{ fontSize: 12, color: '#64748B' }}>{parceiros.length} parceiro{parceiros.length !== 1 ? 's' : ''}</span>
              </div>
              {parceiros.map((p, i) => {
                const pLeads = allLeads.filter(l => l.assigned_to === p.id)
                const pSold  = pLeads.filter(l => l.status === 'vendido').length
                return (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px',
                    borderBottom: i < parceiros.length - 1 ? '1px solid #F1F5F9' : 'none',
                  }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                      {p.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{p.full_name}</div>
                      <div style={{ fontSize: 12, color: '#94A3B8' }}>{p.email}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#2563EB' }}>{pLeads.length}</div>
                        <div style={{ fontSize: 10, color: '#94A3B8' }}>leads</div>
                      </div>
                      <div style={{ width: 1, height: 28, background: '#E2E8F0' }} />
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#16A34A' }}>{pSold}</div>
                        <div style={{ fontSize: 10, color: '#94A3B8' }}>vendas</div>
                      </div>
                      <div style={{ width: 1, height: 28, background: '#E2E8F0' }} />
                      <Badge value={p.status} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
