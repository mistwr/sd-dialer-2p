'use client'

import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Alert } from '@/components/common'
import { useAuth } from '@/lib/hooks/useAuth'

export default function SupervisorDashboardPage() {
  const { profile, isSupervisor } = useAuth()

  if (!isSupervisor()) {
    return (
      <DashboardLayout title="Acesso Negado">
        <Alert type="error" message="Apenas supervisores podem acessar este dashboard" />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Dashboard Supervisor">
      <div className="space-y-6">
        <div className="sd-card">
          <div className="sd-card-body">
            <h2 className="text-lg font-semibold mb-4">Bem-vindo, {profile?.full_name}!</h2>
            <p className="text-gray-600">
              Este é seu dashboard de supervisor. Aqui você pode gerenciar sua equipa, visualizar leads e acompanhar o desempenho.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <a href="/dashboard/supervisor/team" className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                <p className="font-semibold">👥 Minha Equipa</p>
                <p className="text-sm text-gray-600 mt-1">Visualizar e gerenciar comerciais</p>
              </a>

              <a href="/dashboard/supervisor/leads" className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                <p className="font-semibold">📋 Leads</p>
                <p className="text-sm text-gray-600 mt-1">Ver leads da sua equipa</p>
              </a>

              <a href="/dashboard/supervisor/relatorios" className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                <p className="font-semibold">📈 Relatórios</p>
                <p className="text-sm text-gray-600 mt-1">Análise de desempenho da equipa</p>
              </a>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
