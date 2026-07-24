'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { LoadingSpinner, Alert } from '@/components/common'
import { useAuth } from '@/lib/hooks/useAuth'
import { reportService } from '@/lib/services/reports.service'
import useSWR from 'swr'

export default function AdminDashboardPage() {
  const { profile, isAdmin } = useAuth()
  const [companyId, setCompanyId] = useState<string>('')

  // Obter estatísticas
  const { data: stats, error: statsError, isLoading } = useSWR(
    companyId ? ['company-stats', companyId] : null,
    () => (companyId ? reportService.getCompanyStats(companyId) : Promise.resolve(null)),
    { revalidateOnFocus: false }
  )

  useEffect(() => {
    if (profile?.company_id) {
      setCompanyId(profile.company_id)
    }
  }, [profile])

  if (!isAdmin()) {
    return (
      <DashboardLayout title="Acesso Negado">
        <Alert type="error" message="Apenas administradores podem acessar este dashboard" />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Dashboard Admin">
      <div className="space-y-6">
        {/* Alerts */}
        {statsError && (
          <Alert
            type="error"
            title="Erro"
            message="Falha ao carregar estatísticas"
          />
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <LoadingSpinner message="Carregando dados..." />
          </div>
        )}

        {/* Stats Grid */}
        {!isLoading && stats?.data && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card: Utilizadores */}
              <div className="sd-card">
                <div className="sd-card-body">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Utilizadores Ativos</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">
                        {stats.data.total_usuarios}
                      </p>
                    </div>
                    <div className="text-3xl">👥</div>
                  </div>
                </div>
              </div>

              {/* Card: Leads */}
              <div className="sd-card">
                <div className="sd-card-body">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Total de Leads</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">
                        {stats.data.total_leads}
                      </p>
                    </div>
                    <div className="text-3xl">📋</div>
                  </div>
                </div>
              </div>

              {/* Card: Leads Pendentes */}
              <div className="sd-card">
                <div className="sd-card-body">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Leads Pendentes</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">
                        {stats.data.leads_contato_pendente}
                      </p>
                    </div>
                    <div className="text-3xl">⏳</div>
                  </div>
                </div>
              </div>

              {/* Card: Chamadas Hoje */}
              <div className="sd-card">
                <div className="sd-card-body">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Chamadas Hoje</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">
                        {stats.data.chamadas_hoje}
                      </p>
                    </div>
                    <div className="text-3xl">📞</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Segunda linha */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card: Tempo Total */}
              <div className="sd-card">
                <div className="sd-card-body">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Tempo Total Chamadas</p>
                      <p className="text-2xl font-bold text-gray-900 mt-2">
                        {Math.floor(stats.data.tempo_total_chamadas / 60)}m
                      </p>
                    </div>
                    <div className="text-3xl">⏱️</div>
                  </div>
                </div>
              </div>

              {/* Card: Vendas */}
              <div className="sd-card">
                <div className="sd-card-body">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Vendas Hoje</p>
                      <p className="text-3xl font-bold text-green-600 mt-2">
                        {stats.data.vendas_hoje}
                      </p>
                    </div>
                    <div className="text-3xl">💰</div>
                  </div>
                </div>
              </div>

              {/* Card: Comerciais */}
              <div className="sd-card">
                <div className="sd-card-body">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Comerciais</p>
                      <p className="text-3xl font-bold text-blue-600 mt-2">
                        {stats.data.total_comercials}
                      </p>
                    </div>
                    <div className="text-3xl">🎯</div>
                  </div>
                </div>
              </div>

              {/* Card: Vazio para grid */}
              <div />
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <a href="/dashboard/admin/usuarios" className="sd-card hover:shadow-md transition-shadow">
                <div className="sd-card-body">
                  <p className="font-semibold text-gray-900">Gerenciar Utilizadores</p>
                  <p className="text-sm text-gray-600 mt-1">Criar, editar ou remover utilizadores</p>
                </div>
              </a>

              <a href="/dashboard/admin/campanhas" className="sd-card hover:shadow-md transition-shadow">
                <div className="sd-card-body">
                  <p className="font-semibold text-gray-900">Criar Campanha</p>
                  <p className="text-sm text-gray-600 mt-1">Iniciar nova campanha de vendas</p>
                </div>
              </a>

              <a href="/dashboard/admin/leads" className="sd-card hover:shadow-md transition-shadow">
                <div className="sd-card-body">
                  <p className="font-semibold text-gray-900">Importar Leads</p>
                  <p className="text-sm text-gray-600 mt-1">Importar leads de arquivo Excel/CSV</p>
                </div>
              </a>

              <a href="/dashboard/admin/relatorios" className="sd-card hover:shadow-md transition-shadow">
                <div className="sd-card-body">
                  <p className="font-semibold text-gray-900">Ver Relatórios</p>
                  <p className="text-sm text-gray-600 mt-1">Análise detalhada de vendas e desempenho</p>
                </div>
              </a>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
