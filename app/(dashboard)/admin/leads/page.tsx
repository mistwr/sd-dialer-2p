'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { LoadingSpinner, Alert, Badge } from '@/components/common'
import { useAuth } from '@/lib/hooks/useAuth'
import { leadsService } from '@/lib/services'
import useSWR from 'swr'

export default function LeadsPage() {
  const { profile, isAdmin } = useAuth()
  const [companyId, setCompanyId] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (profile?.company_id) {
      setCompanyId(profile.company_id)
    }
  }, [profile])

  const { data: response, isLoading } = useSWR(
    companyId ? ['leads', companyId, statusFilter] : null,
    () =>
      companyId
        ? leadsService.getLeads(companyId, statusFilter !== 'all' ? { status: statusFilter } : {})
        : Promise.resolve(null),
    { revalidateOnFocus: false }
  )

  const leads = response?.data || []
  const filteredLeads = leads.filter(
    (lead: any) =>
      lead.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone.includes(searchTerm) ||
      (lead.email && lead.email.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  if (!isAdmin()) {
    return (
      <DashboardLayout title="Acesso Negado">
        <Alert type="error" message="Apenas administradores podem acessar" />
      </DashboardLayout>
    )
  }

  const statusCounts = {
    all: leads.length,
    new: leads.filter((l: any) => l.status === 'new').length,
    contactado: leads.filter((l: any) => l.status === 'contactado').length,
    vendido: leads.filter((l: any) => l.status === 'vendido').length,
  }

  return (
    <DashboardLayout title="Gestão de Leads">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Leads</h2>
            <p className="text-gray-600 mt-1">Total: {leads.length}</p>
          </div>
          <button className="sd-btn sd-btn-primary px-4 py-2 rounded-lg">
            + Importar Leads
          </button>
        </div>

        {/* Status Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { value: 'all', label: `Todos (${statusCounts.all})` },
            { value: 'new', label: `Novos (${statusCounts.new})` },
            { value: 'contactado', label: `Contatados (${statusCounts.contactado})` },
            { value: 'vendido', label: `Vendidos (${statusCounts.vendido})` },
          ].map((status) => (
            <button
              key={status.value}
              onClick={() => setStatusFilter(status.value)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                statusFilter === status.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="sd-card">
          <div className="sd-card-body">
            <input
              type="text"
              placeholder="Pesquisar por nome, telefone ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Leads Table */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner message="Carregando leads..." />
          </div>
        ) : filteredLeads.length === 0 ? (
          <Alert type="info" message="Nenhum lead encontrado" />
        ) : (
          <div className="sd-card overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Nome</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Telefone</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Atribuído a
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Data Criação
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead: any) => (
                  <tr key={lead.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">
                      {lead.first_name} {lead.last_name}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">{lead.phone}</td>
                    <td className="px-6 py-3">
                      <Badge
                        type={
                          lead.status === 'vendido'
                            ? 'success'
                            : lead.status === 'new'
                              ? 'info'
                              : 'warning'
                        }
                        label={lead.status}
                      />
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">
                      {lead.assigned_to ? 'Comercial' : 'Não atribuído'}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">
                      {new Date(lead.created_at).toLocaleDateString('pt-PT')}
                    </td>
                    <td className="px-6 py-3 text-sm">
                      <button className="text-blue-600 hover:text-blue-800 font-medium">
                        Ver
                      </button>
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
