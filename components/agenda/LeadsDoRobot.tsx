'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { Bot, ChevronRight, Timer } from 'lucide-react'
import { authFetcher } from '@/lib/client/authFetch'

type Row = {
  leadId: string; nome: string; telefone: string; estado: string | null; porLigar: boolean; prazo: string | null
  nivel: string; resumo: string; proximoPasso: string; operadora: string | null; valor: string | null; agendado: string | null; quando: string
}

const ESTADO: Record<string, string> = { venda: 'venda feita', perdida: 'sem interesse', contactada: 'contactada', nao_interessado: 'sem interesse', ligar_depois: 'ligar depois' }

function Prazo({ prazo, agora }: { prazo: string; agora: number }) {
  const ms = new Date(prazo).getTime() - agora
  const hora = new Date(prazo).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
  const amanha = new Date(prazo).toDateString() !== new Date(agora).toDateString()
  if (ms <= 0) return <span style={pill('#FEE2E2', '#991B1B')}><Timer size={11} /> Prazo terminou — liga já</span>
  const min = Math.ceil(ms / 60000)
  if (amanha && min > 60) return <span style={pill('#E0E7FF', '#3730A3')}><Timer size={11} /> Liga até {new Date(prazo).toLocaleDateString('pt-PT', { weekday: 'short' })} {hora}</span>
  const urgente = min <= 10
  return <span style={pill(urgente ? '#FEE2E2' : '#FEF3C7', urgente ? '#991B1B' : '#92400E')}><Timer size={11} /> Liga até {hora} · faltam {min >= 60 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}` : `${min} min`}</span>
}

function pill(bg: string, color: string): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 800, borderRadius: 999, padding: '2px 8px', background: bg, color }
}

// Leads que o robot qualificou e que o sistema passou a este vendedor. O vendedor não usa o robot: só liga a estas leads, dentro do prazo.
export default function LeadsDoRobot({ userId }: { userId?: string | null }) {
  const { data } = useSWR<{ rows?: Row[]; fluxo?: boolean }>(userId ? '/api/parceiro/leads-robot' : null, authFetcher, { refreshInterval: 60_000 })
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 30_000); return () => clearInterval(t) }, [])
  const rows = Array.isArray(data?.rows) ? data!.rows : []
  if (!rows.length) return null
  const porLigar = rows.filter(r => r.porLigar).length

  return (
    <div style={{ background: '#fff', border: '1px solid #DDD6FE', borderRadius: 16, padding: '14px 16px', marginBottom: 16, boxShadow: '0 1px 0 rgba(124,58,237,.08)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 900, fontSize: 15, color: '#4C1D95' }}>
          <span style={{ width: 30, height: 30, borderRadius: 9, background: '#F5F3FF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Bot size={17} color="#7C3AED" /></span>
          Leads quentes do robot
        </div>
        {porLigar > 0 && <span style={{ fontSize: 12, fontWeight: 800, background: '#7C3AED', color: '#fff', borderRadius: 999, padding: '3px 10px' }}>{porLigar} por ligar</span>}
      </div>
      <p style={{ margin: '0 0 10px', fontSize: 12.5, color: '#64748B' }}>
        Já falaram com o robot e mostraram interesse. Lê o resumo e liga dentro do prazo{data?.fluxo ? ': se não ligares a tempo, a lead passa a um colega.' : '.'}
      </p>
      <div style={{ display: 'grid', gap: 8 }}>
        {rows.slice(0, 10).map(r => (
          <Link key={r.leadId} href={`/parceiro/leads/${r.leadId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 12, background: r.porLigar ? '#FAF5FF' : '#F8FAFC', border: '1px solid ' + (r.porLigar ? '#EDE9FE' : '#E2E8F0'), opacity: r.porLigar ? 1 : 0.72 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 800, fontSize: 14, color: '#0F172A' }}>{r.nome}</span>
                  <span style={pill(r.nivel === 'alto' ? '#DCFCE7' : '#FEF9C3', r.nivel === 'alto' ? '#166534' : '#854D0E')}>Interesse {r.nivel === 'alto' ? 'alto' : 'médio'}</span>
                  {r.porLigar && r.prazo && <Prazo prazo={r.prazo} agora={agora} />}
                  {!r.porLigar && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#64748B' }}>{ESTADO[String(r.estado)] || 'tratada'}</span>}
                </div>
                <div style={{ fontSize: 12.5, color: '#475569', marginTop: 2 }}>
                  {[r.operadora && `Operadora: ${r.operadora}`, r.valor && `Paga: ${r.valor}`, r.agendado && `Consultor: ${r.agendado}`].filter(Boolean).join(' · ') || r.proximoPasso || 'Ver resumo da chamada'}
                </div>
                {r.resumo && <div style={{ fontSize: 12, color: '#64748B', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.resumo}</div>}
              </div>
              <ChevronRight size={18} color="#A78BFA" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
