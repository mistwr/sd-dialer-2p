'use client'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { FASES } from '@/lib/porta-funil'
import { PageSpinner } from '@/components/ui/Spinner'

type Row = {
  comercial_id: string; fase_final: string; resultado: string | null; motivo_recusa: string | null
  proposta_apresentada: boolean | null; comparacao_feita: boolean | null; referencia_consentida: boolean | null
  created_at: string; finished_at: string | null
}
type User = { id: string; full_name: string | null }

const box: React.CSSProperties = { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 18 }
const th: React.CSSProperties = { padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }
const td: React.CSSProperties = { padding: '9px 12px', fontSize: 13, color: '#374151' }
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—')

export function RelatorioQuestionario({ companyId, comercialId, from, to, usuarios }: {
  companyId: string; comercialId: string; from: string; to: string; usuarios: User[]
}) {
  const { data: rows, isLoading } = useSWR(['relatorio-questionario', companyId, comercialId, from, to], async () => {
    const sb = createClient()
    let q = sb.from('door_funnel_captures')
      .select('comercial_id,fase_final,resultado,motivo_recusa,proposta_apresentada,comparacao_feita,referencia_consentida,created_at,finished_at')
      .eq('company_id', companyId).order('created_at', { ascending: false }).limit(5000)
    if (comercialId) q = q.eq('comercial_id', comercialId)
    if (from) q = q.gte('created_at', from)
    if (to) q = q.lte('created_at', `${to}T23:59:59`)
    const { data, error } = await q
    if (error) throw error
    return (data ?? []) as Row[]
  })

  if (isLoading || !rows) return <PageSpinner />
  const nome = (id: string) => usuarios.find(u => u.id === id)?.full_name ?? 'Sem nome'
  const total = rows.length
  const fechos = rows.filter(r => r.resultado === 'fechado').length
  const propostas = rows.filter(r => r.proposta_apresentada).length
  const comparacoes = rows.filter(r => r.comparacao_feita).length
  const refs = rows.filter(r => r.referencia_consentida).length
  const semRede = rows.filter(r => r.finished_at && new Date(r.finished_at).getTime() - new Date(r.created_at).getTime() > 5 * 60_000).length

  // Funil: quantas conversas chegaram pelo menos a cada fase
  const idx = (f: string) => FASES.findIndex(x => x.id === f)
  const funil = FASES.map((f, i) => ({ ...f, n: rows.filter(r => idx(r.fase_final) >= i).length }))

  const porVend = Object.values(rows.reduce((acc: Record<string, any>, r) => {
    const v = (acc[r.comercial_id] ??= { id: r.comercial_id, total: 0, propostas: 0, fechos: 0, pensar: 0, nao: 0, fases: Array(FASES.length).fill(0) })
    v.total++; if (r.proposta_apresentada) v.propostas++
    if (r.resultado === 'fechado') v.fechos++
    else if (r.resultado === 'vai_pensar') v.pensar++
    else if (r.resultado === 'sem_interesse') v.nao++
    const i = idx(r.fase_final); if (i >= 0) v.fases[i]++
    return acc
  }, {}) as Record<string, any>).sort((a: any, b: any) => b.total - a.total)

  const motivos = Object.entries(rows.reduce((acc: Record<string, number>, r) => {
    if (r.motivo_recusa) acc[r.motivo_recusa] = (acc[r.motivo_recusa] ?? 0) + 1
    return acc
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 8)

  if (total === 0) return <div style={{ ...box, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>Ainda sem questionários neste período.</div>

  const cards: [string, string | number][] = [
    ['Conversas', total], ['Fechos', `${fechos} (${pct(fechos, total)})`], ['Comparações feitas', `${comparacoes} (${pct(comparacoes, total)})`],
    ['Propostas apresentadas', `${propostas} (${pct(propostas, total)})`], ['Referências obtidas', refs], ['Guardados sem rede', semRede],
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        {cards.map(([l, v]) => (
          <div key={l} style={box}><div style={{ fontSize: 12, color: '#64748B' }}>{l}</div><div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A' }}>{v}</div></div>
        ))}
      </div>

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Onde se perdem as conversas (fase a fase)</div>
        {funil.map((f, i) => (
          <div key={f.id + i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 110, fontSize: 13 }}>{f.letra} · {f.nome}</div>
            <div style={{ flex: 1, background: '#F1F5F9', borderRadius: 6, height: 14 }}>
              <div style={{ width: `${total ? (f.n / total) * 100 : 0}%`, background: '#2563EB', height: 14, borderRadius: 6 }} />
            </div>
            <div style={{ width: 90, fontSize: 12.5, fontWeight: 700, textAlign: 'right' }}>{f.n} · {pct(f.n, total)}</div>
          </div>
        ))}
      </div>

      <div style={{ ...box, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', fontSize: 14, fontWeight: 700 }}>Por vendedor</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead><tr style={{ background: '#F8FAFC' }}>
              {['Vendedor', 'Conversas', 'Propostas', 'Fechos', 'Vai pensar', 'Sem interesse', 'Taxa fecho', 'Perde mais em'].map(h => <th key={h} style={th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {porVend.map((v: any) => {
                // fase onde terminaram mais conversas sem fechar
                const perdas = v.fases.map((n: number, i: number) => (i < 5 ? n : 0))
                const max = Math.max(...perdas)
                const fase = max > 0 ? FASES[perdas.indexOf(max)].nome : '—'
                return (
                  <tr key={v.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                    <td style={{ ...td, fontWeight: 600 }}>{nome(v.id)}</td><td style={td}>{v.total}</td><td style={td}>{v.propostas}</td>
                    <td style={td}>{v.fechos}</td><td style={td}>{v.pensar}</td><td style={td}>{v.nao}</td>
                    <td style={{ ...td, fontWeight: 700, color: '#16A34A' }}>{pct(v.fechos, v.total)}</td><td style={td}>{fase}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Motivos de recusa</div>
        {motivos.length === 0 ? <div style={{ fontSize: 13, color: '#94A3B8' }}>Sem dados</div> : motivos.map(([k, n]) => (
          <div key={k} style={{ display: 'flex', gap: 10, marginBottom: 6, fontSize: 13 }}><div style={{ flex: 1 }}>{k}</div><b style={{ color: '#2563EB' }}>{n}</b></div>
        ))}
      </div>
    </div>
  )
}
