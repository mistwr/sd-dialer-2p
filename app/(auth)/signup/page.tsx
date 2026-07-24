'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SignUpPage() {
  const router = useRouter()
  const supabase = createClient()

  // Form state
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [companyNif, setCompanyNif] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Validações
      if (!fullName || !email || !password || !confirmPassword || !companyName || !companyNif) {
        throw new Error('Todos os campos são obrigatórios')
      }

      if (password !== confirmPassword) {
        throw new Error('As passwords não coincidem')
      }

      if (password.length < 6) {
        throw new Error('A password deve ter pelo menos 6 caracteres')
      }

      // 1. Criar empresa
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .insert([
          {
            name: companyName,
            nif: companyNif,
            active: true,
          },
        ])
        .select()
        .single()

      if (companyError) throw companyError

      // 2. Criar conta de autenticação
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo:
            process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
            `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`,
          data: {
            full_name: fullName,
          },
        },
      })

      if (authError) throw authError

      // 3. Criar utilizador (admin)
      if (authData.user) {
        const { error: usuarioError } = await supabase
          .from('usuarios')
          .insert([
            {
              id: authData.user.id,
              email,
              full_name: fullName,
              company_id: companyData.id,
              role: 'admin',
              status: 'active',
            },
          ])

        if (usuarioError) throw usuarioError
      }

      setSuccess(true)

      // Redirect após sucesso
      setTimeout(() => {
        router.push('/auth/signup-success')
      }, 2000)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar conta'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-white">
        <div className="text-center">
          <div className="bg-green-100 rounded-full w-16 h-16 mx-auto flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Conta criada com sucesso!</h1>
          <p className="text-gray-600 mb-4">Verifique seu email para confirmar a conta</p>
          <p className="text-sm text-gray-500">Redirecionando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-100">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">SD Dialer</h1>
            <p className="text-gray-600 mt-2">Crie sua conta</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSignUp} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Full Name */}
            <div>
              <label htmlFor="fullName" className="sd-label">
                Nome Completo
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="João Silva"
                className="sd-input"
                required
                disabled={loading}
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="sd-label">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@empresa.com"
                className="sd-input"
                required
                disabled={loading}
              />
            </div>

            {/* Company Name */}
            <div>
              <label htmlFor="companyName" className="sd-label">
                Nome da Empresa
              </label>
              <input
                id="companyName"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Sua Empresa Lda"
                className="sd-input"
                required
                disabled={loading}
              />
            </div>

            {/* Company NIF */}
            <div>
              <label htmlFor="companyNif" className="sd-label">
                NIF da Empresa
              </label>
              <input
                id="companyNif"
                type="text"
                value={companyNif}
                onChange={(e) => setCompanyNif(e.target.value)}
                placeholder="123456789"
                className="sd-input"
                required
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="sd-label">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="sd-input"
                required
                disabled={loading}
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="sd-label">
                Confirmar Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="sd-input"
                required
                disabled={loading}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="sd-btn-primary w-full mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="sd-spinner w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Criando conta...
                </span>
              ) : (
                'Criar Conta'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-center text-sm text-gray-600">
              Já tem uma conta?{' '}
              <Link href="/auth/login" className="text-blue-600 hover:text-blue-700 font-medium">
                Fazer login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
