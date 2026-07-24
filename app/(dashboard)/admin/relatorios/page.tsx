'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { LoadingSpinner, Alert } from '@/components/common'
import { useAuth } from '@/lib/hooks/useAuth'
import { reportService } from '@/lib/services'
import useSWR from 'swr'

export default function RelatóriosPage() {
  const { profile, isAdmin } = useAuth()
  const [companyId, setCompanyId] = useState<string>('')

  useEffect(() => {
    if (profile?.company_id) {
      setCompanyId(profile.company_id)
    }
  }, [profile])

  const { data: statsData, isLoading: statsLoading } = useSWR(
    companyId ? ['company-stats', companyId] : null,
    () => (companyId ? reportService.getCompanyStats(companyId) : Promise.resolve(null)),
    { revalidateOnFocus: false }
  )

  const { data: rankingData, isLoading: rankingLoading } = useSWR(
    companyId ? ['commercial-ranking', companyId] : null,
    () => (companyId ? reportService.getComercialRanking(companyId) : Promise.resolve(null)),
    { revalidateOnFocus: false }
  )

  if (!isAdmin()) {
    return (
      <DashboardLayout title="Acesso Negado">
        <Alert type="error" message="Apenas administradores podem acessar" />
      </DashboardLayout>
    )
  }

  const stats = statsData?.data
  const ranking = rankingData?.data || []

  return (
    <DashboardLayout title="Relatórios & Analytics">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Análise de Desempenho</h2>
          <p className="text-gray-600 mt-1">Métricas da empresa</p>
        </div>

        {/* Loading State */}
        {(statsLoading || rankingLoading) && (
          <div className="flex justify-center py-12">
            <LoadingSpinner message="Carregando relatórios..." />
          </div>
        )}

        {!statsLoading && stats && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="sd-card">
                <div className="sd-card-body">
                  <p className="text-sm text-gray-600">Chamadas Hoje</p>
                  <p className="text-3xl font-bold text-blue-600 mt-2">{stats.chamadas_hoje}</p>
                </div>
              </div>

              <div className="sd-card">
                <div className="sd-card-body">
                  <p className="text-sm text-gray-600">Vendas Hoje</p>
                  <p className="text-3xl font-bold text-green-600 mt-2">{stats.vendas_hoje}</p>
                </div>
              </div>

              <div className="sd-card">
                <div className="sd-card-body">
                  <p className="text-sm text-gray-600">Tempo Total</p>
                  <p className="text-3xl font-bold text-purple-600 mt-2">
                    {Math.floor(stats.tempo_total_chamadas / 60)}m
                  </p>
                </div>
              </div>

              <div className="sd-card">
                <div className="sd-card-body">
                  <p className="text-sm text-gray-600">Leads Pendentes</p>
                  <p className="text-3xl font-bold text-orange-600 mt-2">
                    {stats.leads_contato_pendente}
                  </p>
                </div>
              </div>
            </div>

            {/* Summary Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Key Metrics */}
              <div className="sd-card">
                <div className="sd-card-body">
                  <h3 className="text-lg font-semibold mb-4 text-gray-900">Métricas Principais</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Total de Leads</span>
                      <span className="font-semibold text-gray-900">{stats.total_leads}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Total de Utilizadores</span>
                      <span className="font-semibold text-gray-900">{stats.total_usuarios}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Comerciais Ativos</span>
                      <span className="font-semibold text-gray-900">{stats.total_comercials}</span>
                    </div>
                    <div className="border-t border-gray-200 pt-3 mt-3 flex justify-between items-center">
                      <span className="text-gray-600 font-medium">Taxa de Conversão</span>
                      <span className="text-lg font-bold text-green-600">
                        {stats.total_leads > 0
                          ? Math.round((stats.vendas_hoje / stats.chamadas_hoje) * 100 || 0)
                          : 0}
                        %
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Today's Summary */}
              <div className="sd-card">
                <div className="sd-card-body">
                  <h3 className="text-lg font-semibold mb-4 text-gray-900">Resumo de Hoje</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Chamadas Realizadas</span>
                      <span className="font-semibold text-gray-900">{stats.chamadas_hoje}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Vendas Realizadas</span>
                      <span className="font-semibold text-green-600">{stats.vendas_hoje}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Tempo em Chamadas</span>
                      <span className="font-semibold text-gray-900">
                        {Math.floor(stats.tempo_total_chamadas / 60)} minutos
                      </span>
                    </div>
                    <div className="border-t border-gray-200 pt-3 mt-3 flex justify-between items-center">
                      <span className="text-gray-600 font-medium">Tempo Médio/Chamada</span>
                      <span className="font-semibold text-gray-900">
                        {stats.chamadas_hoje > 0
                          ? Math.round(stats.tempo_total_chamadas / stats.chamadas_hoje)
                          : 0}{' '}
                        seg
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Commercial Ranking */}
            {!rankingLoading && ranking.length > 0 && (
              <div className="sd-card">
                <div className="sd-card-body">
                  <h3 className="text-lg font-semibold mb-4 text-gray-900">Ranking de Comerciais</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                            Posição
                          </th>
                          <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                            Nome
                          </th>
                          <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700">
                            Chamadas
                          </th>
                          <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700">
                            Vendas
                          </th>
                          <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700">
                            Taxa %
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {ranking.map((comercial: any, index: number) => (
                          <tr key={comercial.usuario_id} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <span className="inline-block w-6 h-6 bg-blue-600 text-white rounded-full text-center text-sm font-semibold">
                                {index + 1}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-900">
                              {comercial.full_name}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-600">
                              {comercial.total_calls}
                            </td>
                            <td className="px-4 py-3 text-center font-semibold text-green-600">
                              {comercial.sales}
                            </td>
                            <td className="px-4 py-3 text-center font-semibold text-blue-600">
                              {comercial.conversion_rate}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
