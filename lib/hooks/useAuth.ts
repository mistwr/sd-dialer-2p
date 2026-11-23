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

    const loadProfile = async (userId: string): Promise<Usuario | null> => {
      // Com timeout e uma nova tentativa: se a rede ou a sessão falharem, não fica a carregar para sempre.
      for (let tentativa = 0; tentativa < 2; tentativa++) {
        const r: any = await Promise.race([
          supabase.from('usuarios').select('*').eq('id', userId).maybeSingle(),
          new Promise(res => setTimeout(() => res({ data: null, error: { message: 'timeout' } }), 8000)),
        ])
        if (r?.data) {
          supabase.from('usuarios').update({ last_seen_at: new Date().toISOString() }).eq('id', userId).then(() => {})
          return r.data as Usuario
        }
      }
      return null
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
    // Nunca fazer pedidos ao Supabase dentro do callback (bloqueia o "lock" da sessão do supabase-js):
    // adia para fora do callback.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setTimeout(async () => {
        if (session?.user) {
          const profile = await loadProfile(session.user.id)
          setState({ user: session.user, profile, loading: false, error: null })
        } else {
          setState({ user: null, profile: null, loading: false, error: null })
        }
      }, 0)
    })

    return () => subscription.unsubscribe()
  }, [])

  const logout = useCallback(async () => {
    // Sair tem de funcionar sempre, mesmo que o pedido ao Supabase fique pendurado.
    try {
      const supabase = createClient()
      await Promise.race([supabase.auth.signOut({ scope: 'local' }), new Promise(r => setTimeout(r, 3000))])
    } catch {}
    try {
      Object.keys(localStorage).filter(k => k.startsWith('sb-')).forEach(k => localStorage.removeItem(k))
      document.cookie.split(';').map(c => c.split('=')[0].trim()).filter(n => n.startsWith('sb-'))
        .forEach(n => { document.cookie = `${n}=; Max-Age=0; path=/` })
    } catch {}
    window.location.href = '/login'
  }, [])

  const isAdmin      = () => state.profile?.role === 'admin'
  const isSupervisor = () => state.profile?.role === 'supervisor' || state.profile?.role === 'admin'
  const isParceiro   = () => state.profile?.role === 'parceiro'

  return { ...state, logout, isAdmin, isSupervisor, isParceiro }
}
