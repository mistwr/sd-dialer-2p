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
  const totalDuration = calls.reduce((sum, call) => sum + call.duration_sec, 0)
  return totalDuration / calls.length
}

/**
 * Calcula o tempo total de chamadas
 * @param calls - Array de chamadas
 * @returns Tempo total em segundos
 */
export function calculateTotalCallDuration(calls: CallHistory[]): number {
  return calls.reduce((sum, call) => sum + call.duration_sec, 0)
}

/**
 * Calcula o número de leads por contactar
 * @param leads - Array de leads
 * @returns Número de leads por contactar
 */
export function calculateLeadsToContact(leads: Lead[]): number {
  return leads.filter((lead) => lead.status === 'novo').length
}

/**
 * Calcula o número de leads contatadas
 * @param leads - Array de leads
 * @returns Número de leads contatadas
 */
export function calculateContactedLeads(leads: Lead[]): number {
  return leads.filter((lead) => lead.status !== 'novo').length
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
      if (!acc[call.parceiro_id]) {
        acc[call.parceiro_id] = []
      }
      acc[call.parceiro_id].push(call)
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
      const date = call.called_at.slice(0, 10)
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

/**
 * Calcula o Lead Score de uma captação de porta.
 * Regras simples e explicáveis (não é machine learning) — cada regra soma
 * pontos e fica registada em `motivos` para ser mostrada ao comercial.
 * Pontuação: 0-100. Nível: fria (<40), morna (40-69), quente (>=70).
 */
export function calculateDoorCaptureScore(input: {
  tc_fim_fidelizacao?: string | null
  en_fim_contrato?: string | null
  tc_mensalidade?: number | null
  en_valor_medio_mensal?: number | null
  tc_satisfacao?: number | null
  tc_problemas?: string[]
  interesse?: string | null
  tc_tem_tv?: boolean | null
  tc_tem_internet?: boolean | null
  tc_tem_fixo?: boolean | null
  en_tipo?: string | null
  melhor_horario?: string | null
  temAnexos?: boolean
}): { score: number; motivos: string[] } {
  let score = 0
  const motivos: string[] = []

  // Proximidade do fim da fidelização/contrato (até 90 dias = maior score)
  const fimData = input.tc_fim_fidelizacao || input.en_fim_contrato
  if (fimData) {
    const dias = Math.ceil((new Date(fimData).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    if (dias <= 30 && dias >= 0) {
      score += 25
      motivos.push('Contrato termina em menos de 30 dias')
    } else if (dias <= 90 && dias >= 0) {
      score += 15
      motivos.push('Contrato termina em menos de 90 dias')
    }
  }

  // Mensalidade alta = mais margem de poupança para oferecer
  const mensalidade = input.tc_mensalidade || input.en_valor_medio_mensal
  if (mensalidade && mensalidade >= 60) {
    score += 15
    motivos.push('Mensalidade atual elevada (potencial de poupança alto)')
  } else if (mensalidade && mensalidade >= 30) {
    score += 8
    motivos.push('Mensalidade atual moderada')
  }

  // Insatisfação (satisfação baixa = mais aberto a mudar)
  if (typeof input.tc_satisfacao === 'number' && input.tc_satisfacao <= 2) {
    score += 20
    motivos.push('Cliente pouco satisfeito com o serviço atual')
  } else if (typeof input.tc_satisfacao === 'number' && input.tc_satisfacao === 3) {
    score += 8
    motivos.push('Satisfação neutra com o serviço atual')
  }

  // Problemas reportados
  const numProblemas = input.tc_problemas?.length ?? 0
  if (numProblemas > 0) {
    score += Math.min(numProblemas * 6, 18)
    motivos.push(`${numProblemas} problema(s) reportado(s) com o serviço atual`)
  }

  // Interesse demonstrado
  if (input.interesse === 'ambos') {
    score += 12
    motivos.push('Interesse em telecom e energia (cross-sell)')
  } else if (input.interesse) {
    score += 6
    motivos.push('Interesse demonstrado')
  }

  // Número de serviços atuais (mais serviços = cliente mais "pesado", mais a ganhar)
  const numServicos = [input.tc_tem_tv, input.tc_tem_internet, input.tc_tem_fixo].filter(Boolean).length
  if (numServicos >= 2) {
    score += 8
    motivos.push('Tem múltiplos serviços contratados')
  }
  if (input.en_tipo === 'ambos') {
    score += 8
    motivos.push('Tem eletricidade e gás (duplo fuel)')
  }

  // Melhor horário confirmado facilita o follow-up
  if (input.melhor_horario) {
    score += 5
    motivos.push('Melhor horário de contacto confirmado')
  }

  // Existência de fatura facilita a comparação/proposta
  if (input.temAnexos) {
    score += 10
    motivos.push('Fatura anexada (permite comparação imediata)')
  }

  return { score: Math.min(score, 100), motivos }
}

export function scoreParaTemperatura(score: number): 'quente' | 'morna' | 'fria' {
  if (score >= 70) return 'quente'
  if (score >= 40) return 'morna'
  return 'fria'
}
