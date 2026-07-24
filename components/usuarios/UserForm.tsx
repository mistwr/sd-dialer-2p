'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { USER_ROLES } from '@/lib/utils/constants'
import Alert from '@/components/common/Alert'
import LoadingSpinner from '@/components/common/LoadingSpinner'

interface UserFormProps {
  companyId: string
  supervisors?: Array<{ id: string; full_name: string }>
  onSuccess?: () => void
}

export default function UserForm({ companyId, supervisors = [], onSuccess }: UserFormProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    role: 'comercial',
    supervisor_id: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      // Criar usuário no auth e na tabela usuarios
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: Math.random().toString(36).slice(-12),
        options: {
          data: {
            full_name: formData.full_name,
          },
        },
      })

      if (authError) throw authError

      if (authData.user) {
        // Inserir na tabela usuarios
        const { error: insertError } = await supabase.from('usuarios').insert({
          id: authData.user.id,
          email: formData.email,
          full_name: formData.full_name,
          phone: formData.phone || null,
          company_id: companyId,
          role: formData.role,
          supervisor_id: formData.supervisor_id || null,
        })

        if (insertError) throw insertError

        setSuccess(true)
        setFormData({
          full_name: '',
          email: '',
          phone: '',
          role: 'comercial',
          supervisor_id: '',
        })

        setTimeout(() => {
          onSuccess?.()
        }, 2000)
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao criar usuário')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="sd-card">
      <div className="sd-card-body">
        <h3 className="text-lg font-semibold mb-4">Novo Utilizador</h3>

        {error && <Alert type="error" message={error} />}
        {success && <Alert type="success" message="Utilizador criado com sucesso!" />}

        <div className="sd-form-group">
          <label className="sd-label" htmlFor="full_name">
            Nome Completo *
          </label>
          <input
            id="full_name"
            type="text"
            name="full_name"
            value={formData.full_name}
            onChange={handleChange}
            className="sd-input"
            required
            placeholder="João Silva"
          />
        </div>

        <div className="sd-form-group">
          <label className="sd-label" htmlFor="email">
            Email *
          </label>
          <input
            id="email"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="sd-input"
            required
            placeholder="joao@empresa.pt"
          />
        </div>

        <div className="sd-form-group">
          <label className="sd-label" htmlFor="phone">
            Telemóvel
          </label>
          <input
            id="phone"
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className="sd-input"
            placeholder="+351 912 345 678"
          />
        </div>

        <div className="sd-form-group">
          <label className="sd-label" htmlFor="role">
            Papel *
          </label>
          <select
            id="role"
            name="role"
            value={formData.role}
            onChange={handleChange}
            className="sd-input"
            required
          >
            {USER_ROLES.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </div>

        {formData.role === 'comercial' && supervisors.length > 0 && (
          <div className="sd-form-group">
            <label className="sd-label" htmlFor="supervisor_id">
              Supervisor
            </label>
            <select
              id="supervisor_id"
              name="supervisor_id"
              value={formData.supervisor_id}
              onChange={handleChange}
              className="sd-input"
            >
              <option value="">Sem supervisor</option>
              {supervisors.map((supervisor) => (
                <option key={supervisor.id} value={supervisor.id}>
                  {supervisor.full_name}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="sd-btn-primary w-full mt-6"
        >
          {loading ? <LoadingSpinner /> : 'Criar Utilizador'}
        </button>
      </div>
    </form>
  )
}
