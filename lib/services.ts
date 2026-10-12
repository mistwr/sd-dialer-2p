import type { CallHistory } from '@/lib/types'
import { callHistoryService as baseCallHistoryService } from './services/index'

export * from './services/index'

/**
 * Wrapper over the existing call-history service.
 * Call results remain in SD Dialer. Detailed sales are registered separately,
 * without requiring write access to CRM Mãe.
 */
export const callHistoryService = {
  ...baseCallHistoryService,

  async create(payload: {
    lead_id: string
    parceiro_id: string
    company_id: string
    result: string
    duration_sec: number
    notes?: string
    ai_summary?: string | null
    ai_sentiment?: string | null
    ai_next_best_action?: string | null
    ai_objections_detected?: string[]
  }) {
    const saved = await baseCallHistoryService.create(payload)

    if (payload.result !== 'venda') return saved as CallHistory

    return saved as CallHistory
  },
}
