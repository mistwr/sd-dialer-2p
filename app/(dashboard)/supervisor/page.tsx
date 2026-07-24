'use client'

import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useAuth } from '@/lib/hooks/useAuth'
import { Alert, LoadingSpinner } from '@/components/common'
import { Users, BarChart3, ArrowRight } from 'lucide-react'

export default function SupervisorDashboardPage() {
  const { profile, isSupervisor, loading } = useAuth()

  if (loading) {
    return (
      <DashboardLayout title="Dashboard">
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner message="A carregar..." />
        </div>
      </DashboardLayout>
    )
  }

  if (!isSupervisor()) {
    return (
      <DashboardLayout title="Acesso Negado">
        <Alert type="error" message="Apenas supervisores podem acessar este dashboard" />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Dashboard">
      <div className="space-y-6">
        <div>
          <h2 className="text-[18px] font-bold text-gray-900">
            Bom dia, {profile?.full_name?.split(' ')[0]}
          </h2>
          <p className="text-[13px] text-gray-500 mt-0.5">Resumo da tua equipa.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/supervisor/team"
            className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all group"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0 group-hover:bg-blue-100 transition-colors">
              <Users size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold text-gray-900">Minha Equipa</p>
              <p className="text-[12px] text-gray-500 mt-0.5">Visualizar e gerir comerciais</p>
            </div>
            <ArrowRight size={15} className="text-gray-300 group-hover:text-blue-500 transition-colors shrink-0" />
          </Link>

          <Link
            href="/supervisor/relatorios"
            className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all group"
          >
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0 group-hover:bg-emerald-100 transition-colors">
              <BarChart3 size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold text-gray-900">Relatórios</p>
              <p className="text-[12px] text-gray-500 mt-0.5">Análise de desempenho da equipa</p>
            </div>
            <ArrowRight size={15} className="text-gray-300 group-hover:text-blue-500 transition-colors shrink-0" />
          </Link>
        </div>
      </div>
    </DashboardLayout>
  )
}
