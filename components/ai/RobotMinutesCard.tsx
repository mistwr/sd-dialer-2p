'use client'

import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Totals = { seconds: number; billed_minutes: number; calls: number }
type MinutesData = {
  me: { month: Totals; total: Totals }
  team: Array<{ user: string; month: Totals; total: Totals }>
  isManager: boolean
}

function minutes(seconds: number) {
  return (seconds / 60).toLocaleString('pt-PT', { maximumFractionDigits: 1 })
}

// Minutos gastos nas chamadas do robot de IA (o próprio utilizador e, para admin/supervisor, a equipa).
export default function RobotMinutesCard({ refreshKey = 0 }: { refreshKey?: number }) {
  const [data, setData] = useState<MinutesData | null>(null)
  const [showTeam, setShowTeam] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const sb = createClient()
        const { data: { session } } = await sb.auth.getSession()
        if (!session?.access_token) return
        const response = await fetch('/api/sd-dialer/minutes', {
          headers: { Authorization: 'Bearer ' + session.access_token },
          cache: 'no-store',
        })
        if (!response.ok) return
        const json = await response.json()
        if (!cancelled) setData(json)
      } catch {
        // cartão informativo: falhar em silêncio
      }
    })()
    return () => { cancelled = true }
  }, [refreshKey])

  if (!data) return null
  const monthLabel = new Date().toLocaleDateString('pt-PT', { month: 'long', timeZone: 'Europe/Lisbon' })
  const teamMonth = data.team.reduce((a, r) => a + r.month.seconds, 0)

  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: '#0F172A', fontWeight: 800, fontSize: 14 }}>
        <Clock size={16} /> Minutos gastos com o robot
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: data.isManager ? 'repeat(3, minmax(0,1fr))' : 'repeat(2, minmax(0,1fr))', gap: 10 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A' }}>{minutes(data.me.month.seconds)} min</div>
          <div style={{ fontSize: 12, color: '#64748B' }}>Os seus, em {monthLabel} · {data.me.month.calls} chamadas</div>
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A' }}>{minutes(data.me.total.seconds)} min</div>
          <div style={{ fontSize: 12, color: '#64748B' }}>Os seus, desde o início · {data.me.total.calls} chamadas</div>
        </div>
        {data.isManager && (
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A' }}>{minutes(teamMonth)} min</div>
            <div style={{ fontSize: 12, color: '#64748B' }}>Equipa, em {monthLabel}</div>
          </div>
        )}
      </div>
      {data.isManager && data.team.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowTeam(v => !v)}
            style={{ marginTop: 10, border: 'none', background: 'transparent', color: '#2563EB', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', padding: 0 }}
          >
            {showTeam ? 'Esconder equipa' : 'Ver minutos por pessoa'}
          </button>
          {showTeam && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 8 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '6px 4px' }}>Pessoa</th>
                  <th style={{ padding: '6px 4px' }}>{monthLabel}</th>
                  <th style={{ padding: '6px 4px' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {data.team.map(r => (
                  <tr key={r.user} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '6px 4px', fontWeight: 600 }}>{r.user}</td>
                    <td style={{ padding: '6px 4px' }}>{minutes(r.month.seconds)} min</td>
                    <td style={{ padding: '6px 4px' }}>{minutes(r.total.seconds)} min</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  )
}
