'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useAuth } from '@/lib/hooks/useAuth'
import { reportService } from '@/lib/services/reports.service'
import useSWR from 'swr'
import {
  Users,
  ClipboardList,
  Phone,
  TrendingUp,
  Clock,
  ShoppingCart,
  Target,
  ArrowRight,
  AlertCircle,
  Loader2,
} from 'lucide-react'

function StatCard({
  label,
  value,
  icon,
  color,
  trend,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  color: string
  trend?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[12.5px] font-medium text-gray-500 uppercase tracking-wide">{label}</p>
          <p className="text-[28px] font-bold text-gray-900 mt-1.5 leading-none">{value}</p>
          {trend && (
            <p className="text-[12px] text-gray-400 mt-1.5">{trend}</p>
          )}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
    </div>
  )
}

function QuickAction({
  href,
  label,
  description,
  icon,
}: {
  href: string
  label: string
  description: string
  icon: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all group"
    >
      <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0 group-hover:bg-blue-100 transition-colors">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold text-gray-900">{label}</p>
        <p className="text-[12px] text-gray-500 mt-0.5">{description}</p>
      </div>
      <ArrowRight size={15} className="text-gray-300 group-hover:text-blue-500 transition-colors shrink-0" />
    </Link>
  )
}

export default function AdminDashboardPage() {
  const { profile, isAdmin, loading } = useAuth()
  const [companyId, setCompanyId] = useState<string>('')

  const { data: stats, error: statsError, isLoading: statsLoading } = useSWR(
    companyId ? ['company-stats', companyId] : null,
    () => (companyId ? reportService.getCompanyStats(companyId) : Promise.resolve(null)),
    { revalidateOnFocus: false }
  )

  useEffect(() => {
    if (profile?.company_id) {
      setCompanyId(profile.company_id)
    }
  }, [profile])

  // Aguardar carregamento do perfil
  if (loading) {
    return (
      <DashboardLayout title="Dashboard">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-blue-500" size={32} />
        </div>
      </DashboardLayout>
    )
  }

  if (!isAdmin()) {
    return (
      <DashboardLayout title="Acesso Negado">
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          <AlertCircle size={18} />
          <p className="text-sm">Apenas administradores podem aceder a este dashboard.</p>
        </div>
      </DashboardLayout>
    )
  }

  const s = stats?.data

  return (
    <DashboardLayout title="Dashboard">
      <div className="space-y-6">

        {/* Welcome row */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[18px] font-bold text-gray-900">
              Bom dia, {profile?.full_name?.split(' ')[0]} 
            </h2>
            <p className="text-[13px] text-gray-500 mt-0.5">
              Aqui tens um resumo da actividade da empresa.
            </p>
          </div>
          <div className="text-[12px] text-gray-400 hidden sm:block">
            {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>

        {/* Stats error */}
        {statsError && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
            <AlertCircle size={16} />
            <p className="text-sm">Falha ao carregar estatísticas.</p>
          </div>
        )}

        {/* Stats grid */}
        {statsLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
                <div className="h-3 bg-gray-100 rounded w-24 mb-3" />
                <div className="h-7 bg-gray-100 rounded w-16" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Utilizadores Ativos"
                value={s?.total_usuarios ?? '—'}
                icon={<Users size={18} className="text-blue-600" />}
                color="bg-blue-50"
              />
              <StatCard
                label="Total de Leads"
                value={s?.total_leads ?? '—'}
                icon={<ClipboardList size={18} className="text-violet-600" />}
                color="bg-violet-50"
              />
              <StatCard
                label="Chamadas Hoje"
                value={s?.chamadas_hoje ?? '—'}
                icon={<Phone size={18} className="text-emerald-600" />}
                color="bg-emerald-50"
              />
              <StatCard
                label="Vendas Hoje"
                value={s?.vendas_hoje ?? '—'}
                icon={<TrendingUp size={18} className="text-amber-600" />}
                color="bg-amber-50"
              />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Leads Pendentes"
                value={s?.leads_contato_pendente ?? '—'}
                icon={<Target size={18} className="text-orange-600" />}
                color="bg-orange-50"
              />
              <StatCard
                label="Tempo Total"
                value={s ? `${Math.floor(s.tempo_total_chamadas / 60)}m` : '—'}
                icon={<Clock size={18} className="text-sky-600" />}
                color="bg-sky-50"
              />
              <StatCard
                label="Comerciais"
                value={s?.total_comercials ?? '—'}
                icon={<Users size={18} className="text-indigo-600" />}
                color="bg-indigo-50"
              />
              <StatCard
                label="Campanhas Ativas"
                value={s?.campanhas_ativas ?? '—'}
                icon={<ShoppingCart size={18} className="text-pink-600" />}
                color="bg-pink-50"
              />
            </div>
          </>
        )}

        {/* Quick actions */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Acesso Rápido</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <QuickAction
              href="/admin/usuarios"
              label="Gerir Utilizadores"
              description="Criar, editar ou remover utilizadores"
              icon={<Users size={17} />}
            />
            <QuickAction
              href="/admin/campanhas"
              label="Campanhas"
              description="Criar e gerir campanhas de vendas"
              icon={<Target size={17} />}
            />
            <QuickAction
              href="/admin/leads"
              label="Leads"
              description="Visualizar e distribuir leads"
              icon={<ClipboardList size={17} />}
            />
            <QuickAction
              href="/admin/relatorios"
              label="Relatórios"
              description="Análise detalhada de desempenho"
              icon={<TrendingUp size={17} />}
            />
          </div>
        </div>

      </div>
    </DashboardLayout>
  )
}
