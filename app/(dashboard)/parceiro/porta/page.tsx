'use client'
import Link from 'next/link'
import useSWR from 'swr'
import { MapPin, Plus, Phone, Flame, Thermometer, Snowflake, Search } from 'lucide-react'
import { useState } from 'react'
import { doorCaptureService } from '@/lib/services'
import { useAuth } from '@/lib/hooks/useAuth'
import { PageSpinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { RESULTADO_PORTA_LABELS, TEMPERATURA_COLORS } from '@/lib/types'

function TempIcon({ temperatura }: { temperatura: string | null }) {
  if (temperatura === 'quente') return <Flame size={14} color={TEMPERATURA_COLORS.quente} />
  if (temperatura === 'morna') return <Thermometer size={14} color={TEMPERATURA_COLORS.morna} />
  return <Snowflake size={14} color={TEMPERATURA_COLORS.fria} />
}

export default function PortaListPage() {
  const { user } = useAuth()
  const [search, setSearch] = useState('')

  const { data: captures = [], isLoading } = useSWR(
    user?.id ? ['door-captures', user.id] : null,
    () => doorCaptureService.getAll({ comercial_id: user!.id }),
    { refreshInterval: 30000 }
  )

  const filtered = captures.filter(c =>
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    c.telefone.includes(search) ||
    (c.morada ?? '').toLowerCase().includes(search.toLowerCase())
  )

  if (isLoading) return <PageSpinner />

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={22} color="#2563EB" /> Porta → Lead
          </h1>
          <p style={{ fontSize: 13, color: '#64748B', margin: '4px 0 0' }}>
            {captures.length} captações registadas
          </p>
        </div>
      </div>

      <Link
        href="/parceiro/porta/nova"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: '#2563EB', color: '#fff', textDecoration: 'none',
          padding: '14px 20px', borderRadius: 14, fontSize: 15, fontWeight: 700,
          marginBottom: 18, boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
        }}
      >
        <Plus size={19} /> Nova captação
      </Link>

      <div style={{ position: 'relative', marginBottom: 14 }}>
        <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Pesquisar por nome, telefone ou morada..."
          style={{
            width: '100%', padding: '11px 14px 11px 38px', borderRadius: 12,
            border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title={captures.length === 0 ? 'Ainda não fizeste nenhuma captação' : 'Sem resultados'}
          description={captures.length === 0 ? 'Toca em "Nova captação" para registares a tua primeira abordagem de porta.' : 'Tenta outra pesquisa.'}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(c => (
            <Link key={c.id} href={`/parceiro/porta/${c.id}`} style={{
              background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14,
              padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8,
              textDecoration: 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#0F172A' }}>{c.nome}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: TEMPERATURA_COLORS[c.temperatura ?? 'fria'] }}>
                  <TempIcon temperatura={c.temperatura} /> {c.score}/100
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#64748B' }}>
                <Phone size={13} /> {c.telefone}
              </div>
              {c.morada && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#64748B' }}>
                  <MapPin size={13} /> {c.morada}{c.localidade ? `, ${c.localidade}` : ''}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                {c.resultado && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
                    background: c.resultado === 'venda' ? '#F0FDF4' : c.resultado === 'sem_interesse' ? '#FEF2F2' : '#EFF6FF',
                    color: c.resultado === 'venda' ? '#16A34A' : c.resultado === 'sem_interesse' ? '#DC2626' : '#2563EB',
                  }}>
                    {RESULTADO_PORTA_LABELS[c.resultado]}
                  </span>
                )}
                <span style={{ fontSize: 11, color: '#94A3B8', marginLeft: 'auto' }}>
                  {new Date(c.created_at).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
