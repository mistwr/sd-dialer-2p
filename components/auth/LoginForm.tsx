'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Alert, LoadingSpinner } from '@/components/common'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError(authError.message)
        return
      }

      if (data?.user) {
        // Obter role do utilizador
        const { data: profile, error: profileError } = await supabase
          .from('usuarios')
          .select('role')
          .eq('id', data.user.id)
          .single()

        console.log('[v0] profile:', profile, 'profileError:', profileError)

        if (profile?.role === 'admin') {
          router.push('/admin')
        } else if (profile?.role === 'supervisor') {
          router.push('/supervisor')
        } else {
          router.push('/comercial/leads')
        }
      }
    } catch (err) {
      console.log('[v0] login catch error:', err)
      setError(err instanceof Error ? err.message : 'Erro ao fazer login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      {error && <Alert type="error" message={error} />}

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

      <button type="submit" className="sd-btn-primary w-full" disabled={loading}>
        {loading ? <LoadingSpinner /> : 'Entrar'}
      </button>

      <p className="text-center text-sm text-gray-600">
        Não tem conta?{' '}
        <Link href="/signup" className="text-blue-600 hover:text-blue-700 font-medium">
          Registre-se aqui
        </Link>
      </p>
    </form>
  )
}
