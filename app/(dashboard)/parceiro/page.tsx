'use client'
import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import {
  PhoneCall, Search, ChevronRight, Clock, User,
  CheckCircle2, PhoneOff, PhoneMissed, AlertCircle,
  Calendar, Wifi, HelpCircle, Filter,
} from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAuth } from '@/lib/hooks/useAuth'
import { leadService } from '@/lib/services'
import type { Lead, LeadStatus } from '@/lib/types'

const STATUS_META: Record<LeadStatus, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  novo:            { label: 'Novo',           color: '#2563EB', bg: '#EFF6FF', Icon: PhoneCall },
  contactado:      { label: 'Contactado',     color: '#D97706', bg: '#FFFBEB', Icon: PhoneCall },
  vendido:         { label: 'Vendido',        color: '#16A34A', bg: '#F0FDF4', Icon: CheckCircle2 },
  nao_interessado: { label: 'Nao Interessado',color: '#DC2626', bg: '#FEF2F2', Icon: PhoneOff },
  nao_atende:      { label: 'Nao Atende',     color: '#6B7280', bg: '#F9FAFB', Icon: PhoneMissed },
  numero_errado:   { label: 'Num. Errado',    color: '#7C3AED', bg: '#F5F3FF', Icon: AlertCircle },
  ligar_depois:    { label: 'Ligar Depois',   color: '#0891B2', bg: '#ECFEFF', Icon: Calendar },
  sem_cobertura:   { label: 'Sem Cobertura',  color: '#EA580C', bg: '#FFF7ED', Icon: Wifi },
  outro:           { label: 'Outro',          color: '#6B7280', bg: '#F9FAFB', Icon: HelpCircle },
}

const PRIORITY_STATUSES: LeadStatus[] = ['novo', 'ligar_depois', 'contactado']

export default function ParceiroDashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<LeadStatus | 'all'>('all')

  const { data: leads = [], isLoading } = useSWR(
    user ? ['parceiro-leads', user.id] : null,
    () => leadService.getAssigned(user!.id),
    { revalidateOnFocus: true }
  )

  if (authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <Spinner size={32} />
      </div>
    )
  }

  const filtered = leads.filter(l => {
    const matchSearch =
      !search ||
      l.nome.toLowerCase().includes(search.toLowerCase()) ||
      l.telefone.includes(search) ||
      (l.localidade ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || l.status === filterStatus
    return matchSearch && matchStatus
  })

  // Next lead: first priority status, then others
  const nextLead =
    filtered.find(l => PRIORITY_STATUSES.includes(l.status)) ?? filtered[0] ?? null

  const counts = leads.reduce((acc, l) => {
    acc[l.status] = (acc[l.status] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const statuses: { key: LeadStatus | 'all'; label: string }[] = [
    { key: 'all', label: `Todas (${leads.length})` },
    { key: 'novo', label: `Novas (${counts['novo'] ?? 0})` },
    { key: 'ligar_depois', label: `Follow-up (${counts['ligar_depois'] ?? 0})` },
    { key: 'contactado', label: `Contactadas (${counts['contactado'] ?? 0})` },
    { key: 'vendido', label: `Vendidas (${counts['vendido'] ?? 0})` },
  ]

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }} className="anim-fade-in">

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', margin: 0 }}>Minhas Leads</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748B' }}>
            {leads.length} leads atribuidas
          </p>
        </div>

        {/* Next Lead CTA */}
        {nextLead && (
          <Link href={`/parceiro/leads/${nextLead.id}`} style={{ textDecoration: 'none', display: 'block', marginBottom: 20 }}>
            <div style={{
              background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
              borderRadius: 14, padding: '18px 20px',
              display: 'flex', alignItems: 'center', gap: 16,
              boxShadow: '0 8px 24px rgba(37,99,235,0.25)',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'
                ;(e.currentTarget as HTMLElement).style.boxShadow = '0 12px 32px rgba(37,99,235,0.35)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
                ;(e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(37,99,235,0.25)'
              }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: 'rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <PhoneCall size={22} color="#fff" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 500, letterSpacing: '0.05em', marginBottom: 2 }}>
                  PROXIMA LEAD
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {nextLead.nome}
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 1 }}>
                  {nextLead.telefone}
                  {nextLead.localidade && ` · ${nextLead.localidade}`}
                </div>
              </div>
              <ChevronRight size={20} color="rgba(255,255,255,0.7)" />
            </div>
          </Link>
        )}

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'Total', value: leads.length, color: '#2563EB' },
            { label: 'Vendas', value: counts['vendido'] ?? 0, color: '#16A34A' },
            { label: 'Pendentes', value: (counts['novo'] ?? 0) + (counts['ligar_depois'] ?? 0), color: '#D97706' },
            { label: 'Nao Atende', value: counts['nao_atende'] ?? 0, color: '#6B7280' },
          ].map(s => (
            <div key={s.label} style={{
              flex: '1 1 80px', background: '#fff', borderRadius: 10,
              border: '1px solid #E2E8F0', padding: '12px 14px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Search + Filter */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px', position: 'relative' }}>
            <Search size={15} color="#94A3B8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              placeholder="Pesquisar nome, telefone, localidade..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', paddingLeft: 36, paddingRight: 12, paddingTop: 9, paddingBottom: 9,
                borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, outline: 'none',
                background: '#fff', boxSizing: 'border-box', color: '#0F172A',
              }}
            />
          </div>
          <div style={{ position: 'relative' }}>
            <Filter size={14} color="#94A3B8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as LeadStatus | 'all')}
              style={{
                paddingLeft: 28, paddingRight: 32, paddingTop: 9, paddingBottom: 9,
                borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13,
                background: '#fff', cursor: 'pointer', outline: 'none', color: '#0F172A', appearance: 'none',
              }}
            >
              {statuses.map(s => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Leads list */}
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Spinner size={28} />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={PhoneCall}
            title="Nenhuma lead encontrada"
            description={search || filterStatus !== 'all' ? 'Tente ajustar os filtros' : 'Ainda nao tens leads atribuidas'}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(lead => {
              const meta = STATUS_META[lead.status]
              const Icon = meta.Icon
              return (
                <Link key={lead.id} href={`/parceiro/leads/${lead.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0',
                    padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14,
                    transition: 'all 0.15s', cursor: 'pointer',
                  }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = '#2563EB'
                      ;(e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(37,99,235,0.1)'
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = '#E2E8F0'
                      ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
                    }}
                  >
                    {/* Status icon */}
                    <div style={{
                      width: 40, height: 40, borderRadius: 10,
                      background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <Icon size={18} color={meta.color} />
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {lead.nome}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748B', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>{lead.telefone}</span>
                        {lead.localidade && <><span style={{ color: '#CBD5E1' }}>·</span><span>{lead.localidade}</span></>}
                        {lead.operador && <><span style={{ color: '#CBD5E1' }}>·</span><span>{lead.operador}</span></>}
                      </div>
                    </div>

                    {/* Badge */}
                    <div style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                      color: meta.color, background: meta.bg, whiteSpace: 'nowrap', flexShrink: 0,
                    }}>
                      {meta.label}
                    </div>

                    <ChevronRight size={16} color="#CBD5E1" style={{ flexShrink: 0 }} />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
  )
}
