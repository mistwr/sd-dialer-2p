'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { LoadingSpinner, Alert, Badge } from '@/components/common'
import { useAuth } from '@/lib/hooks/useAuth'
import { campanhasService } from '@/lib/services'
import useSWR from 'swr'

export default function CampanhasPage() {
  const { profile, isAdmin, loading } = useAuth()
  const [companyId, setCompanyId] = useState<string>('')
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    if (profile?.company_id) {
      setCompanyId(profile.company_id)
    }
  }, [profile])

  const { data: response, isLoading, mutate } = useSWR(
    companyId ? ['campanhas', companyId] : null,
    () => (companyId ? campanhasService.getCampanhas(companyId) : Promise.resolve(null)),
    { revalidateOnFocus: false }
  )

  const campanhas = response?.data || []

  if (loading) {
    return (
      <DashboardLayout title="Campanhas">
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner message="A carregar..." />
        </div>
      </DashboardLayout>
    )
  }

  if (!isAdmin()) {
    return (
      <DashboardLayout title="Acesso Negado">
        <Alert type="error" message="Apenas administradores podem acessar" />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Campanhas de Venda">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Campanhas</h2>
            <p className="text-gray-600 mt-1">Total: {campanhas.length}</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="sd-btn sd-btn-primary px-4 py-2 rounded-lg"
          >
            + Nova Campanha
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="sd-card">
            <div className="sd-card-body">
              <h3 className="text-lg font-semibold mb-4">Criar Nova Campanha</h3>
              <form className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome da Campanha
                    </label>
                    <input
                      type="text"
                      placeholder="ex: Campanha DIGI 2024"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Descrição
                    </label>
                    <input
                      type="text"
                      placeholder="Descrição breve"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data Início
                    </label>
                    <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data Fim
                    </label>
                    <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                      <option value="draft">Draft</option>
                      <option value="active">Ativa</option>
                      <option value="paused">Pausada</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Objetivo de Vendas
                    </label>
                    <input
                      type="number"
                      placeholder="100"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="sd-btn sd-btn-primary px-4 py-2 rounded-lg"
                    onClick={() => {
                      setShowForm(false)
                      mutate()
                    }}
                  >
                    Criar
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    onClick={() => setShowForm(false)}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Campaigns Grid */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner message="Carregando campanhas..." />
          </div>
        ) : campanhas.length === 0 ? (
          <Alert type="info" message="Nenhuma campanha encontrada. Crie uma para começar!" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {campanhas.map((campanha: any) => (
              <div key={campanha.id} className="sd-card hover:shadow-md transition-shadow">
                <div className="sd-card-body">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900">{campanha.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{campanha.description}</p>
                    </div>
                    <Badge
                      type={
                        campanha.status === 'active'
                          ? 'success'
                          : campanha.status === 'draft'
                            ? 'info'
                            : 'warning'
                      }
                      label={campanha.status}
                    />
                  </div>

                  <div className="space-y-2 text-sm text-gray-600 mb-4">
                    <p>
                      <strong>Objetivo:</strong> {campanha.sales_objective || '0'} vendas
                    </p>
                    <p>
                      <strong>Período:</strong>{' '}
                      {campanha.start_date ? new Date(campanha.start_date).toLocaleDateString('pt-PT') : 'N/A'}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                      Ver
                    </button>
                    <button className="text-orange-600 hover:text-orange-800 text-sm font-medium">
                      Editar
                    </button>
                    <button className="text-red-600 hover:text-red-800 text-sm font-medium">
                      Remover
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
