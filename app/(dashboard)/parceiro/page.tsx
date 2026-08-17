'use client'
import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import {
  PhoneCall, Search, ChevronRight, Clock, User,
  CheckCircle2, PhoneOff, PhoneMissed, AlertCircle,
  Calendar, Wifi, HelpCircle, Filter, Bell,
} from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAuth } from '@/lib/hooks/useAuth'
import { leadService, followUpService } from '@/lib/services'
import type { Lead, LeadStatus, FollowUp } from '@/lib/types'

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
  const [filterCampanha, setFilterCampanha] = useState<string>('all')

  const { data: leads = [], isLoading } = useSWR(
    user ? ['parceiro-leads', user.id] : null,
    () => leadService.getAssigned(user!.id),
    { revalidateOnFocus: true }
  )

  const { data: followUps = [], mutate: mutateFollowUps } = useSWR(
    user ? ['follow-ups', user.id] : null,
    () => followUpService.getUpcoming(user!.id),
    { revalidateOnFocus: true }
  )

  if (authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <Spinner size={32} />
      </div>
    )
  }

  const today = new Date().toISOString().slice(0, 10)
  const isAgendadaFutura = (l: Lead) => {
    const dpc = (l as any).custom_fields?.data_proximo_ctt as string | undefined
    return !!dpc && dpc.slice(0, 10) > today
  }

  const leadsProntas = leads.filter(l => !isAgendadaFutura(l))
  const leadsAgendadas = leads.filter(isAgendadaFutura)

  const filtered = leadsProntas.filter(l => {
    const matchSearch =
      !search ||
      l.nome.toLowerCase().includes(search.toLowerCase()) ||
      l.telefone.includes(search) ||
      (l.localidade ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || l.status === filterStatus
    const matchCampanha = filterCampanha === 'all' || l.campanha_id === filterCampanha || (filterCampanha === 'sem' && !l.campanha_id)
    return matchSearch && matchStatus && matchCampanha
  })

  // Lista de campanhas presentes nas leads deste parceiro, para o seletor
  const campanhasDisponiveis = Array.from(
    new Map(
      leadsProntas.filter(l => (l as any).campanhas).map(l => [(l as any).campanhas.id, (l as any).campanhas.name])
    ).entries()
  )
  const temLeadsSemCampanha = leadsProntas.some(l => !l.campanha_id)

  // Next lead: first priority status, then others
  const nextLead =
    filtered.find(l => PRIORITY_STATUSES.includes(l.status)) ?? filtered[0] ?? null

  const counts = leadsProntas.reduce((acc, l) => {
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

        {/* Follow-up reminders */}
        {followUps.length > 0 && (
          <div style={{ background: '#FFFBEB', borderRadius: 12, border: '1px solid #FDE68A', padding: '14px 16px', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Bell size={15} color="#D97706" />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#92400E' }}>
                {followUps.length} follow-up{followUps.length !== 1 ? 's' : ''} pendente{followUps.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {followUps.slice(0, 3).map(fu => {
                const d = new Date(fu.scheduled_at)
                const isOverdue = d < new Date()
                return (
                  <div key={fu.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Link href={`/parceiro/leads/${fu.lead_id}`} style={{
                      flex: 1, textDecoration: 'none',
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: '#fff', borderRadius: 8, padding: '10px 12px',
                      border: `1px solid ${isOverdue ? '#FECACA' : '#FDE68A'}`,
                    }}>
                      <Calendar size={13} color={isOverdue ? '#DC2626' : '#D97706'} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {(fu.lead as any)?.nome ?? 'Lead'}
                        </div>
                        <div style={{ fontSize: 11, color: isOverdue ? '#DC2626' : '#D97706', marginTop: 1 }}>
                          {isOverdue ? 'Atrasado — ' : ''}
                          {d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })} {d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </Link>
                    <button
                      onClick={async () => { await followUpService.markDone(fu.id); mutateFollowUps() }}
                      style={{
                        background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8,
                        padding: '8px 10px', cursor: 'pointer', color: '#16A34A',
                        display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <CheckCircle2 size={13} /> Feito
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Campanha: em qual lista estou a ligar agora */}
        {campanhasDisponiveis.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>
              A ligar para
            </label>
            <select
              value={filterCampanha}
              onChange={e => setFilterCampanha(e.target.value)}
              style={{
                width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #C7D2FE',
                background: '#EEF2FF', fontSize: 14, fontWeight: 700, color: '#3730A3',
                cursor: 'pointer', outline: 'none', appearance: 'none',
              }}
            >
              <option value="all">📋 Todas as minhas leads</option>
              {campanhasDisponiveis.map(([id, name]) => (
                <option key={id} value={id}>🎯 {name}</option>
              ))}
              {temLeadsSemCampanha && <option value="sem">📥 Sem campanha</option>}
            </select>
          </div>
        )}

        {leadsAgendadas.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
            padding: '10px 14px', borderRadius: 10, background: '#FFFBEB', border: '1px solid #FDE68A',
          }}>
            <Calendar size={14} color="#D97706" />
            <span style={{ fontSize: 12.5, color: '#92400E' }}>
              <strong>{leadsAgendadas.length}</strong> lead{leadsAgendadas.length !== 1 ? 's' : ''} agendada{leadsAgendadas.length !== 1 ? 's' : ''} para o futuro — não aparecem aqui ainda, vão surgir automaticamente na data marcada.
            </span>
          </div>
        )}

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
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {lead.nome}
                        {lead.origem === 'porta' && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#EA580C', background: '#FFF7ED', padding: '1px 7px', borderRadius: 999, flexShrink: 0 }}>
                            🚪 Porta
                          </span>
                        )}
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
