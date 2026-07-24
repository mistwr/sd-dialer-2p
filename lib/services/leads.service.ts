'use client'

import { createClient } from '@/lib/supabase/client'
import type { Lead, LeadStatus } from '@/lib/types'

const supabase = createClient()

/**
 * Serviço para gerenciar leads no SD Dialer
 */
export const leadsService = {
  /**
   * Obter todos os leads da empresa
   */
  async getLeads(companyId: string, filters?: Record<string, any>) {
    try {
      let query = supabase
        .from('leads')
        .select('*')
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      // Aplicar filtros se existirem
      if (filters?.campaign_id) {
        query = query.eq('campaign_id', filters.campaign_id)
      }
      if (filters?.status) {
        query = query.eq('status', filters.status)
      }
      if (filters?.assigned_to) {
        query = query.eq('assigned_to', filters.assigned_to)
      }
      if (filters?.search) {
        query = query.or(
          `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,email.ilike.%${filters.search}%`
        )
      }

      const { data, error } = await query

      if (error) throw error

      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  /**
   * Obter leads atribuídos ao utilizador (comercial)
   */
  async getMyLeads(usuarioId: string, filters?: Record<string, any>) {
    try {
      let query = supabase
        .from('leads')
        .select('*')
        .eq('assigned_to', usuarioId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      if (filters?.status) {
        query = query.eq('status', filters.status)
      }
      if (filters?.search) {
        query = query.or(
          `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`
        )
      }

      const { data, error } = await query

      if (error) throw error

      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  /**
   * Obter um lead específico
   */
  async getLead(leadId: string) {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .is('deleted_at', null)
        .single()

      if (error) throw error

      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  /**
   * Criar novo lead
   */
  async createLead(lead: Partial<Lead>) {
    try {
      const { data, error } = await supabase
        .from('leads')
        .insert([lead])
        .select()
        .single()

      if (error) throw error

      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  /**
   * Criar múltiplos leads (importação)
   */
  async createLeads(leads: Partial<Lead>[]) {
    try {
      const { data, error } = await supabase
        .from('leads')
        .insert(leads)
        .select()

      if (error) throw error

      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  /**
   * Atualizar lead
   */
  async updateLead(leadId: string, updates: Partial<Lead>) {
    try {
      const { data, error } = await supabase
        .from('leads')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId)
        .select()
        .single()

      if (error) throw error

      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  /**
   * Atualizar status do lead
   */
  async updateLeadStatus(leadId: string, status: LeadStatus) {
    try {
      const { data, error } = await supabase
        .from('leads')
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId)
        .select()
        .single()

      if (error) throw error

      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  /**
   * Atribuir lead a um comercial
   */
  async assignLead(leadId: string, usuarioId: string) {
    try {
      const { data, error } = await supabase
        .from('leads')
        .update({
          assigned_to: usuarioId,
          status: 'contactado',
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId)
        .select()
        .single()

      if (error) throw error

      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  /**
   * Soft delete de lead
   */
  async deleteLead(leadId: string) {
    try {
      const { data, error } = await supabase
        .from('leads')
        .update({
          deleted_at: new Date().toISOString(),
        })
        .eq('id', leadId)
        .select()
        .single()

      if (error) throw error

      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  /**
   * Obter leads sem atribuição
   */
  async getUnassignedLeads(companyId: string) {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('company_id', companyId)
        .is('assigned_to', null)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })

      if (error) throw error

      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  /**
   * Detectar duplicados baseado em telefone
   */
  async detectDuplicates(companyId: string, campaignId: string, phones: string[]) {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('id, phone, mobile, first_name, last_name')
        .eq('company_id', companyId)
        .eq('campaign_id', campaignId)
        .in('phone', phones)
        .is('deleted_at', null)

      if (error) throw error

      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  /**
   * Contar leads por status
   */
  async countLeadsByStatus(companyId: string) {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('status')
        .eq('company_id', companyId)
        .is('deleted_at', null)

      if (error) throw error

      const counts = {
        new: 0,
        contactado: 0,
        vendido: 0,
        nao_interessado: 0,
        agendar: 0,
        outras: 0,
      }

      data?.forEach((lead: any) => {
        if (lead.status in counts) {
          counts[lead.status as keyof typeof counts]++
        }
      })

      return { data: counts, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },
}
