'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { LoadingSpinner, Alert, Badge } from '@/components/common'
import { useAuth } from '@/lib/hooks/useAuth'
import { usuarioService, reportService } from '@/lib/services'
import useSWR from 'swr'

export default function SupervisorTeamPage() {
  const { profile, isSupervisor } = useAuth()
  const [filterActive, setFilterActive] = useState(true)

  const { data: teamResponse, isLoading: teamLoading } = useSWR(
    profile?.id ? ['supervisor-team', profile.id] : null,
    () =>
      profile?.id
        ? usuarioService.getBySupervisor(profile.id)
        : Promise.resolve(null),
    { revalidateOnFocus: false }
  )

  const { data: rankingResponse, isLoading: rankingLoading } = useSWR(
    profile?.company_id ? ['team-ranking', profile.company_id] : null,
    () =>
      profile?.company_id
        ? reportService.getComercialRanking(profile.company_id)
        : Promise.resolve(null),
    { revalidateOnFocus: false }
  )

  if (!isSupervisor()) {
    return (
      <DashboardLayout title="Acesso Negado">
        <Alert type="error" message="Apenas supervisores podem acessar" />
      </DashboardLayout>
    )
  }

  const team = teamResponse?.data || []
  const ranking = rankingResponse?.data || []

  // Filter by active status
  const filteredTeam = filterActive
    ? team.filter((u: any) => u.status === 'active')
    : team

  // Filter ranking to only show this supervisor's team
  const teamIds = team.map((u: any) => u.id)
  const teamRanking = ranking.filter((r: any) => teamIds.includes(r.usuario_id))

  return (
    <DashboardLayout title="Minha Equipa">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Minha Equipa</h2>
          <p className="text-gray-600 mt-1">Total: {filteredTeam.length} comerciais</p>
        </div>

        {/* Filter Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilterActive(true)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filterActive
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Ativos ({team.filter((u: any) => u.status === 'active').length})
          </button>
          <button
            onClick={() => setFilterActive(false)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              !filterActive
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Todos ({team.length})
          </button>
        </div>

        {/* Team Cards */}
        {teamLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner message="Carregando equipa..." />
          </div>
        ) : filteredTeam.length === 0 ? (
          <Alert type="info" message="Nenhum comercial na sua equipa" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTeam.map((comercial: any) => (
              <div key={comercial.id} className="sd-card hover:shadow-md transition-shadow">
                <div className="sd-card-body">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                      {comercial.full_name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{comercial.full_name}</h3>
                      <p className="text-xs text-gray-600">{comercial.email}</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Telefone:</span>
                      <span className="font-medium text-gray-900">{comercial.phone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <Badge
                        type={comercial.status === 'active' ? 'success' : 'danger'}
                        label={comercial.status === 'active' ? 'Ativo' : 'Inativo'}
                      />
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-3">
                    <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                      Ver Detalhes
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Team Ranking */}
        {!rankingLoading && teamRanking.length > 0 && (
          <div className="sd-card">
            <div className="sd-card-body">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">
                Ranking da Equipa
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                        Posição
                      </th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                        Comercial
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
                    {teamRanking.map((comercial: any, index: number) => (
                      <tr
                        key={comercial.usuario_id}
                        className="border-b border-gray-200 hover:bg-gray-50"
                      >
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
      </div>
    </DashboardLayout>
  )
}
