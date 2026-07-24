'use client'

import { createClient } from '@/lib/supabase/client'
import type { FollowUp } from '@/lib/types'

const supabase = createClient()

export const followUpService = {
  async createFollowUp(followUp: Partial<FollowUp>) {
    try {
      const { data, error } = await supabase
        .from('follow_ups')
        .insert([followUp])
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  async getFollowUps(usuarioId: string) {
    try {
      const { data, error } = await supabase
        .from('follow_ups')
        .select('*')
        .eq('usuario_id', usuarioId)
        .eq('status', 'pending')
        .order('scheduled_date', { ascending: true })
        .order('scheduled_time', { ascending: true })

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  async getFollowUpsByDate(usuarioId: string, date: string) {
    try {
      const { data, error } = await supabase
        .from('follow_ups')
        .select('*')
        .eq('usuario_id', usuarioId)
        .eq('scheduled_date', date)
        .eq('status', 'pending')
        .order('scheduled_time', { ascending: true })

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  async completeFollowUp(followUpId: string) {
    try {
      const { data, error } = await supabase
        .from('follow_ups')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', followUpId)
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  async cancelFollowUp(followUpId: string) {
    try {
      const { data, error } = await supabase
        .from('follow_ups')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', followUpId)
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  async getCompanyFollowUpsToday(companyId: string) {
    try {
      const today = new Date().toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('follow_ups')
        .select('*')
        .eq('company_id', companyId)
        .eq('scheduled_date', today)
        .eq('status', 'pending')

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },
}
