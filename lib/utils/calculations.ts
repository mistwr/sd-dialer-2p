/**
 * SD Dialer - Calculations
 * Cálculos de estatísticas e análise de dados
 */

import type { CallHistory, Lead } from '@/lib/types'

/**
 * Calcula a taxa de conversão
 * @param totalCalls - Total de chamadas
 * @param sales - Total de vendas
 * @returns Taxa de conversão em percentagem
 */
export function calculateConversionRate(totalCalls: number, sales: number): number {
  if (totalCalls === 0) return 0
  return (sales / totalCalls) * 100
}

/**
 * Calcula o tempo médio de chamadas
 * @param calls - Array de chamadas
 * @returns Tempo médio em segundos
 */
export function calculateAverageCallDuration(calls: CallHistory[]): number {
  if (calls.length === 0) return 0
  const totalDuration = calls.reduce((sum, call) => sum + call.duration_seconds, 0)
  return totalDuration / calls.length
}

/**
 * Calcula o tempo total de chamadas
 * @param calls - Array de chamadas
 * @returns Tempo total em segundos
 */
export function calculateTotalCallDuration(calls: CallHistory[]): number {
  return calls.reduce((sum, call) => sum + call.duration_seconds, 0)
}

/**
 * Calcula o número de leads por contactar
 * @param leads - Array de leads
 * @returns Número de leads por contactar
 */
export function calculateLeadsToContact(leads: Lead[]): number {
  return leads.filter((lead) => lead.status === 'new').length
}

/**
 * Calcula o número de leads contatadas
 * @param leads - Array de leads
 * @returns Número de leads contatadas
 */
export function calculateContactedLeads(leads: Lead[]): number {
  return leads.filter((lead) => lead.status !== 'new').length
}

/**
 * Calcula o número de vendas
 * @param calls - Array de chamadas
 * @returns Número de vendas
 */
export function calculateTotalSales(calls: CallHistory[]): number {
  return calls.filter((call) => call.result === 'venda').length
}

/**
 * Agrupa chamadas por comercial
 * @param calls - Array de chamadas
 * @returns Objeto com comercial como chave e array de chamadas como valor
 */
export function groupCallsByComercial(
  calls: CallHistory[]
): { [usuarioId: string]: CallHistory[] } {
  return calls.reduce(
    (acc, call) => {
      if (!acc[call.usuario_id]) {
        acc[call.usuario_id] = []
      }
      acc[call.usuario_id].push(call)
      return acc
    },
    {} as { [usuarioId: string]: CallHistory[] }
  )
}

/**
 * Agrupa chamadas por data
 * @param calls - Array de chamadas
 * @returns Objeto com data como chave e array de chamadas como valor
 */
export function groupCallsByDate(calls: CallHistory[]): { [date: string]: CallHistory[] } {
  return calls.reduce(
    (acc, call) => {
      const date = call.call_date
      if (!acc[date]) {
        acc[date] = []
      }
      acc[date].push(call)
      return acc
    },
    {} as { [date: string]: CallHistory[] }
  )
}

/**
 * Agrupa chamadas por resultado
 * @param calls - Array de chamadas
 * @returns Objeto com resultado como chave e número de chamadas como valor
 */
export function groupCallsByResult(calls: CallHistory[]): { [result: string]: number } {
  return calls.reduce(
    (acc, call) => {
      acc[call.result] = (acc[call.result] || 0) + 1
      return acc
    },
    {} as { [result: string]: number }
  )
}

/**
 * Calcula estatísticas de um comercial
 * @param calls - Array de chamadas do comercial
 * @returns Objeto com estatísticas
 */
export function calculateComercialStats(calls: CallHistory[]) {
  const totalCalls = calls.length
  const totalSales = calculateTotalSales(calls)
  const totalDuration = calculateTotalCallDuration(calls)
  const averageDuration = calculateAverageCallDuration(calls)
  const conversionRate = calculateConversionRate(totalCalls, totalSales)

  return {
    totalCalls,
    totalSales,
    totalDuration,
    averageDuration,
    conversionRate,
  }
}

