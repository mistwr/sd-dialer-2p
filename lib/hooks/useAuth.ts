'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { Usuario } from '@/lib/types'

const supabase = createClient()

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const router = useRouter()

  /**
   * Obter sessão do utilizador
   */
  useEffect(() => {
    const getSession = async () => {
      try {
        setLoading(true)
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) throw sessionError

        setUser(session?.user ?? null)

        // Obter perfil completo se utilizador existe
        if (session?.user?.id) {
          const { data: profileData, error: profileError } = await supabase
            .from('usuarios')
            .select('*')
            .eq('id', session.user.id)
            .single()

          if (profileError) throw profileError

          setProfile(profileData)
        }

        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'))
        setUser(null)
        setProfile(null)
      } finally {
        setLoading(false)
      }
    }

    getSession()

    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null)

      if (session?.user?.id) {
        const { data: profileData } = await supabase
          .from('usuarios')
          .select('*')
          .eq('id', session.user.id)
          .single()

        setProfile(profileData)
      } else {
        setProfile(null)
      }

      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  /**
   * Fazer login
   */
  const login = useCallback(
    async (email: string, password: string) => {
      try {
        setLoading(true)
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw error

        router.push('/dashboard')
        return { success: true, error: null }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Login failed')
        setError(error)
        return { success: false, error }
      } finally {
        setLoading(false)
      }
    },
    [router]
  )

  /**
   * Fazer logout
   */
  const logout = useCallback(async () => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signOut()

      if (error) throw error

      setUser(null)
      setProfile(null)
      router.push('/login')
      return { success: true, error: null }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Logout failed')
      setError(error)
      return { success: false, error }
    } finally {
      setLoading(false)
    }
  }, [router])

  /**
   * Verificar se é admin
   */
  const isAdmin = useCallback(() => {
    return profile?.role === 'admin'
  }, [profile])

  /**
   * Verificar se é supervisor
   */
  const isSupervisor = useCallback(() => {
    return profile?.role === 'supervisor'
  }, [profile])

  /**
   * Verificar se é comercial
   */
  const isComercial = useCallback(() => {
    return profile?.role === 'comercial'
  }, [profile])

  /**
   * Verificar se tem role específica
   */
  const hasRole = useCallback(
    (role: string | string[]) => {
      const roles = Array.isArray(role) ? role : [role]
      return profile && roles.includes(profile.role)
    },
    [profile]
  )

  return {
    user,
    profile,
    loading,
    error,
    login,
    logout,
    isAdmin,
    isSupervisor,
    isComercial,
    hasRole,
    isAuthenticated: !!user,
  }
}
