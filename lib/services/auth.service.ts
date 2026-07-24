'use client'

import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

const supabase = createClient()

/**
 * Serviço de Autenticação para SD Dialer
 * Gerencia login, signup, logout e gerenciamento de sessão
 */

export const authService = {
  /**
   * Fazer login com email e password
   */
  async login(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  /**
   * Criar nova conta
   */
  async signUp(
    email: string,
    password: string,
    fullName: string,
    companyId: string
  ) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo:
            process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
            `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`,
          data: {
            full_name: fullName,
            company_id: companyId,
          },
        },
      })

      if (error) throw error

      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  /**
   * Fazer logout
   */
  async logout() {
    try {
      const { error } = await supabase.auth.signOut()

      if (error) throw error

      return { error: null }
    } catch (error) {
      return { error }
    }
  },

  /**
   * Obter utilizador atual
   */
  async getCurrentUser() {
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser()

      if (error) throw error

      return { user, error: null }
    } catch (error) {
      return { user: null, error }
    }
  },

  /**
   * Obter sessão atual
   */
  async getSession() {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession()

      if (error) throw error

      return { session, error: null }
    } catch (error) {
      return { session: null, error }
    }
  },

  /**
   * Enviar email de reset de password
   */
  async resetPassword(email: string) {
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo:
          process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
          `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/reset-password`,
      })

      if (error) throw error

      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  /**
   * Atualizar password
   */
  async updatePassword(newPassword: string) {
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) throw error

      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChange(callback: (user: User | null) => void) {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session?.user ?? null)
    })

    return subscription
  },
}

/**
 * Serviço para gerenciar dados de utilizador
 */
export const usuarioService = {
  /**
   * Obter perfil completo do utilizador
   */
  async getProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error

      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  /**
   * Atualizar perfil do utilizador
   */
  async updateProfile(userId: string, updates: Record<string, any>) {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .update(updates)
        .eq('id', userId)
        .select()
        .single()

      if (error) throw error

      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  /**
   * Atualizar último login
   */
  async updateLastLogin(userId: string) {
    try {
      const { error } = await supabase
        .from('usuarios')
        .update({ last_login: new Date().toISOString() })
        .eq('id', userId)

      if (error) throw error

      return { error: null }
    } catch (error) {
      return { error }
    }
  },
}
