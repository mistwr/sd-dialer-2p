'use client'
import useSWR from 'swr'
import { useState } from 'react'
import Link from 'next/link'
import { Calendar, Phone, Wrench, CheckCircle2, Clock, AlertCircle, User, ChevronRight, Trash2, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { followUpService } from '@/lib/services'
import { formatDate, formatDateTimeShort } from '@/lib/utils/formatters'
import { PageSpinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'

async function fetchFollowUps(userId: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('follow_ups')
    .select('*, lead:lead_id(id,nome,telefone,campanha_id,campanhas(id,name),custom_fields,observacoes)')
    .eq('parceiro_id', userId)
    .eq('done', false)
    .order('scheduled_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

async function fetchInstalacoes(userId: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('vendas')
    .select('*')
    .eq('seller_id', userId)
    .not('data_instalacao', 'is', null)
    .neq('instalacao_status', 'concluida')
    .order('data_instalacao', { ascending: true })
  if (error) throw error
  return data ?? []
}

function classify(dateStr: string) {
  const today = new Date().toISOString().slice(0, 10)
  const d = dateStr.slice(0, 10)
  if (d < today) return 'atrasado'
  if (d === today) return 'hoje'
  return 'proximo'
}

const GROUP_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  atrasado: { label: 'Atrasados', color: '#DC2626', bg: '#FEF2F2' },
  hoje: { label: 'Hoje', color: '#D97706', bg: '#FFFBEB' },
  proximo: { label: 'Proximos', color: '#2563EB', bg: '#EFF6FF' },
}

export default function AgendaPage() {
  const { user, loading: authLoading } = useAuth()
  const [tab, setTab] = useState<'followups' | 'instalacoes'>('followups')
  const [filterCampanha, setFilterCampanha] = useState('all')
  const [search, setSearch] = useState('')

  const { data: followUps = [], isLoading: l1, mutate } = useSWR(
    user?.id ? ['agenda-fu', user.id] : null,
    () => fetchFollowUps(user!.id),
    { revalidateOnFocus: true, revalidateOnMount: true, dedupingInterval: 0, refreshInterval: 60000 }
  )
  const { data: instalacoes = [], isLoading: l2, mutate: mutateInst } = useSWR(
    user?.id ? ['agenda-inst', user.id] : null,
    () => fetchInstalacoes(user!.id),
    { revalidateOnFocus: true, revalidateOnMount: true, dedupingInterval: 0, refreshInterval: 60000 }
  )

  if (authLoading || l1 || l2) return <PageSpinner />

  const campanhasDisponiveis = Array.from(
    new Map(
      followUps.filter((fu: any) => fu.lead?.campanhas).map((fu: any) => [fu.lead.campanhas.id, fu.lead.campanhas.name])
    ).entries()
  )
  const followUpsFiltrados = (filterCampanha === 'all'
    ? followUps
    : followUps.filter((fu: any) => fu.lead?.campanha_id === filterCampanha)
  ).filter((fu: any) => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    const nome = (fu.lead?.nome ?? '').toLowerCase()
    const telefone = (fu.lead?.telefone ?? '').toLowerCase()
    const nif = ((fu.lead?.custom_fields as any)?.nif ?? '').toLowerCase()
    return nome.includes(q) || telefone.includes(q) || nif.includes(q)
  })

  const groups = { atrasado: [] as any[], hoje: [] as any[], proximo: [] as any[] }
  followUpsFiltrados.forEach((fu: any) => groups[classify(fu.scheduled_at) as keyof typeof groups].push(fu))
  // Atrasados: o mais recente (menos atrasado, mais perto de hoje) primeiro.
  // Hoje/Proximos: o mais proximo (data/hora mais cedo a seguir) primeiro —
  // e a data mais urgente a tratar, nao a mais distante no futuro.
  groups.atrasado.sort((a, b) => (a.scheduled_at < b.scheduled_at ? 1 : -1))
  groups.hoje.sort((a, b) => (a.scheduled_at < b.scheduled_at ? -1 : 1))
  groups.proximo.sort((a, b) => (a.scheduled_at < b.scheduled_at ? -1 : 1))

  const instGroups = { atrasado: [] as any[], hoje: [] as any[], proximo: [] as any[] }
  instalacoes.forEach(v => instGroups[classify(v.data_instalacao) as keyof typeof instGroups].push(v))

  const markDone = async (id: string) => {
    await followUpService.markDone(id)
    mutate()
  }

  const markInstalacaoDone = async (id: string) => {
    const sb = createClient()
    await sb.from('vendas').update({ instalacao_status: 'concluida' }).eq('id', id)
    mutateInst()
  }

  const deleteFollowUp = async (id: string) => {
    if (!confirm('Apagar este follow-up? Esta acao nao pode ser desfeita.')) return
    await followUpService.remove(id)
    mutate()
  }

  const clearInstalacao = async (id: string) => {
    if (!confirm('Remover esta instalacao da agenda? A venda mantem-se, so deixa de aparecer aqui.')) return
    const sb = createClient()
    await sb.from('vendas').update({ data_instalacao: null }).eq('id', id)
    mutateInst()
  }

  return (
    <div className="anim-fade-in" style={{ maxWidth: 700 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={20} /> Agenda
        </h1>
        <p style={{ fontSize: 13, color: '#64748B', margin: '4px 0 0' }}>Os teus follow-ups e instalacoes a acompanhar</p>
      </div>

      <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', borderRadius: 10, padding: 4, marginBottom: 16, width: 'fit-content' }}>
        {[
          { key: 'followups' as const, label: `Follow-ups (${followUpsFiltrados.length})`, icon: <Phone size={14} /> },
          { key: 'instalacoes' as const, label: `Instalacoes (${instalacoes.length})`, icon: <Wrench size={14} /> },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 7, border: 'none',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
              background: tab === t.key ? '#fff' : 'transparent',
              color: tab === t.key ? '#0F172A' : '#64748B',
              boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'followups' && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ position: 'relative' }}>
            <Search size={15} color="#94A3B8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar por nome, telefone ou NIF..."
              style={{
                width: '100%', padding: '10px 12px 10px 36px', borderRadius: 10,
                border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none',
                boxSizing: 'border-box', color: '#0F172A',
              }}
            />
          </div>
        </div>
      )}

      {tab === 'followups' && campanhasDisponiveis.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <select
            value={filterCampanha}
            onChange={e => setFilterCampanha(e.target.value)}
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #C7D2FE',
              background: '#EEF2FF', fontSize: 13, fontWeight: 700, color: '#3730A3',
              cursor: 'pointer', outline: 'none', appearance: 'none',
            }}
          >
            <option value="all">📋 Todos os follow-ups</option>
            {campanhasDisponiveis.map(([id, name]) => (
              <option key={id as string} value={id as string}>🎯 {name as string}</option>
            ))}
          </select>
        </div>
      )}

      {tab === 'followups' && (
        followUpsFiltrados.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="Sem follow-ups pendentes" description="Estas em dia! Novos follow-ups aparecem aqui assim que os agendares." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {(['atrasado', 'hoje', 'proximo'] as const).map(g => groups[g].length > 0 && (
              <div key={g}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  {g === 'atrasado' && <AlertCircle size={14} color={GROUP_LABEL[g].color} />}
                  {g === 'hoje' && <Clock size={14} color={GROUP_LABEL[g].color} />}
                  {g === 'proximo' && <Calendar size={14} color={GROUP_LABEL[g].color} />}
                  <span style={{ fontSize: 12, fontWeight: 700, color: GROUP_LABEL[g].color, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    {GROUP_LABEL[g].label} ({groups[g].length})
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {groups[g].map((fu: any) => (
                    <div key={fu.id} style={{ background: '#fff', borderRadius: 12, border: `1px solid ${GROUP_LABEL[g].bg === '#FEF2F2' ? '#FECACA' : '#E2E8F0'}`, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Link href={fu.lead?.id ? `/parceiro/leads/${fu.lead.id}` : '#'} style={{ flex: 1, minWidth: 0, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <User size={13} /> {fu.lead?.nome ?? 'Lead'}
                          </div>
                          <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                            {formatDateTimeShort(fu.scheduled_at)}
                            {fu.notes && <> &middot; {fu.notes}</>}
                          </div>
                          {(() => {
                            const cf = fu.lead?.custom_fields as Record<string, string> | undefined
                            const parts: string[] = []
                            if (cf?.tipo_ctt) parts.push(cf.tipo_ctt)
                            if (cf?.nome_empresa) parts.push(cf.nome_empresa)
                            if (cf?.nif) parts.push(`NIF ${cf.nif}`)
                            if (cf?.tipificacao) parts.push(cf.tipificacao)
                            if (cf?.pacote || cf?.pacote_atual) parts.push(cf.pacote ?? cf.pacote_atual)
                            if (cf?.data_fim_fidelizacao) parts.push(`Fideliza ate ${cf.data_fim_fidelizacao.slice(8,10)}/${cf.data_fim_fidelizacao.slice(5,7)}/${cf.data_fim_fidelizacao.slice(0,4)}`)
                            if (fu.lead?.observacoes) parts.push(fu.lead.observacoes)
                            if (parts.length === 0) return null
                            return (
                              <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 3, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                {parts.map((p, i) => (
                                  <span key={i} style={{ background: '#F8FAFC', border: '1px solid #F1F5F9', borderRadius: 999, padding: '1px 8px' }}>{p}</span>
                                ))}
                              </div>
                            )
                          })()}
                        </div>
                        <ChevronRight size={15} color="#CBD5E1" style={{ flexShrink: 0 }} />
                      </Link>
                      {fu.lead?.telefone && (
                        <a href={`tel:${fu.lead.telefone}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: '#EFF6FF', color: '#2563EB', flexShrink: 0 }}>
                          <Phone size={14} />
                        </a>
                      )}
                      <button onClick={() => markDone(fu.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: '#F0FDF4', color: '#16A34A', border: 'none', cursor: 'pointer', flexShrink: 0 }} title="Marcar como feito">
                        <CheckCircle2 size={14} />
                      </button>
                      <button onClick={() => deleteFollowUp(fu.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: '#FEF2F2', color: '#DC2626', border: 'none', cursor: 'pointer', flexShrink: 0 }} title="Apagar follow-up">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'instalacoes' && (
        instalacoes.length === 0 ? (
          <EmptyState icon={Wrench} title="Sem instalacoes agendadas" description="Quando registares uma venda com data de instalacao, aparece aqui." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {(['atrasado', 'hoje', 'proximo'] as const).map(g => instGroups[g].length > 0 && (
              <div key={g}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: GROUP_LABEL[g].color, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    {GROUP_LABEL[g].label} ({instGroups[g].length})
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {instGroups[g].map((v: any) => (
                    <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: '12px 14px' }}>
                      {v.lead_id ? (
                        <Link href={`/parceiro/leads/${v.lead_id}`} style={{ flex: 1, minWidth: 0, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{v.client_name}</div>
                            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                              Instalacao: {formatDate(v.data_instalacao)} &middot; {v.service_type || 'Servico'} {v.operator ? `· ${v.operator}` : ''}
                            </div>
                          </div>
                          <ChevronRight size={15} color="#CBD5E1" style={{ flexShrink: 0 }} />
                        </Link>
                      ) : (
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{v.client_name}</div>
                          <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                            Instalacao: {formatDate(v.data_instalacao)} &middot; {v.service_type || 'Servico'} {v.operator ? `· ${v.operator}` : ''}
                          </div>
                        </div>
                      )}
                      <button onClick={() => markInstalacaoDone(v.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: '#F0FDF4', color: '#16A34A', border: 'none', cursor: 'pointer', flexShrink: 0 }} title="Marcar instalacao como concluida">
                        <CheckCircle2 size={14} />
                      </button>
                      <button onClick={() => clearInstalacao(v.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: '#FEF2F2', color: '#DC2626', border: 'none', cursor: 'pointer', flexShrink: 0 }} title="Remover da agenda">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
