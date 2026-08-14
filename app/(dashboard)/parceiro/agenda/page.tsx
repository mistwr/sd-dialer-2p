'use client'
import useSWR from 'swr'
import { useState } from 'react'
import Link from 'next/link'
import { Calendar, Phone, Wrench, CheckCircle2, Clock, AlertCircle, User, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { PageSpinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'

async function fetchFollowUps(userId: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('follow_ups')
    .select('*, lead:lead_id(id,nome,telefone)')
    .eq('parceiro_id', userId)
    .eq('done', false)
    .order('scheduled_at', { ascending: true })
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

  const { data: followUps = [], isLoading: l1, mutate } = useSWR(user?.id ? ['agenda-fu', user.id] : null, () => fetchFollowUps(user!.id))
  const { data: instalacoes = [], isLoading: l2 } = useSWR(user?.id ? ['agenda-inst', user.id] : null, () => fetchInstalacoes(user!.id))

  if (authLoading || l1 || l2) return <PageSpinner />

  const groups = { atrasado: [] as any[], hoje: [] as any[], proximo: [] as any[] }
  followUps.forEach(fu => groups[classify(fu.scheduled_at) as keyof typeof groups].push(fu))

  const instGroups = { atrasado: [] as any[], hoje: [] as any[], proximo: [] as any[] }
  instalacoes.forEach(v => instGroups[classify(v.data_instalacao) as keyof typeof instGroups].push(v))

  const markDone = async (id: string) => {
    const sb = createClient()
    await sb.from('follow_ups').update({ done: true }).eq('id', id)
    mutate()
  }

  return (
    <div className="anim-fade-in" style={{ maxWidth: 700 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={20} /> Agenda
        </h1>
        <p style={{ fontSize: 13, color: '#64748B', margin: '4px 0 0' }}>Os teus follow-ups e instalacoes a acompanhar</p>
      </div>

      <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', borderRadius: 10, padding: 4, marginBottom: 20, width: 'fit-content' }}>
        {[
          { key: 'followups' as const, label: `Follow-ups (${followUps.length})`, icon: <Phone size={14} /> },
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
        followUps.length === 0 ? (
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
                            {new Date(fu.scheduled_at).toLocaleString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            {fu.notes && <> &middot; {fu.notes}</>}
                          </div>
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
                    v.lead_id ? (
                      <Link key={v.id} href={`/parceiro/leads/${v.lead_id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: '12px 14px', textDecoration: 'none' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{v.client_name}</div>
                          <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                            Instalacao: {new Date(v.data_instalacao).toLocaleDateString('pt-PT')} &middot; {v.service_type || 'Servico'} {v.operator ? `· ${v.operator}` : ''}
                          </div>
                        </div>
                        <ChevronRight size={15} color="#CBD5E1" style={{ flexShrink: 0 }} />
                      </Link>
                    ) : (
                      <div key={v.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: '12px 14px' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{v.client_name}</div>
                        <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                          Instalacao: {new Date(v.data_instalacao).toLocaleDateString('pt-PT')} &middot; {v.service_type || 'Servico'} {v.operator ? `· ${v.operator}` : ''}
                        </div>
                      </div>
                    )
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
