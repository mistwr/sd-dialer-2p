'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { CalendarClock, AlertTriangle, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Item = { id: string; scheduled_at: string; notes: string | null; lead: { id: string; nome: string | null; telefone: string | null } | null }

async function fetchToday(userId: string): Promise<Item[]> {
  const endOfToday = new Date()
  endOfToday.setHours(23, 59, 59, 999)
  const { data, error } = await createClient()
    .from('follow_ups')
    .select('id,scheduled_at,notes,lead:lead_id(id,nome,telefone)')
    .eq('parceiro_id', userId)
    .eq('done', false)
    .lte('scheduled_at', endOfToday.toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(50)
  if (error) throw error
  return (data as any) ?? []
}

// Bloco "Para hoje / Em atraso" no topo de Minhas Leads.
export default function FollowUpsTodayCard({ userId }: { userId?: string | null }) {
  const { data } = useSWR(userId ? ['follow-ups-today', userId] : null, () => fetchToday(String(userId)), { refreshInterval: 60_000 })
  if (!data || data.length === 0) return null

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const overdue = data.filter(f => new Date(f.scheduled_at) < startOfToday)
  const today = data.filter(f => new Date(f.scheduled_at) >= startOfToday)
  const shown = [...overdue, ...today].slice(0, 5)

  return (
    <div style={{ background: '#fff', border: `1px solid ${overdue.length ? '#FECACA' : '#E2E8F0'}`, borderRadius: 14, padding: '14px 16px', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 14, color: '#0F172A' }}>
          <CalendarClock size={17} /> Contactos marcados
        </div>
        <div style={{ display: 'flex', gap: 6, fontSize: 12, fontWeight: 700 }}>
          {overdue.length > 0 && <span style={{ background: '#FEF2F2', color: '#B91C1C', padding: '3px 8px', borderRadius: 999 }}>{overdue.length} em atraso</span>}
          {today.length > 0 && <span style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '3px 8px', borderRadius: 999 }}>{today.length} para hoje</span>}
        </div>
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        {shown.map(f => {
          const late = new Date(f.scheduled_at) < startOfToday
          const when = new Date(f.scheduled_at).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
          const content = (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: late ? '#FFF7F7' : '#F8FAFC' }}>
              {late ? <AlertTriangle size={15} color="#DC2626" /> : <CalendarClock size={15} color="#2563EB" />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.lead?.nome || 'Lead sem nome'}
                </div>
                <div style={{ fontSize: 12, color: late ? '#B91C1C' : '#64748B' }}>
                  {when}{f.notes ? ` · ${f.notes.slice(0, 60)}` : ''}
                </div>
              </div>
              <ChevronRight size={15} color="#94A3B8" />
            </div>
          )
          return f.lead?.id
            ? <Link key={f.id} href={`/parceiro/leads/${f.lead.id}`} style={{ textDecoration: 'none' }}>{content}</Link>
            : <div key={f.id}>{content}</div>
        })}
      </div>
      {data.length > shown.length && (
        <Link href="/parceiro/agenda" style={{ display: 'inline-block', marginTop: 8, fontSize: 12.5, fontWeight: 700, color: '#2563EB', textDecoration: 'none' }}>
          Ver todos na Agenda ({data.length})
        </Link>
      )}
    </div>
  )
}
