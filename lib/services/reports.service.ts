'use client'

import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

export const reportService = {
  /**
   * Obter estatísticas gerais da empresa
   */
  async getCompanyStats(companyId: string) {
    try {
      // Contar usuarios online (last_login nos últimos 15 minutos)
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60000).toISOString()

      const { data: usuarios, error: usuariosError } = await supabase
        .from('usuarios')
        .select('id, role')
        .eq('company_id', companyId)
        .eq('status', 'active')

      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('id, status')
        .eq('company_id', companyId)
        .is('deleted_at', null)

      const { data: callsToday, error: callsError } = await supabase
        .from('call_history')
        .select('duration_seconds, result')
        .eq('company_id', companyId)
        .gte('created_at', new Date().toISOString().split('T')[0])

      if (usuariosError) throw usuariosError
      if (leadsError) throw leadsError
      if (callsError) throw callsError

      const stats = {
        total_usuarios: usuarios?.length || 0,
        total_comercials: usuarios?.filter((u: any) => u.role === 'comercial').length || 0,
        total_leads: leadsData?.length || 0,
        leads_contato_pendente: leadsData?.filter((l: any) => l.status === 'new').length || 0,
        chamadas_hoje: callsToday?.length || 0,
        tempo_total_chamadas: callsToday?.reduce((sum, c: any) => sum + (c.duration_seconds || 0), 0) || 0,
        vendas_hoje: callsToday?.filter((c: any) => c.result === 'venda').length || 0,
      }

      return { data: stats, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  /**
   * Obter estatísticas de um utilizador
   */
  async getUserStats(usuarioId: string, days: number = 30) {
    try {
      const fromDate = new Date()
      fromDate.setDate(fromDate.getDate() - days)

      const { data: callsData, error: callsError } = await supabase
        .from('call_history')
        .select('*')
        .eq('usuario_id', usuarioId)
        .gte('created_at', fromDate.toISOString())

      if (callsError) throw callsError

      const totalCalls = callsData?.length || 0
      const totalDuration = callsData?.reduce((sum, c: any) => sum + (c.duration_seconds || 0), 0) || 0
      const averageDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0
      const sales = callsData?.filter((c: any) => c.result === 'venda').length || 0
      const conversionRate = totalCalls > 0 ? Math.round((sales / totalCalls) * 100) : 0

      return {
        data: {
          total_calls: totalCalls,
          total_duration: totalDuration,
          average_duration: averageDuration,
          sales,
          conversion_rate: conversionRate,
          days,
        },
        error: null,
      }
    } catch (error) {
      return { data: null, error }
    }
  },

  /**
   * Obter estatísticas de uma campanha
   */
  async getCampaignStats(campaignId: string) {
    try {
      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .eq('campaign_id', campaignId)
        .is('deleted_at', null)

      if (leadsError) throw leadsError

      const totalLeads = leads?.length || 0
      const contactedLeads = leads?.filter((l: any) => l.status !== 'new').length || 0
      const salesLeads = leads?.filter((l: any) => l.status === 'vendido').length || 0

      return {
        data: {
          total_leads: totalLeads,
          contacted_leads: contactedLeads,
          sales: salesLeads,
          conversion_rate: totalLeads > 0 ? Math.round((salesLeads / totalLeads) * 100) : 0,
          pending_contact: totalLeads - contactedLeads,
        },
        error: null,
      }
    } catch (error) {
      return { data: null, error }
    }
  },

  /**
   * Obter ranking de comerciais
   */
  async getComercialRanking(companyId: string, days: number = 30) {
    try {
      const fromDate = new Date()
      fromDate.setDate(fromDate.getDate() - days)

      const { data: usuarios, error: usuariosError } = await supabase
        .from('usuarios')
        .select('id, full_name')
        .eq('company_id', companyId)
        .eq('role', 'comercial')
        .eq('status', 'active')

      if (usuariosError) throw usuariosError

      const ranking = await Promise.all(
        (usuarios || []).map(async (usuario: any) => {
          const { data: calls } = await supabase
            .from('call_history')
            .select('*')
            .eq('usuario_id', usuario.id)
            .gte('created_at', fromDate.toISOString())

          const totalCalls = calls?.length || 0
          const sales = calls?.filter((c: any) => c.result === 'venda').length || 0
          const totalDuration = calls?.reduce((sum, c: any) => sum + (c.duration_seconds || 0), 0) || 0

          return {
            usuario_id: usuario.id,
            full_name: usuario.full_name,
            total_calls: totalCalls,
            sales,
            total_duration: totalDuration,
            conversion_rate: totalCalls > 0 ? Math.round((sales / totalCalls) * 100) : 0,
          }
        })
      )

      // Ordenar por vendas
      ranking.sort((a, b) => b.sales - a.sales)

      return { data: ranking, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  /**
   * Obter dados para gráfico de chamadas por dia
   */
  async getCallsTrendData(companyId: string, days: number = 30) {
    try {
      const fromDate = new Date()
      fromDate.setDate(fromDate.getDate() - days)

      const { data: calls, error } = await supabase
        .from('call_history')
        .select('call_date, duration_seconds, result')
        .eq('company_id', companyId)
        .gte('created_at', fromDate.toISOString())

      if (error) throw error

      const trendData: Record<string, any> = {}

      calls?.forEach((call: any) => {
        const date = call.call_date
        if (!trendData[date]) {
          trendData[date] = {
            date,
            calls: 0,
            sales: 0,
            duration: 0,
          }
        }
        trendData[date].calls++
        trendData[date].duration += call.duration_seconds || 0
        if (call.result === 'venda') {
          trendData[date].sales++
        }
      })

      const data = Object.values(trendData)
        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())

      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  /**
   * Obter distribuição de resultados de chamadas
   */
  async getCallResultsDistribution(companyId: string, days: number = 30) {
    try {
      const fromDate = new Date()
      fromDate.setDate(fromDate.getDate() - days)

      const { data: calls, error } = await supabase
        .from('call_history')
        .select('result')
        .eq('company_id', companyId)
        .gte('created_at', fromDate.toISOString())

      if (error) throw error

      const distribution: Record<string, number> = {
        venda: 0,
        nao_interessado: 0,
        nao_atende: 0,
        numero_errado: 0,
        ligar_depois: 0,
        cliente_aderiu: 0,
        sem_cobertura: 0,
        outro: 0,
      }

      calls?.forEach((call: any) => {
        if (call.result in distribution) {
          distribution[call.result]++
        }
      })

      return { data: distribution, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },
}
