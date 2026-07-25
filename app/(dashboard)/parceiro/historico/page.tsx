'use client'
import { useState } from 'react'
import useSWR from 'swr'
import {
  History, Phone, CheckCircle2, PhoneOff, PhoneMissed,
  AlertCircle, Calendar, Wifi, HelpCircle, Clock,
  TrendingUp, Search, Filter,
} from 'lucide-react'
import { callHistoryService } from '@/lib/services'
import { PageSpinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAuth } from '@/lib/hooks/useAuth'
import type { CallResult } from '@/lib/types'

const RESULT_CONFIG: Record<CallResult, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  venda:           { label: 'Venda',          color: '#16A34A', bg: '#F0FDF4', Icon: CheckCircle2 },
  nao_interessado: { label: 'Nao Interessado', color: '#DC2626', bg: '#FEF2F2', Icon: PhoneOff },
  nao_atende:      { label: 'Nao Atende',      color: '#6B7280', bg: '#F9FAFB', Icon: PhoneMissed },
  numero_errado:   { label: 'Numero Errado',   color: '#7C3AED', bg: '#F5F3FF', Icon: AlertCircle },
  ligar_depois:    { label: 'Ligar Depois',    color: '#0891B2', bg: '#ECFEFF', Icon: Calendar },
  sem_cobertura:   { label: 'Sem Cobertura',   color: '#EA580C', bg: '#FFF7ED', Icon: Wifi },
  outro:           { label: 'Outro',           color: '#6B7280', bg: '#F9FAFB', Icon: HelpCircle },
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
}

export default function HistoricoPage() {
  const { user, profile } = useAuth()
  const [search, setSearch] = useState('')
  const [resultFilter, setResultFilter] = useState<CallResult | ''>('')

  const { data: history = [], isLoading } = useSWR(
    user?.id ? ['call-history-all', user.id] : null,
    () => callHistoryService.getByParceiro(user!.id),
    { revalidateOnFocus: false }
  )

  const filtered = history.filter(h => {
    const matchResult = !resultFilter || h.result === resultFilter
    const matchSearch = !search || (h.lead as any)?.nome?.toLowerCase().includes(search.toLowerCase()) || (h.lead as any)?.telefone?.includes(search)
    return matchResult && matchSearch
  })

  // Stats
  const totalCalls   = history.length
  const totalSales   = history.filter(h => h.result === 'venda').length
  const totalDurSec  = history.reduce((s, h) => s + h.duration_sec, 0)
  const conversion   = totalCalls > 0 ? ((totalSales / totalCalls) * 100).toFixed(1) : '0.0'
  const avgDur       = totalCalls > 0 ? Math.round(totalDurSec / totalCalls) : 0

  function fmtTotal(s: number) {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    if (h > 0) return `${h}h ${m}m`
    return `${m}m`
  }

  return (
    <div className="anim-fade-in" style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0 }}>Historico de Chamadas</h1>
        <p style={{ color: '#64748B', fontSize: 14, margin: '3px 0 0' }}>Todas as chamadas registadas</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Chamadas', value: totalCalls, color: '#2563EB', Icon: Phone },
          { label: 'Vendas',         value: totalSales, color: '#16A34A', Icon: CheckCircle2 },
          { label: 'Conversao',      value: `${conversion}%`, color: '#0891B2', Icon: TrendingUp },
          { label: 'Tempo Total',    value: fmtTotal(totalDurSec), color: '#D97706', Icon: Clock },
          { label: 'Media/Chamada',  value: formatDuration(avgDur), color: '#7C3AED', Icon: Clock },
        ].map(s => (
          <div key={s.label} style={{
            background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0',
            padding: '16px', display: 'flex', flexDirection: 'column', gap: 8,
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>{s.label}</span>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <s.Icon size={13} color={s.color} />
              </div>
            </div>
            <span style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input
            placeholder="Pesquisar nome ou telefone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '9px 12px 9px 32px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            onFocus={e => e.target.style.borderColor = '#2563EB'}
            onBlur={e => e.target.style.borderColor = '#E2E8F0'}
          />
        </div>
        <select
          value={resultFilter}
          onChange={e => setResultFilter(e.target.value as CallResult | '')}
          style={{ padding: '9px 12px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', background: '#fff', color: resultFilter ? '#0F172A' : '#94A3B8' }}
        >
          <option value="">Resultado: Todos</option>
          {Object.entries(RESULT_CONFIG).map(([key, { label }]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {isLoading ? <PageSpinner /> : !filtered.length ? (
        <EmptyState
          icon={History}
          title="Nenhuma chamada encontrada"
          description={totalCalls === 0 ? 'As suas chamadas registadas aparecerao aqui.' : 'Tente ajustar os filtros.'}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(h => {
            const cfg = RESULT_CONFIG[h.result as CallResult] ?? RESULT_CONFIG.outro
            const Icon = cfg.Icon
            return (
              <div key={h.id} style={{
                background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0',
                padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'flex-start',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: cfg.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={18} color={cfg.color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 14, color: '#0F172A' }}>
                        {(h.lead as any)?.nome ?? 'Lead removida'}
                      </span>
                      {(h.lead as any)?.telefone && (
                        <span style={{ fontSize: 12, color: '#94A3B8', marginLeft: 8 }}>{(h.lead as any).telefone}</span>
                      )}
                    </div>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center',
                      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30`,
                      whiteSpace: 'nowrap',
                    }}>
                      {cfg.label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#64748B', fontSize: 12 }}>
                      <Calendar size={11} />
                      {formatDate(h.called_at)} {formatTime(h.called_at)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#64748B', fontSize: 12 }}>
                      <Clock size={11} />
                      {formatDuration(h.duration_sec)}
                    </div>
                  </div>
                  {h.notes && (
                    <div style={{ fontSize: 12, color: '#64748B', marginTop: 6, fontStyle: 'italic', background: '#F8FAFC', padding: '6px 10px', borderRadius: 6 }}>
                      {h.notes}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
