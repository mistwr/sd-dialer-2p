'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (!email || !password) {
        throw new Error('Email e password são obrigatórios')
      }

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) throw authError

      if (data.user) {
        // Obter perfil para verificar se é o primeiro login
        const { data: profile } = await supabase
          .from('usuarios')
          .select('*')
          .eq('id', data.user.id)
          .single()

        if (profile) {
          // Redirecionar baseado no role
          if (profile.role === 'admin') {
            router.push('/dashboard/admin')
          } else if (profile.role === 'supervisor') {
            router.push('/dashboard/supervisor')
          } else {
            router.push('/dashboard/comercial/leads')
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao fazer login'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-100">
          {/* Logo e Título */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto bg-blue-600 rounded-lg flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">SD Dialer</h1>
            <p className="text-gray-600 mt-2">Plataforma de CRM Comercial</p>
          </div>

          {/* Formulário */}
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Email Input */}
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

            {/* Password Input */}
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

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="sd-btn-primary w-full mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="sd-spinner w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Entrando...
                </span>
              ) : (
                'Entrar'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-center text-sm text-gray-600">
              Não tem uma conta?{' '}
              <Link href="/auth/signup" className="text-blue-600 hover:text-blue-700 font-medium">
                Criar conta
              </Link>
            </p>
          </div>

          {/* Demo Info */}
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-700">
              <strong>Demo:</strong> Utilize a mesma empresa para primeira vez setup.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