/**
 * Calcula ranking de comerciais
 * @param callsByComercial - Objeto com comercial como chave e array de chamadas como valor
 * @returns Array de comerciais ordenado por vendas
 */
export function calculateComercialRanking(
  callsByComercial: { [usuarioId: string]: CallHistory[] },
  usuariosData: { [id: string]: { name: string } }
) {
  const ranking = Object.entries(callsByComercial).map(([usuarioId, calls]) => {
    const stats = calculateComercialStats(calls)
    return {
      usuarioId,
      name: usuariosData[usuarioId]?.name || 'Desconhecido',
      ...stats,
    }
  })

  // Ordenar por vendas (descendente)
  return ranking.sort((a, b) => b.totalSales - a.totalSales)
}

/**
 * Calcula o progresso em relação a um objectivo
 * @param current - Valor actual
 * @param target - Valor alvo
 * @returns Percentagem de progresso
 */
export function calculateObjectiveProgress(current: number, target: number): number {
  if (target === 0) return 0
  const progress = (current / target) * 100
  return Math.min(progress, 100) // Máximo 100%
}

/**
 * Verifica se um objectivo foi atingido
 * @param current - Valor actual
 * @param target - Valor alvo
 * @returns Boolean
 */
export function isObjectiveReached(current: number, target: number): boolean {
  return current >= target
}

/**
 * Calcula a distribuição de leads por comercial (round-robin)
 * @param leadIds - Array de IDs de leads
 * @param comercialIds - Array de IDs de comerciais
 * @returns Objeto com comercial como chave e array de lead IDs como valor
 */
export function distributeLeadsRoundRobin(
  leadIds: string[],
  comercialIds: string[]
): { [comercialId: string]: string[] } {
  const distribution: { [comercialId: string]: string[] } = {}

  comercialIds.forEach((id) => {
    distribution[id] = []
  })

  leadIds.forEach((leadId, index) => {
    const comercialIndex = index % comercialIds.length
    distribution[comercialIds[comercialIndex]].push(leadId)
  })

  return distribution
}

/**
 * Calcula a distribuição de leads por percentagem
 * @param leadIds - Array de IDs de leads
 * @param percentages - Objeto com comercial como chave e percentagem como valor
 * @returns Objeto com comercial como chave e array de lead IDs como valor
 */
export function distributeLeadsByPercentage(
  leadIds: string[],
  percentages: { [comercialId: string]: number }
): { [comercialId: string]: string[] } {
  const distribution: { [comercialId: string]: string[] } = {}
  const totalLeads = leadIds.length

  let startIndex = 0

  Object.entries(percentages).forEach(([comercialId, percentage]) => {
    const count = Math.round((totalLeads * percentage) / 100)
    distribution[comercialId] = leadIds.slice(startIndex, startIndex + count)
    startIndex += count
  })

  return distribution
}

/**
 * Calcula estatísticas diárias
 * @param callsByDate - Objeto com data como chave e array de chamadas como valor
 * @returns Array de estatísticas diárias
 */
export function calculateDailyStats(callsByDate: { [date: string]: CallHistory[] }) {
  return Object.entries(callsByDate).map(([date, calls]) => ({
    date,
    totalCalls: calls.length,
    totalSales: calculateTotalSales(calls),
    totalDuration: calculateTotalCallDuration(calls),
    averageDuration: calculateAverageCallDuration(calls),
    conversionRate: calculateConversionRate(calls.length, calculateTotalSales(calls)),
  }))
}

/**
 * Calcula tendência (aumento ou diminuição)
 * @param current - Valor actual
 * @param previous - Valor anterior
 * @returns Percentagem de variação
 */
export function calculateTrend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

/**
 * Calcula overhead administrativo (% de chamadas que não resultaram em venda)
 * @param calls - Array de chamadas
 * @returns Percentagem
 */
export function calculateAdministrativeOverhead(calls: CallHistory[]): number {
  if (calls.length === 0) return 0
  const nonSales = calls.filter((call) => call.result !== 'venda').length
  return (nonSales / calls.length) * 100
}
