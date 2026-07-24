'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { LoadingSpinner, Alert, Badge } from '@/components/common'
import { useAuth } from '@/lib/hooks/useAuth'
import { callHistoryService, reportService } from '@/lib/services'
import useSWR from 'swr'

export default function CallHistoryPage() {
  const { user, isComercial } = useAuth()
  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month'>('today')

  const { data: callsResponse, isLoading: callsLoading } = useSWR(
    user?.id ? ['call-history', user.id] : null,
    () => (user?.id ? callHistoryService.getUserCallHistory(user.id) : Promise.resolve(null)),
    { revalidateOnFocus: false }
  )

  const { data: statsResponse, isLoading: statsLoading } = useSWR(
    user?.id ? ['user-stats', user.id] : null,
    () => (user?.id ? reportService.getUserStats(user.id) : Promise.resolve(null)),
    { revalidateOnFocus: false }
  )

  if (!isComercial()) {
    return (
      <DashboardLayout title="Acesso Negado">
        <Alert type="error" message="Apenas comerciais podem acessar" />
      </DashboardLayout>
    )
  }

  const calls = callsResponse?.data || []
  const stats = statsResponse?.data

  // Filter calls by date
  const now = new Date()
  const filteredCalls = calls.filter((call: any) => {
    const callDate = new Date(call.created_at)
    const diffTime = now.getTime() - callDate.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (timeFilter === 'today') return diffDays === 0
    if (timeFilter === 'week') return diffDays <= 7
    if (timeFilter === 'month') return diffDays <= 30
    return true
  })

  const resultCounts = {
    venda: calls.filter((c: any) => c.result === 'venda').length,
    nao_interessado: calls.filter((c: any) => c.result === 'nao_interessado').length,
    nao_atende: calls.filter((c: any) => c.result === 'nao_atende').length,
  }

  return (
    <DashboardLayout title="Histórico de Chamadas">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Histórico de Chamadas</h2>
          <p className="text-gray-600 mt-1">Acompanhe seu desempenho</p>
        </div>

        {/* Stats Cards */}
        {!statsLoading && stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="sd-card">
              <div className="sd-card-body">
                <p className="text-sm text-gray-600">Total de Chamadas</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">{stats.total_calls}</p>
              </div>
            </div>

            <div className="sd-card">
              <div className="sd-card-body">
                <p className="text-sm text-gray-600">Vendas</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{stats.sales}</p>
              </div>
            </div>

            <div className="sd-card">
              <div className="sd-card-body">
                <p className="text-sm text-gray-600">Taxa de Conversão</p>
                <p className="text-3xl font-bold text-purple-600 mt-2">{stats.conversion_rate}%</p>
              </div>
            </div>

            <div className="sd-card">
              <div className="sd-card-body">
                <p className="text-sm text-gray-600">Tempo Médio</p>
                <p className="text-3xl font-bold text-orange-600 mt-2">
                  {stats.average_duration}s
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Filter Buttons */}
        <div className="flex gap-2">
          {(['today', 'week', 'month'] as const).map((period) => (
            <button
              key={period}
              onClick={() => setTimeFilter(period)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                timeFilter === period
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {period === 'today' && 'Hoje'}
              {period === 'week' && 'Última Semana'}
              {period === 'month' && 'Último Mês'}
            </button>
          ))}
        </div>

        {/* Results Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="sd-card">
            <div className="sd-card-body">
              <p className="text-sm text-gray-600">Vendas</p>
              <p className="text-2xl font-bold text-green-600 mt-2">{resultCounts.venda}</p>
            </div>
          </div>
          <div className="sd-card">
            <div className="sd-card-body">
              <p className="text-sm text-gray-600">Não Interessado</p>
              <p className="text-2xl font-bold text-red-600 mt-2">{resultCounts.nao_interessado}</p>
            </div>
          </div>
          <div className="sd-card">
            <div className="sd-card-body">
              <p className="text-sm text-gray-600">Não Atende</p>
              <p className="text-2xl font-bold text-orange-600 mt-2">{resultCounts.nao_atende}</p>
            </div>
          </div>
        </div>

        {/* Calls List */}
        {callsLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner message="Carregando histórico..." />
          </div>
        ) : filteredCalls.length === 0 ? (
          <Alert type="info" message="Nenhuma chamada neste período" />
        ) : (
          <div className="sd-card overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Lead</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Data/Hora
                  </th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">
                    Duração
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Resultado</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Notas</th>
                </tr>
              </thead>
              <tbody>
                {filteredCalls.map((call: any) => (
                  <tr key={call.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-6 py-3">
                      <p className="text-sm font-medium text-gray-900">{call.lead?.first_name}</p>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">
                      {new Date(call.created_at).toLocaleString('pt-PT')}
                    </td>
                    <td className="px-6 py-3 text-center text-sm font-medium text-gray-900">
                      {Math.floor((call.duration_seconds || 0) / 60)}m{' '}
                      {(call.duration_seconds || 0) % 60}s
                    </td>
                    <td className="px-6 py-3">
                      <Badge
                        type={
                          call.result === 'venda'
                            ? 'success'
                            : call.result === 'nao_atende'
                              ? 'danger'
                              : 'warning'
                        }
                        label={call.result}
                      />
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">
                      {call.notes ? call.notes.substring(0, 50) + '...' : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
