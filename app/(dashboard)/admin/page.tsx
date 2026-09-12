'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Users, PhoneCall, TrendingUp, Building2, Clock, Trophy, Wifi, CheckCircle, AlertTriangle, ShoppingBag } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { StatCard } from '@/components/ui/StatCard'
import { PageSpinner } from '@/components/ui/Spinner'

const CRM_SALES_REPORT = 'https://lblnhttwadvofhkhkbsv.supabase.co/functions/v1/sd-sales-report'

interface DashStats {
  totalEmpresas: number
  totalParceiros: number
  totalLeads: number
  chamadasHoje: number
  chamadasTotal: number
  vendasTotal: number
  vendasMarcadasDialer: number
  tempoMedioSec: number
  tempoTotalSec: number
  conversao: number
  parceirosOnline: number
  negativosSemana: number
  ranking: { id: string; full_name: string; vendas: number; chamadas: number; avatar_url: string | null }[]
}

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export default function AdminDashboard() {
  const { profile, loading: authLoading } = useAuth()
  const [stats, setStats] = useState<DashStats | null>(null)
  const [loading, setLoading] = useState(true)
  const pathname = usePathname()

  useEffect(() => {
    if (authLoading || !profile) return

    const fetchStats = async () => {
      setLoading(true)
      try {
        const sb = createClient()
        const companyId = profile.company_id!
        const isSuperAdmin = !!(profile as any).is_super_admin
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
        const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

        let qParceiros = sb.from('usuarios').select('*', { count: 'exact', head: true }).eq('role', 'parceiro')
        let qLeads = sb.from('leads').select('*', { count: 'exact', head: true })
        let qChamadasHoje = sb.from('call_history').select('*', { count: 'exact', head: true }).gte('called_at', todayStart.toISOString())
        let qNegativos = sb.from('call_history').select('*', { count: 'exact', head: true }).eq('ai_sentiment', 'negativo').gte('called_at', weekStart.toISOString())
        let qCallData = sb.from('call_history').select('result,duration_sec,parceiro_id')
        let qUsers = sb.from('usuarios').select('id,email,full_name,avatar_url,company_id').eq('role', 'parceiro')
        let qOnline = sb.from('usuarios').select('id').eq('role', 'parceiro').gte('last_seen_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())

        if (!isSuperAdmin) {
          qParceiros = qParceiros.eq('company_id', companyId)
          qLeads = qLeads.eq('company_id', companyId)
          qChamadasHoje = qChamadasHoje.eq('company_id', companyId)
          qNegativos = qNegativos.eq('company_id', companyId)
          qCallData = qCallData.eq('company_id', companyId)
          qUsers = qUsers.eq('company_id', companyId)
          qOnline = qOnline.eq('company_id', companyId)
        }

        const [
          { count: totalEmpresas },
          { count: totalParceiros },
          { count: totalLeads },
          { count: chamadasHoje },
          { count: negativosSemana },
          { data: callData },
          { data: usersData },
          { data: onlineData },
          crmRes,
        ] = await Promise.all([
          sb.from('companies').select('*', { count: 'exact', head: true }),
          qParceiros,
          qLeads,
          qChamadasHoje,
          qNegativos,
          qCallData,
          qUsers,
          qOnline,
          fetch(CRM_SALES_REPORT, { cache: 'no-store' }).catch(() => null),
        ])

        const crm = crmRes?.ok ? await crmRes.json().catch(() => null) : null
        const chamadasTotal = callData?.length ?? 0
        const vendasMarcadasDialer = callData?.filter(c => c.result === 'venda').length ?? 0
        const vendasTotal = typeof crm?.total_sales === 'number' ? crm.total_sales : vendasMarcadasDialer
        const tempoTotal = callData?.reduce((s, c) => s + (c.duration_sec ?? 0), 0) ?? 0
        const tempoMedio = chamadasTotal > 0 ? Math.round(tempoTotal / chamadasTotal) : 0
        const conversao = chamadasTotal > 0 ? Number(((vendasTotal / chamadasTotal) * 100).toFixed(1)) : 0

        const callsByUser = new Map<string, number>()
        callData?.forEach((c: any) => callsByUser.set(c.parceiro_id, (callsByUser.get(c.parceiro_id) ?? 0) + 1))

        const crmByEmail = new Map<string, number>()
        for (const s of crm?.by_seller ?? []) {
          if (s.email) crmByEmail.set(String(s.email).toLowerCase(), Number(s.sales ?? 0))
        }

        const ranking = (usersData ?? []).map((u: any) => ({
          id: u.id,
          full_name: u.full_name,
          avatar_url: u.avatar_url,
          chamadas: callsByUser.get(u.id) ?? 0,
          vendas: crmByEmail.get(String(u.email ?? '').toLowerCase()) ?? 0,
        })).sort((a: any, b: any) => b.vendas - a.vendas || b.chamadas - a.chamadas).slice(0, 5)

        setStats({
          totalEmpresas: totalEmpresas ?? 0,
          totalParceiros: totalParceiros ?? 0,
          totalLeads: totalLeads ?? 0,
          chamadasHoje: chamadasHoje ?? 0,
          chamadasTotal,
          vendasTotal,
          vendasMarcadasDialer,
          tempoMedioSec: tempoMedio,
          tempoTotalSec: tempoTotal,
          conversao,
          parceirosOnline: onlineData?.length ?? 0,
          negativosSemana: negativosSemana ?? 0,
          ranking,
        })
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
    window.addEventListener('focus', fetchStats)
    return () => window.removeEventListener('focus', fetchStats)
  }, [profile, authLoading, pathname])

  if (authLoading || loading) return <PageSpinner />

  return (
    <div className="anim-fade-in" style={{ maxWidth: 1200 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.5px' }}>Dashboard</h1>
            {(profile as any)?.is_super_admin && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', background: '#F5F3FF', padding: '3px 10px', borderRadius: 999, border: '1px solid #DDD6FE' }}>Todas as empresas</span>
            )}
          </div>
          <p style={{ color: '#64748B', fontSize: 14, margin: '4px 0 0' }}>Chamadas do SD Dialer + vendas oficiais do CRM Mãe</p>
        </div>
        <Link href="/admin/vendas" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, textDecoration: 'none', padding: '9px 14px', borderRadius: 9, background: '#16A34A', color: '#fff', fontSize: 13, fontWeight: 700 }}>
          <ShoppingBag size={16} /> Ver vendas CRM
        </Link>
      </div>

      {(stats?.negativosSemana ?? 0) > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, padding: '14px 18px', borderRadius: 12, background: '#FEF2F2', border: '1px solid #FECACA' }}>
          <AlertTriangle size={20} color="#DC2626" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#991B1B' }}>{stats!.negativosSemana} chamada{stats!.negativosSemana !== 1 ? 's' : ''} com sentimento negativo esta semana</div>
            <div style={{ fontSize: 12, color: '#DC2626', marginTop: 2 }}>Revê o histórico e intervém antes de perder a oportunidade.</div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 16, marginBottom: 28 }}>
        <StatCard label="Empresas" value={stats?.totalEmpresas ?? 0} icon={Building2} color="#6366F1" />
        <StatCard label="Parceiros" value={stats?.totalParceiros ?? 0} icon={Users} color="#2563EB" />
        <StatCard label="Total de Leads" value={stats?.totalLeads ?? 0} icon={PhoneCall} color="#0891B2" />
        <StatCard label="Chamadas Hoje" value={stats?.chamadasHoje ?? 0} icon={PhoneCall} color="#D97706" />
        <StatCard label="Chamadas Total" value={stats?.chamadasTotal ?? 0} icon={PhoneCall} color="#64748B" />
        <StatCard label="Vendas CRM Mãe" value={stats?.vendasTotal ?? 0} icon={CheckCircle} color="#16A34A" />
        <StatCard label="Marcadas no Dialer" value={stats?.vendasMarcadasDialer ?? 0} icon={ShoppingBag} color="#0F766E" />
        <StatCard label="Conversão Real" value={`${stats?.conversao ?? 0}%`} icon={TrendingUp} color="#16A34A" />
        <StatCard label="Tempo Médio" value={fmtTime(stats?.tempoMedioSec ?? 0)} icon={Clock} color="#8B5CF6" />
        <StatCard label="Tempo Total" value={fmtTime(stats?.tempoTotalSec ?? 0)} icon={Clock} color="#EC4899" />
        <StatCard label="Parceiros Online" value={stats?.parceirosOnline ?? 0} icon={Wifi} color="#16A34A" />
      </div>

      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Trophy size={18} color="#D97706" />
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Ranking por vendas reais</h2>
        </div>
        {!stats?.ranking.length ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>Sem dados ainda.</div>
        ) : (
          <div>
            {stats.ranking.map((p, i) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 24px', borderBottom: i < stats.ranking.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: i === 0 ? '#FEF3C7' : '#F1F5F9', color: i === 0 ? '#D97706' : '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.full_name}</div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>{p.chamadas} chamadas</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#16A34A' }}>{p.vendas}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>vendas CRM</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
