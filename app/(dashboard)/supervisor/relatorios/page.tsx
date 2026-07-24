'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { LoadingSpinner, Alert } from '@/components/common'
import { useAuth } from '@/lib/hooks/useAuth'
import { reportService, usuarioService } from '@/lib/services'
import useSWR from 'swr'

export default function SupervisorRelatóriosPage() {
  const { profile, isSupervisor } = useAuth()

  const { data: teamResponse } = useSWR(
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

  // Filter ranking to only show this supervisor's team
  const teamIds = team.map((u: any) => u.id)
  const teamRanking = ranking.filter((r: any) => teamIds.includes(r.usuario_id))

  // Calculate team totals
  const teamTotals = {
    calls: teamRanking.reduce((sum: number, c: any) => sum + c.total_calls, 0),
    sales: teamRanking.reduce((sum: number, c: any) => sum + c.sales, 0),
    duration: teamRanking.reduce((sum: number, c: any) => sum + c.total_duration, 0),
  }

  const averageConversion =
    teamTotals.calls > 0 ? Math.round((teamTotals.sales / teamTotals.calls) * 100) : 0

  return (
    <DashboardLayout title="Relatórios da Equipa">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Relatórios da Equipa</h2>
          <p className="text-gray-600 mt-1">Análise de desempenho da equipa</p>
        </div>

        {/* Team Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="sd-card">
            <div className="sd-card-body">
              <p className="text-sm text-gray-600">Total de Chamadas</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">{teamTotals.calls}</p>
            </div>
          </div>

          <div className="sd-card">
            <div className="sd-card-body">
              <p className="text-sm text-gray-600">Total de Vendas</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{teamTotals.sales}</p>
            </div>
          </div>

          <div className="sd-card">
            <div className="sd-card-body">
              <p className="text-sm text-gray-600">Taxa de Conversão</p>
              <p className="text-3xl font-bold text-purple-600 mt-2">{averageConversion}%</p>
            </div>
          </div>

          <div className="sd-card">
            <div className="sd-card-body">
              <p className="text-sm text-gray-600">Tempo Total</p>
              <p className="text-3xl font-bold text-orange-600 mt-2">
                {Math.floor(teamTotals.duration / 3600)}h
              </p>
            </div>
          </div>
        </div>

        {/* Team Summary */}
        <div className="sd-card">
          <div className="sd-card-body">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">Resumo da Equipa</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-gray-600 text-sm">Total de Comerciais</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{team.length}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Comerciais Ativos</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {team.filter((u: any) => u.status === 'active').length}
                </p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Média de Vendas/Comercial</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {team.length > 0 ? Math.round(teamTotals.sales / team.length) : 0}
                </p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Média de Chamadas/Comercial</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {team.length > 0 ? Math.round(teamTotals.calls / team.length) : 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Team Ranking */}
        {!rankingLoading && teamRanking.length > 0 ? (
          <div className="sd-card">
            <div className="sd-card-body">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Ranking da Equipa</h3>
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
                        Tempo (horas)
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
                        <td className="px-4 py-3 text-center text-gray-600">
                          {(comercial.total_duration / 3600).toFixed(1)}
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
        ) : rankingLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner message="Carregando relatórios..." />
          </div>
        ) : (
          <Alert type="info" message="Nenhum dado disponível" />
        )}
      </div>
    </DashboardLayout>
  )
}
