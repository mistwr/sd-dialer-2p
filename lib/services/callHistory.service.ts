'use client'

import { createClient } from '@/lib/supabase/client'
import type { CallHistory, CallResult } from '@/lib/types'

const supabase = createClient()

export const callHistoryService = {
  async createCallRecord(record: Partial<CallHistory>) {
    try {
      const { data, error } = await supabase
        .from('call_history')
        .insert([record])
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  async updateCallRecord(recordId: string, updates: Partial<CallHistory>) {
    try {
      const { data, error } = await supabase
        .from('call_history')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', recordId)
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  async getCallHistory(leadId: string) {
    try {
      const { data, error } = await supabase
        .from('call_history')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  async getUserCallHistory(usuarioId: string, days: number = 30) {
    try {
      const fromDate = new Date()
      fromDate.setDate(fromDate.getDate() - days)

      const { data, error } = await supabase
        .from('call_history')
        .select('*')
        .eq('usuario_id', usuarioId)
        .gte('created_at', fromDate.toISOString())
        .order('created_at', { ascending: false })

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  async getCompanyCallsToday(companyId: string) {
    try {
      const today = new Date().toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('call_history')
        .select('*')
        .eq('company_id', companyId)
        .gte('call_date', today)
        .lte('call_date', today)

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  async getCallsByResult(companyId: string, result: CallResult, days: number = 30) {
    try {
      const fromDate = new Date()
      fromDate.setDate(fromDate.getDate() - days)

      const { data, error } = await supabase
        .from('call_history')
        .select('*')
        .eq('company_id', companyId)
        .eq('result', result)
        .gte('created_at', fromDate.toISOString())

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  async getTotalCallDuration(usuarioId: string) {
    try {
      const { data, error } = await supabase
        .from('call_history')
        .select('duration_seconds')
        .eq('usuario_id', usuarioId)

      if (error) throw error

      const total = data?.reduce((sum, call) => sum + (call.duration_seconds || 0), 0) || 0

      return { data: { total_duration: total }, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },
}
