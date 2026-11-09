'use client'

import useSWR from 'swr'
import { Target } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// Barra de progresso do objetivo diário de chamadas (manuais + robot).
export default function DailyGoalBar({ userId, meta }: { userId?: string | null; meta?: number | null }) {
  const { data: feitas } = useSWR(userId ? ['daily-calls', userId] : null, async () => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const sb = createClient()
    const [manual, robot] = await Promise.all([
      sb.from('call_history').select('id', { count: 'exact', head: true }).eq('parceiro_id', String(userId)).gte('called_at', start.toISOString()),
      sb.from('voice_calls').select('id', { count: 'exact', head: true }).eq('created_by', String(userId)).gte('created_at', start.toISOString()),
    ])
    return (manual.count ?? 0) + (robot.count ?? 0)
  }, { refreshInterval: 60_000 })

  if (feitas === undefined) return null
  const objetivo = meta && meta > 0 ? meta : 0
  const pct = objetivo ? Math.min(100, Math.round((feitas / objetivo) * 100)) : 0
  const cor = pct >= 100 ? '#16A34A' : pct >= 50 ? '#2563EB' : '#F59E0B'

  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: '12px 16px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: objetivo ? 8 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 14, color: '#0F172A' }}>
          <Target size={16} /> Chamadas hoje
        </div>
        <div style={{ fontSize: 14, fontWeight: 800, color: objetivo ? cor : '#0F172A' }}>
          {feitas}{objetivo ? ` / ${objetivo}` : ''}
        </div>
      </div>
      {objetivo > 0 && (
        <div style={{ height: 8, background: '#F1F5F9', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: cor, transition: 'width 0.3s' }} />
        </div>
      )}
    </div>
  )
}
