import { createClient } from '@/lib/supabase/client'
import type { CallHistory } from '@/lib/types'
import { callHistoryService as baseCallHistoryService } from './services/index'

export * from './services/index'

/**
 * Wrapper over the existing call-history service.
 * A result marked as "venda" is only considered complete after the sale
 * has been handed off to the CRM Mãe (MyPoupar+/Soluções Diferentes Supabase).
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

    const sb = createClient()
    const { data, error } = await sb.functions.invoke('register-crm-sale', {
      body: { call_history_id: saved.id },
    })

    if (error || !data?.ok) {
      // Best-effort rollback: evita contar uma venda local que não chegou ao CRM Mãe.
      await sb.from('call_history').delete().eq('id', saved.id)
      throw new Error(
        data?.error || error?.message ||
        'A venda não foi registada no CRM Mãe. Tenta novamente.'
      )
    }

    return saved as CallHistory
  },
}
