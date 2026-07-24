'use client'

import { createClient } from '@/lib/supabase/client'
import type { Lead } from '@/lib/types'

const supabase = createClient()

export const distributionService = {
  /**
   * Distribuição manual - atribuir lead a um comercial
   */
  async distributeManually(leadIds: string[], usuarioId: string) {
    try {
      const { data, error } = await supabase
        .from('leads')
        .update({
          assigned_to: usuarioId,
          status: 'contactado',
          updated_at: new Date().toISOString(),
        })
        .in('id', leadIds)
        .select()

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  /**
   * Distribuição automática - round-robin entre comerciais
   */
  async distributeAutomatic(companyId: string, campaignId: string, comerciais: string[]) {
    try {
      // Obter leads não atribuídos
      const { data: unassignedLeads, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .eq('company_id', companyId)
        .eq('campaign_id', campaignId)
        .is('assigned_to', null)

      if (leadsError) throw leadsError

      if (!unassignedLeads || unassignedLeads.length === 0) {
        return { data: { distributed: 0 }, error: null }
      }

      // Round-robin assignment
      const updates = unassignedLeads.map((lead: Lead, index: number) => ({
        id: lead.id,
        assigned_to: comerciais[index % comerciais.length],
        status: 'contactado',
        updated_at: new Date().toISOString(),
      }))

      // Fazer update em batch
      const { error: updateError } = await supabase.from('leads').upsert(updates)

      if (updateError) throw updateError

      return { data: { distributed: updates.length }, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  /**
   * Distribuição por equipa (todos da equipa recebem os leads)
   */
  async distributeByTeam(
    companyId: string,
    campaignId: string,
    teamLeaderId: string,
    supervisorId: string
  ) {
    try {
      // Obter todos os comerciais da equipa
      const { data: teamMembers, error: teamError } = await supabase
        .from('usuarios')
        .select('id')
        .eq('company_id', companyId)
        .eq('supervisor_id', supervisorId)
        .eq('role', 'comercial')

      if (teamError) throw teamError

      const comerciais = teamMembers?.map((u) => u.id) || []

      // Usar distribuição automática
      return this.distributeAutomatic(companyId, campaignId, comerciais)
    } catch (error) {
      return { data: null, error }
    }
  },

  /**
   * Distribuição por percentagem
   */
  async distributeByPercentage(
    companyId: string,
    campaignId: string,
    distribution: Record<string, number>
  ) {
    try {
      const { data: unassignedLeads, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .eq('company_id', companyId)
        .eq('campaign_id', campaignId)
        .is('assigned_to', null)

      if (leadsError) throw leadsError

      if (!unassignedLeads || unassignedLeads.length === 0) {
        return { data: { distributed: 0 }, error: null }
      }

      const comerciais = Object.keys(distribution)
      const totalLeads = unassignedLeads.length

      const updates: any[] = []
      let leadIndex = 0

      // Distribuir baseado em percentagens
      comerciais.forEach((comercialId) => {
        const percentage = distribution[comercialId]
        const leadsForThisComercial = Math.floor((totalLeads * percentage) / 100)

        for (let i = 0; i < leadsForThisComercial && leadIndex < totalLeads; i++) {
          updates.push({
            id: unassignedLeads[leadIndex].id,
            assigned_to: comercialId,
            status: 'contactado',
            updated_at: new Date().toISOString(),
          })
          leadIndex++
        }
      })

      // Atribuir leads restantes ao primeiro comercial
      while (leadIndex < totalLeads) {
        updates.push({
          id: unassignedLeads[leadIndex].id,
          assigned_to: comerciais[0],
          status: 'contactado',
          updated_at: new Date().toISOString(),
        })
        leadIndex++
      }

      const { error: updateError } = await supabase.from('leads').upsert(updates)

      if (updateError) throw updateError

      return { data: { distributed: updates.length }, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  /**
   * Obter estatísticas de distribuição
   */
  async getDistributionStats(companyId: string, campaignId: string) {
    try {
      const { data: leads, error } = await supabase
        .from('leads')
        .select('assigned_to')
        .eq('company_id', companyId)
        .eq('campaign_id', campaignId)
        .is('deleted_at', null)

      if (error) throw error

      const stats: Record<string, number> = {}
      let unassigned = 0

      leads?.forEach((lead: any) => {
        if (lead.assigned_to) {
          stats[lead.assigned_to] = (stats[lead.assigned_to] || 0) + 1
        } else {
          unassigned++
        }
      })

      return {
        data: {
          stats,
          unassigned,
          total: leads?.length || 0,
        },
        error: null,
      }
    } catch (error) {
      return { data: null, error }
    }
  },
}
