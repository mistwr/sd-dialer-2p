'use client'
import { useEffect, useState, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { Usuario } from '@/lib/types'

interface AuthState {
  user: User | null
  profile: Usuario | null
  loading: boolean
  error: Error | null
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    const supabase = createClient()

    const loadProfile = async (userId: string) => {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', userId)
        .single()
      if (error) return null
      // Update last_seen
      supabase.from('usuarios').update({ last_seen_at: new Date().toISOString() }).eq('id', userId).then(() => {})
      return data as Usuario
    }

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const profile = await loadProfile(session.user.id)
        setState({ user: session.user, profile, loading: false, error: null })
      } else {
        setState({ user: null, profile: null, loading: false, error: null })
      }
    })

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const profile = await loadProfile(session.user.id)
        setState({ user: session.user, profile, loading: false, error: null })
      } else {
        setState({ user: null, profile: null, loading: false, error: null })
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const logout = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }, [])

  const isAdmin      = () => state.profile?.role === 'admin'
  const isSupervisor = () => state.profile?.role === 'supervisor' || state.profile?.role === 'admin'
  const isParceiro   = () => state.profile?.role === 'parceiro'

  return { ...state, logout, isAdmin, isSupervisor, isParceiro }
}
