'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { LoadingSpinner, Alert, Badge } from '@/components/common'
import { useAuth } from '@/lib/hooks/useAuth'
import { leadsService } from '@/lib/services'
import useSWR from 'swr'

export default function ComercialLeadsPage() {
  const { user, profile, isComercial, loading } = useAuth()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedLead, setSelectedLead] = useState<any>(null)

  const { data: response, isLoading, mutate } = useSWR(
    user?.id ? ['my-leads', user.id] : null,
    () => (user?.id ? leadsService.getMyLeads(user.id) : Promise.resolve(null)),
    { revalidateOnFocus: false }
  )

  const leads = response?.data || []
  const filteredLeads = leads.filter((lead: any) => {
    const matchesSearch =
      lead.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone.includes(searchTerm) ||
      (lead.email && lead.email.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter

    return matchesSearch && matchesStatus
  })

  if (loading) {
    return (
      <DashboardLayout title="Meus Leads">
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner message="A carregar..." />
        </div>
      </DashboardLayout>
    )
  }

  if (!isComercial()) {
    return (
      <DashboardLayout title="Acesso Negado">
        <Alert type="error" message="Apenas comerciais podem acessar" />
      </DashboardLayout>
    )
  }

  const statusCounts = {
    all: leads.length,
    new: leads.filter((l: any) => l.status === 'new').length,
    contactado: leads.filter((l: any) => l.status === 'contactado').length,
    vendido: leads.filter((l: any) => l.status === 'vendido').length,
  }

  const handleCall = (lead: any) => {
    // Abrir dialer com o número de telefone
    window.location.href = `tel:${lead.phone}`
  }

  const handleWhatsApp = (lead: any) => {
    // Abrir WhatsApp
    const message = `Olá ${lead.first_name}, tudo bem?`
    window.open(`https://wa.me/${lead.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`)
  }

  return (
    <DashboardLayout title="Meus Leads">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Meus Leads</h2>
          <p className="text-gray-600 mt-1">Total: {leads.length}</p>
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

        {/* Leads List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner message="Carregando seus leads..." />
          </div>
        ) : filteredLeads.length === 0 ? (
          <Alert type="info" message="Nenhum lead encontrado" />
        ) : (
          <div className="space-y-3">
            {filteredLeads.map((lead: any) => (
              <div
                key={lead.id}
                className="sd-card hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedLead(selectedLead?.id === lead.id ? null : lead)}
              >
                <div className="sd-card-body">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">
                        {lead.first_name} {lead.last_name}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">{lead.phone}</p>
                      {lead.email && <p className="text-sm text-gray-600">{lead.email}</p>}
                    </div>
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
                  </div>

                  {/* Expanded view */}
                  {selectedLead?.id === lead.id && (
                    <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Telefone</p>
                          <p className="font-medium text-gray-900 mt-1">{lead.phone}</p>
                        </div>
                        {lead.email && (
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide">Email</p>
                            <p className="font-medium text-gray-900 mt-1">{lead.email}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Data Criação</p>
                          <p className="font-medium text-gray-900 mt-1">
                            {new Date(lead.created_at).toLocaleDateString('pt-PT')}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Status</p>
                          <p className="font-medium text-gray-900 mt-1 capitalize">{lead.status}</p>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 pt-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCall(lead)
                          }}
                          className="flex-1 sd-btn sd-btn-primary px-4 py-2 rounded-lg flex items-center justify-center gap-2"
                        >
                          📞 Ligar
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleWhatsApp(lead)
                          }}
                          className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                        >
                          💬 WhatsApp
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            // TODO: Abrir modal de resultado de chamada
                          }}
                          className="flex-1 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700"
                        >
                          ✓ Resultado
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
