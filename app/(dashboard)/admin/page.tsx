'use client'
import { useEffect, useState } from 'react'
import { Users, PhoneCall, TrendingUp, Building2, Clock, Trophy, Wifi, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { StatCard } from '@/components/ui/StatCard'
import { Badge } from '@/components/ui/Badge'
import { PageSpinner } from '@/components/ui/Spinner'

interface DashStats {
  totalEmpresas: number
  totalParceiros: number
  totalLeads: number
  leadsHoje: number
  chamadasHoje: number
  chamadasTotal: number
  vendasTotal: number
  tempoMedioSec: number
  tempoTotalSec: number
  conversao: number
  parceirosOnline: number
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

  useEffect(() => {
    if (authLoading || !profile) return
    const fetchStats = async () => {
      setLoading(true)
      try {
        const sb = createClient()
        const companyId = profile.company_id!
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)

        const [
          { count: totalEmpresas },
          { count: totalParceiros },
          { count: totalLeads },
          { count: chamadasHoje },
          { data: callData },
          { data: rankData },
          { data: onlineData },
        ] = await Promise.all([
          sb.from('companies').select('*', { count: 'exact', head: true }),
          sb.from('usuarios').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('role', 'parceiro'),
          sb.from('leads').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
          sb.from('call_history').select('*', { count: 'exact', head: true }).eq('company_id', companyId).gte('called_at', todayStart.toISOString()),
          sb.from('call_history').select('result, duration_sec, parceiro_id').eq('company_id', companyId),
          sb.from('call_history').select('parceiro_id, result, usuarios!parceiro_id(id,full_name,avatar_url)').eq('company_id', companyId),
          sb.from('usuarios').select('id').eq('company_id', companyId).eq('role', 'parceiro').gte('last_seen_at', new Date(Date.now() - 15 * 60 * 1000).toISOString()),
        ])

        const vendasTotal = callData?.filter(c => c.result === 'venda').length ?? 0
        const chamadasTotal = callData?.length ?? 0
        const tempoTotal = callData?.reduce((s, c) => s + (c.duration_sec ?? 0), 0) ?? 0
        const tempoMedio = chamadasTotal > 0 ? Math.round(tempoTotal / chamadasTotal) : 0
        const conversao = chamadasTotal > 0 ? Math.round((vendasTotal / chamadasTotal) * 100) : 0

        // Build ranking
        const parceiroMap: Record<string, { id: string; full_name: string; avatar_url: string | null; vendas: number; chamadas: number }> = {}
        rankData?.forEach((r: any) => {
          const u = r.usuarios
          if (!u) return
          if (!parceiroMap[u.id]) parceiroMap[u.id] = { id: u.id, full_name: u.full_name, avatar_url: u.avatar_url, vendas: 0, chamadas: 0 }
          parceiroMap[u.id].chamadas++
          if (r.result === 'venda') parceiroMap[u.id].vendas++
        })
        const ranking = Object.values(parceiroMap).sort((a, b) => b.vendas - a.vendas).slice(0, 5)

        setStats({
          totalEmpresas: totalEmpresas ?? 0,
          totalParceiros: totalParceiros ?? 0,
          totalLeads: totalLeads ?? 0,
          leadsHoje: 0,
          chamadasHoje: chamadasHoje ?? 0,
          chamadasTotal,
          vendasTotal,
          tempoMedioSec: tempoMedio,
          tempoTotalSec: tempoTotal,
          conversao,
          parceirosOnline: onlineData?.length ?? 0,
          ranking,
        })
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [profile, authLoading])

  if (authLoading || loading) return <PageSpinner />

  return (
    <div className="anim-fade-in" style={{ maxWidth: 1200 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.5px' }}>
          Dashboard
        </h1>
        <p style={{ color: '#64748B', fontSize: 14, margin: '4px 0 0' }}>
          Visao geral da plataforma
        </p>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
        <StatCard label="Empresas"         value={stats?.totalEmpresas ?? 0}  icon={Building2}   color="#6366F1" />
        <StatCard label="Parceiros"        value={stats?.totalParceiros ?? 0} icon={Users}        color="#2563EB" />
        <StatCard label="Total de Leads"   value={stats?.totalLeads ?? 0}     icon={PhoneCall}    color="#0891B2" />
        <StatCard label="Chamadas Hoje"    value={stats?.chamadasHoje ?? 0}   icon={PhoneCall}    color="#D97706" />
        <StatCard label="Chamadas Total"   value={stats?.chamadasTotal ?? 0}  icon={PhoneCall}    color="#64748B" />
        <StatCard label="Vendas"           value={stats?.vendasTotal ?? 0}    icon={CheckCircle}  color="#16A34A" />
        <StatCard label="Conversao"        value={`${stats?.conversao ?? 0}%`} icon={TrendingUp}  color="#16A34A" />
        <StatCard label="Tempo Medio"      value={fmtTime(stats?.tempoMedioSec ?? 0)} icon={Clock} color="#8B5CF6" />
        <StatCard label="Tempo Total"      value={fmtTime(stats?.tempoTotalSec ?? 0)} icon={Clock} color="#EC4899" />
        <StatCard label="Parceiros Online" value={stats?.parceirosOnline ?? 0} icon={Wifi}        color="#16A34A" />
      </div>

      {/* Ranking */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Trophy size={18} color="#D97706" />
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Ranking de Parceiros</h2>
        </div>
        {!stats?.ranking.length ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>
            Sem dados de chamadas ainda.
          </div>
        ) : (
          <div>
            {stats.ranking.map((p, i) => (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 24px', borderBottom: i < stats.ranking.length - 1 ? '1px solid #F1F5F9' : 'none',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: i === 0 ? '#FEF3C7' : i === 1 ? '#F1F5F9' : '#FFF7ED',
                  color: i === 0 ? '#D97706' : i === 1 ? '#64748B' : '#EA580C',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 800, flexShrink: 0,
                }}>
                  {i + 1}
                </div>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: '#EFF6FF', color: '#2563EB',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, flexShrink: 0,
                }}>
                  {p.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.full_name}</div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>{p.chamadas} chamadas</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#16A34A' }}>{p.vendas}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>vendas</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
