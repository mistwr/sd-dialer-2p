'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { CheckCircle2, Circle, Rocket, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { authFetch } from '@/lib/client/authFetch'

// Guia para quem entra pela primeira vez: o que fazer, por ordem, sem usar o robot.
export default function PrimeirosPassos({ userId }: { userId?: string | null }) {
  const [fechado, setFechado] = useState(true)
  useEffect(() => {
    try { setFechado(localStorage.getItem(`primeiros-passos-${userId}`) === '1') } catch { setFechado(false) }
  }, [userId])

  const { data } = useSWR(userId ? ['primeiros-passos', userId] : null, async () => {
    const sb = createClient()
    const [prog, ch, fu, vd] = await Promise.all([
      authFetch('/api/formacao/progresso').then(r => r.json()).catch(() => ({})),
      sb.from('call_history').select('id', { count: 'exact', head: true }).eq('parceiro_id', String(userId)),
      sb.from('follow_ups').select('id', { count: 'exact', head: true }).eq('parceiro_id', String(userId)),
      sb.from('vendas').select('id', { count: 'exact', head: true }).eq('seller_id', String(userId)).is('deleted_at', null),
    ])
    const p = prog?.progresso || {}
    return [
      { feito: !!p.comecar, titulo: 'Faz o módulo "Começa aqui" da Formação', href: '/formacao' },
      { feito: (ch.count ?? 0) > 0, titulo: 'Abre uma lead, carrega em Ligar e regista o resultado', href: '/parceiro' },
      { feito: (fu.count ?? 0) > 0, titulo: 'Marca um "Ligar depois" com dia e hora', href: '/parceiro/agenda' },
      { feito: !!p['metodo-aedcrafam'], titulo: 'Aprende o método AEDCRAFAM (guião da chamada)', href: '/formacao' },
      { feito: (vd.count ?? 0) > 0, titulo: 'Regista a tua primeira venda', href: '/parceiro/vendas' },
    ]
  })

  if (!data || fechado) return null
  const feitos = data.filter(d => d.feito).length
  if (feitos === data.length) return null

  return (
    <div style={{ background: 'linear-gradient(135deg,#EFF6FF,#F5F3FF)', border: '1px solid #DBEAFE', borderRadius: 16, padding: '14px 16px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 900, fontSize: 15, color: '#0F172A' }}>
          <Rocket size={17} /> Primeiros passos · {feitos}/{data.length}
        </div>
        <button aria-label="Fechar" onClick={() => { try { localStorage.setItem(`primeiros-passos-${userId}`, '1') } catch {} ; setFechado(true) }}
          style={{ border: 0, background: 'transparent', color: '#64748B', cursor: 'pointer' }}><X size={16} /></button>
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        {data.map((d, i) => (
          <Link key={i} href={d.href} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: d.feito ? '#64748B' : '#0F172A', textDecoration: d.feito ? 'line-through' : 'none', fontWeight: d.feito ? 500 : 700 }}>
            {d.feito ? <CheckCircle2 size={16} color="#16A34A" /> : <Circle size={16} color="#94A3B8" />} {d.titulo}
          </Link>
        ))}
      </div>
    </div>
  )
}
