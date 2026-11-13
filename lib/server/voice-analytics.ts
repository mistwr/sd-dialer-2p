import type { SupabaseClient } from '@supabase/supabase-js'

// Cálculo só de leitura, partilhado pela análise e pelo assistente.
// Custo por minuto estimado (Twilio, tarifa EEA móvel). Configurável por env.
const DEFAULT_COST_PER_MIN_USD = 0.0455

type Row = {
  status: string | null
  duration_seconds: number | null
  interest_level: string | null
  created_at: string
  company_id: string | null
}

export async function computeVoiceAnalytics(admin: SupabaseClient, days: number, companyId: string) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  let query = admin
    .from('voice_calls')
    .select('status,duration_seconds,interest_level,created_at,company_id')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(10000)
  if (companyId) query = query.eq('company_id', companyId)
  const { data, error } = await query
  if (error) throw new Error('voice_calls')

  const rows = (data || []) as Row[]
  const costPerMin = Number(process.env.VOICE_COST_PER_MIN_USD) || DEFAULT_COST_PER_MIN_USD

  const total = rows.length
  const answered = rows.filter(r => r.status === 'answered')
  const voicemail = rows.filter(r => r.status === 'voicemail')
  const failed = rows.filter(r => r.status === 'failed').length
  const secs = (list: Row[]) => list.reduce((s, r) => s + (r.duration_seconds || 0), 0)
  const level = (l: string) => answered.filter(r => r.interest_level === l).length

  // Conversa real: atendida, não voicemail, com mais de 20s.
  const conversations = answered.filter(r => r.interest_level !== 'correio_voz' && (r.duration_seconds || 0) >= 20)
  const alto = level('alto')
  const medio = level('medio')
  const baixo = level('baixo')

  const voicemailSecs = secs(voicemail) + secs(answered.filter(r => r.interest_level === 'correio_voz'))
  const longCalls = answered.filter(r => (r.duration_seconds || 0) > 240)
  const longSecs = secs(longCalls)
  const totalSecs = secs(rows)
  const billedMin = totalSecs / 60
  const cost = billedMin * costPerMin
  const qualified = alto + medio

  // Taxa de atendimento por hora do dia (Europe/Lisbon).
  const hourFmt = new Intl.DateTimeFormat('pt-PT', { hour: '2-digit', hour12: false, timeZone: 'Europe/Lisbon' })
  const byHour: Record<string, { tried: number; picked: number }> = {}
  for (const r of rows) {
    if (r.status === 'ringing' || r.status === 'active') continue
    const h = hourFmt.format(new Date(r.created_at)).padStart(2, '0')
    byHour[h] ||= { tried: 0, picked: 0 }
    byHour[h].tried += 1
    if (r.status === 'answered' || r.status === 'voicemail') byHour[h].picked += 1
  }
  const hours = Object.entries(byHour)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, v]) => ({ hour, tried: v.tried, picked: v.picked, rate: v.tried ? v.picked / v.tried : 0 }))

  return {
    days,
    costPerMinUsd: costPerMin,
    funnel: {
      total,
      noAnswer: failed,
      voicemail: voicemail.length + answered.filter(r => r.interest_level === 'correio_voz').length,
      pickedUp: answered.length + voicemail.length,
      answered: answered.length,
      conversations: conversations.length,
      qualified,
      alto,
      medio,
      baixo,
    },
    cost: {
      billedMinutes: Math.round(billedMin),
      estimatedUsd: Math.round(cost * 100) / 100,
      perQualifiedUsd: qualified ? Math.round((cost / qualified) * 100) / 100 : null,
      perConversationUsd: conversations.length ? Math.round((cost / conversations.length) * 100) / 100 : null,
    },
    waste: {
      voicemailMinutes: Math.round(voicemailSecs / 60),
      voicemailPct: totalSecs ? Math.round((voicemailSecs / totalSecs) * 100) : 0,
      longCalls: longCalls.length,
      longCallsMinutes: Math.round(longSecs / 60),
      longCallsPct: totalSecs ? Math.round((longSecs / totalSecs) * 100) : 0,
    },
    hours,
  }
}
