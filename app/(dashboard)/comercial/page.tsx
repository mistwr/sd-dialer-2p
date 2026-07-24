'use client'

import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Alert } from '@/components/common'
import { useAuth } from '@/lib/hooks/useAuth'

export default function ComercialDashboardPage() {
  const { profile, isComercial } = useAuth()

  if (!isComercial()) {
    return (
      <DashboardLayout title="Acesso Negado">
        <Alert type="error" message="Apenas comerciais podem acessar este dashboard" />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Área do Comercial">
      <div className="space-y-6">
        <div className="sd-card">
          <div className="sd-card-body">
            <h2 className="text-lg font-semibold mb-4">Bem-vindo, {profile?.full_name}!</h2>
            <p className="text-gray-600">
              Bem-vindo à sua área de trabalho. Aqui você pode visualizar seus leads e fazer chamadas.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <a href="/dashboard/comercial/leads" className="p-4 border border-blue-200 bg-blue-50 rounded-lg hover:shadow-md transition-shadow">
                <p className="font-semibold text-blue-900">📋 Meus Leads</p>
                <p className="text-sm text-blue-700 mt-1">Ver e ligar para seus leads</p>
              </a>

              <a href="/dashboard/comercial/history" className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                <p className="font-semibold">📞 Histórico</p>
                <p className="text-sm text-gray-600 mt-1">Ver histórico de chamadas</p>
              </a>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
