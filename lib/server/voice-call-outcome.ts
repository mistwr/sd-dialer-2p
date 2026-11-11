// Leva o resultado de uma chamada de IA para a lead e para a lista de "não contactar".
// - Só mexe em leads que ainda estão em estados "em aberto" (novo / não atende / ligar depois):
//   nunca rebaixa um estado posto por um comercial (contactado, vendido, etc.).
// - Pedido explícito para não voltar a ligar: grava em voice_opt_outs e fecha a lead.
// Idempotente e nunca lança erro.

const OPEN_STATUSES = new Set(['novo', 'nao_atende', 'ligar_depois'])

const STATUS_BY_INTEREST: Record<string, string> = {
  alto: 'contactado',
  medio: 'contactado',
  baixo: 'ligar_depois',
  sem_interesse: 'nao_interessado',
  correio_voz: 'nao_atende',
  indeterminado: 'nao_atende',
}

export async function applyCallOutcome(
  admin: any,
  callId: string,
  opts: { doNotCall?: boolean; noAnswer?: boolean } = {},
): Promise<void> {
  try {
    const { data: call } = await admin
      .from('voice_calls')
      .select('id,lead_id,company_id,phone_number,interest_level')
      .eq('id', callId)
      .maybeSingle()
    if (!call) return

    if (opts.doNotCall && call.company_id && call.phone_number) {
      const { data: existing } = await admin
        .from('voice_opt_outs')
        .select('id')
        .eq('company_id', call.company_id)
        .eq('phone_number', call.phone_number)
        .maybeSingle()
      if (!existing) {
        await admin.from('voice_opt_outs').insert({
          company_id: call.company_id,
          phone_number: call.phone_number,
          reason: 'Pedido do cliente numa chamada de IA',
          call_id: call.id,
        })
      }
    }

    if (!call.lead_id) return
    const target = opts.doNotCall ? 'nao_interessado' : opts.noAnswer ? 'nao_atende' : STATUS_BY_INTEREST[String(call.interest_level || '')]
    if (!target) return

    const { data: lead } = await admin.from('leads').select('id,status').eq('id', call.lead_id).maybeSingle()
    if (!lead) return
    const current = String(lead.status || '').toLowerCase()
    if (!opts.doNotCall && !OPEN_STATUSES.has(current)) return
    if (current === target || current === 'vendido') return

    await admin
      .from('leads')
      .update({ status: target, updated_at: new Date().toISOString() })
      .eq('id', lead.id)
  } catch (error) {
    console.error('[voice-call-outcome] failed', error instanceof Error ? error.message : 'unknown')
  }
}

export async function isOptedOut(admin: any, companyId: string, phoneNumber: string): Promise<boolean> {
  try {
    const { data } = await admin
      .from('voice_opt_outs')
      .select('id')
      .eq('company_id', companyId)
      .eq('phone_number', phoneNumber)
      .limit(1)
    return Boolean(data && data.length)
  } catch {
    return false
  }
}
