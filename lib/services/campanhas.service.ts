'use client'

import { createClient } from '@/lib/supabase/client'
import type { Campanha } from '@/lib/types'

const supabase = createClient()

export const campanhasService = {
  async getCampanhas(companyId: string) {
    try {
      const { data, error } = await supabase
        .from('campanhas')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  async getCampanha(campaigId: string) {
    try {
      const { data, error } = await supabase
        .from('campanhas')
        .select('*')
        .eq('id', campaigId)
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  async createCampanha(campaign: Partial<Campanha>) {
    try {
      const { data, error } = await supabase
        .from('campanhas')
        .insert([campaign])
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  async updateCampanha(campaignId: string, updates: Partial<Campanha>) {
    try {
      const { data, error } = await supabase
        .from('campanhas')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', campaignId)
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  async deleteCampanha(campaignId: string) {
    try {
      const { error } = await supabase.from('campanhas').delete().eq('id', campaignId)

      if (error) throw error
      return { error: null }
    } catch (error) {
      return { error }
    }
  },

  async getActiveCampanhas(companyId: string) {
    try {
      const { data, error } = await supabase
        .from('campanhas')
        .select('*')
        .eq('company_id', companyId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },
}
