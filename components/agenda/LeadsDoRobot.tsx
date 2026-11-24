'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { Bot, ChevronRight } from 'lucide-react'
import { authFetcher } from '@/lib/client/authFetch'

type Row = { leadId: string; nome: string; telefone: string; estado: string | null; nivel: string; resumo: string; proximoPasso: string; operadora: string | null; valor: string | null; agendado: string | null; quando: string }

const FECHADO = new Set(['venda', 'nao_interessado', 'numero_errado', 'numero_nao_atribuido', 'pertence_outra_pessoa'])

// Leads que o robot qualificou e que o admin passou a este vendedor. O vendedor não usa o robot: só liga a estas leads.
export default function LeadsDoRobot({ userId }: { userId?: string | null }) {
  const { data } = useSWR<{ rows?: Row[] }>(userId ? '/api/parceiro/leads-robot' : null, authFetcher, { refreshInterval: 120_000 })
  const rows = Array.isArray(data?.rows) ? data!.rows : []
  if (!rows.length) return null
  const porLigar = rows.filter(r => !FECHADO.has(String(r.estado))).length

  return (
    <div style={{ background: '#fff', border: '1px solid #DDD6FE', borderRadius: 16, padding: '14px 16px', marginBottom: 16, boxShadow: '0 1px 0 rgba(124,58,237,.08)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 900, fontSize: 15, color: '#4C1D95' }}>
          <span style={{ width: 30, height: 30, borderRadius: 9, background: '#F5F3FF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Bot size={17} color="#7C3AED" /></span>
          Leads qualificadas pelo robot
        </div>
        {porLigar > 0 && <span style={{ fontSize: 12, fontWeight: 800, background: '#7C3AED', color: '#fff', borderRadius: 999, padding: '3px 10px' }}>{porLigar} por ligar</span>}
      </div>
      <p style={{ margin: '0 0 10px', fontSize: 12.5, color: '#64748B' }}>Já falaram com o robot e mostraram interesse. Lê o resumo antes de ligar: assim sabes logo a operadora e quanto pagam.</p>
      <div style={{ display: 'grid', gap: 8 }}>
        {rows.slice(0, 8).map(r => {
          const feito = FECHADO.has(String(r.estado))
          return (
            <Link key={r.leadId} href={`/parceiro/leads/${r.leadId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 12, background: feito ? '#F8FAFC' : '#FAF5FF', border: '1px solid ' + (feito ? '#E2E8F0' : '#EDE9FE'), opacity: feito ? 0.7 : 1 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: 14, color: '#0F172A' }}>{r.nome}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 800, borderRadius: 999, padding: '2px 8px', background: r.nivel === 'alto' ? '#DCFCE7' : '#FEF9C3', color: r.nivel === 'alto' ? '#166534' : '#854D0E' }}>Interesse {r.nivel === 'alto' ? 'alto' : 'médio'}</span>
                    {feito && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#64748B' }}>já tratada</span>}
                  </div>
                  <div style={{ fontSize: 12.5, color: '#475569', marginTop: 2 }}>
                    {[r.operadora && `Operadora: ${r.operadora}`, r.valor && `Paga: ${r.valor}`, r.agendado && `Consultor: ${r.agendado}`].filter(Boolean).join(' · ') || r.proximoPasso || 'Ver resumo da chamada'}
                  </div>
                  {r.resumo && <div style={{ fontSize: 12, color: '#64748B', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.resumo}</div>}
                </div>
                <ChevronRight size={18} color="#A78BFA" />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
