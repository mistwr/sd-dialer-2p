'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { LoadingSpinner, Alert, Badge } from '@/components/common'
import { useAuth } from '@/lib/hooks/useAuth'
import { usuarioService } from '@/lib/services'
import useSWR from 'swr'

export default function UsuariosPage() {
  const { profile, isAdmin, loading } = useAuth()
  const [companyId, setCompanyId] = useState<string>('')
  const [showForm, setShowForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (profile?.company_id) {
      setCompanyId(profile.company_id)
    }
  }, [profile])

  const { data: usuarios = [], isLoading, mutate } = useSWR(
    companyId ? ['usuarios', companyId] : null,
    () => (companyId ? usuarioService.getByCompany(companyId) : Promise.resolve([])),
    { revalidateOnFocus: false }
  )

  if (loading) {
    return (
      <DashboardLayout title="Utilizadores">
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

  const filteredUsers = (usuarios.data || []).filter(
    (u: any) =>
      u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <DashboardLayout title="Gestão de Utilizadores">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Utilizadores</h2>
            <p className="text-gray-600 mt-1">Total: {filteredUsers.length}</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="sd-btn sd-btn-primary px-4 py-2 rounded-lg"
          >
            + Novo Utilizador
          </button>
        </div>

        {/* Search */}
        <div className="sd-card">
          <div className="sd-card-body">
            <input
              type="text"
              placeholder="Pesquisar por nome ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Form */}
        {showForm && (
          <div className="sd-card">
            <div className="sd-card-body">
              <h3 className="text-lg font-semibold mb-4">Criar Novo Utilizador</h3>
              <form className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome Completo
                    </label>
                    <input
                      type="text"
                      placeholder="João Silva"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      placeholder="joao@empresa.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Telefone
                    </label>
                    <input
                      type="tel"
                      placeholder="+351 912 345 678"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Role
                    </label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                      <option value="comercial">Comercial</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="admin">Admin</option>
                    </select>
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

        {/* Users Table */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner message="Carregando utilizadores..." />
          </div>
        ) : filteredUsers.length === 0 ? (
          <Alert type="info" message="Nenhum utilizador encontrado" />
        ) : (
          <div className="sd-card overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Nome</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Email</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Role</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((usuario: any) => (
                  <tr key={usuario.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                          {usuario.full_name?.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {usuario.full_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">{usuario.email}</td>
                    <td className="px-6 py-3">
                      <Badge
                        type={usuario.role === 'admin' ? 'primary' : usuario.role === 'supervisor' ? 'warning' : 'info'}
                        label={usuario.role}
                      />
                    </td>
                    <td className="px-6 py-3">
                      <Badge
                        type={usuario.status === 'active' ? 'success' : 'danger'}
                        label={usuario.status === 'active' ? 'Ativo' : 'Inativo'}
                      />
                    </td>
                    <td className="px-6 py-3 text-sm">
                      <div className="flex gap-2">
                        <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                          Editar
                        </button>
                        <button className="text-red-600 hover:text-red-800 text-sm font-medium">
                          Remover
                        </button>
                      </div>
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
