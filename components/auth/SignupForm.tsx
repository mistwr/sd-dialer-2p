'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Alert, LoadingSpinner } from '@/components/common'

export function SignupForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [companyNif, setCompanyNif] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    // Validações
    if (password !== confirmPassword) {
      setError('As palavras-passe não correspondem')
      return
    }

    if (password.length < 6) {
      setError('A palavra-passe deve ter pelo menos 6 caracteres')
      return
    }

    setLoading(true)

    try {
      // Criar conta
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: fullName,
          },
        },
      })

      if (authError) {
        setError(authError.message)
        return
      }

      if (authData?.user) {
        // Criar empresa
        const { data: company, error: companyError } = await supabase
          .from('companies')
          .insert({
            name: companyName,
            nif: companyNif,
          })
          .select()
          .single()

        if (companyError) {
          setError('Erro ao criar empresa: ' + companyError.message)
          return
        }

        // Criar perfil de utilizador como admin
        const { error: profileError } = await supabase
          .from('usuarios')
          .insert({
            id: authData.user.id,
            email,
            full_name: fullName,
            company_id: company.id,
            role: 'admin',
          })

        if (profileError) {
          setError('Erro ao criar perfil: ' + profileError.message)
          return
        }

        setSuccess(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registar')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <Alert
        type="success"
        message="Registo bem-sucedido! Verifique o seu email para confirmar a conta."
      />
    )
  }

  return (
    <form onSubmit={handleSignup} className="space-y-4">
      {error && <Alert type="error" message={error} />}

      <div className="sd-form-group">
        <label htmlFor="fullName" className="sd-label">
          Nome Completo
        </label>
        <input
          id="fullName"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="sd-input"
          placeholder="João Silva"
          required
          disabled={loading}
        />
      </div>

      <div className="sd-form-group">
        <label htmlFor="email" className="sd-label">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="sd-input"
          placeholder="seu.email@empresa.pt"
          required
          disabled={loading}
        />
      </div>

      <div className="sd-form-group">
        <label htmlFor="companyName" className="sd-label">
          Empresa
        </label>
        <input
          id="companyName"
          type="text"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          className="sd-input"
          placeholder="Sua Empresa Lda."
          required
          disabled={loading}
        />
      </div>

      <div className="sd-form-group">
        <label htmlFor="companyNif" className="sd-label">
          NIF
        </label>
        <input
          id="companyNif"
          type="text"
          value={companyNif}
          onChange={(e) => setCompanyNif(e.target.value)}
          className="sd-input"
          placeholder="123456789"
          required
          disabled={loading}
        />
      </div>

      <div className="sd-form-group">
        <label htmlFor="password" className="sd-label">
          Palavra-passe
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="sd-input"
          placeholder="••••••••"
          required
          disabled={loading}
        />
      </div>

      <div className="sd-form-group">
        <label htmlFor="confirmPassword" className="sd-label">
          Confirmar Palavra-passe
        </label>
        <input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="sd-input"
          placeholder="••••••••"
          required
          disabled={loading}
        />
      </div>

      <button type="submit" className="sd-btn-primary w-full" disabled={loading}>
        {loading ? <LoadingSpinner /> : 'Registar'}
      </button>

      <p className="text-center text-sm text-gray-600">
        Já tem conta?{' '}
        <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
          Faça login
        </Link>
      </p>
    </form>
  )
}
