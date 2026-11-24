'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { Bot, Timer, Users, PhoneCall, Trophy, AlertTriangle, Settings2, Shuffle, CheckCircle2, Clock } from 'lucide-react'
import { authFetch, authFetcher } from '@/lib/client/authFetch'

type Def = { ativo: boolean; sla_minutos: number; hora_inicio: number; hora_fim: number; dias: number[]; max_reatribuicoes: number; excluidos: string[] }
type Resp = {
  instalado: boolean; podeEditar?: boolean; dias?: number; definicoes?: Def
  kpis?: { qualificadas: number; emCurso: number; atrasadas: number; semVendedor: number; contactadas: number; aTempoPct: number | null; respostaMedianaMin: number | null; vendas: number; conversaoPct: number | null; reatribuidas: number }
  emCurso?: Array<{ id: string; leadId: string; nome: string; nivel: string; estado: string; vendedor: string | null; vendedorId: string | null; prazo: string | null; reatribuicoes: number; criada: string }>
  recentes?: Array<{ id: string; leadId: string; nome: string; estado: string; resultado: string | null; vendedor: string | null; minutos: number; aTempo: boolean }>
  vendedores?: Array<{ id: string; nome: string; ativo: boolean; participa: boolean; recebidas: number; emCurso: number; contactadas: number; aTempo: number; vendas: number; perdeuPrazo: number; respostaMedianaMin: number | null }>
  error?: string
}

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const card: React.CSSProperties = { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 16, marginBottom: 14 }
const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.04em', padding: '8px 10px', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { fontSize: 13.5, padding: '9px 10px', borderBottom: '1px solid #F1F5F9', verticalAlign: 'middle' }
const RES: Record<string, string> = { venda: 'Venda', perdida: 'Sem interesse', contactada: 'Contactada' }

function min(n: number | null | undefined) {
  if (n == null) return '—'
  if (n < 60) return `${n} min`
  return `${Math.floor(n / 60)}h${String(n % 60).padStart(2, '0')}`
}

function Kpi({ icon: Icon, label, valor, sub, cor }: { icon: any; label: string; valor: string | number; sub?: string; cor: string }) {
  return (
    <div style={{ ...card, marginBottom: 0, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12.5, color: '#64748B', fontWeight: 600 }}>{label}</span>
        <span style={{ width: 30, height: 30, borderRadius: 9, background: cor + '18', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={16} color={cor} /></span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 900, marginTop: 4, color: '#0F172A' }}>{valor}</div>
      {sub && <div style={{ fontSize: 12, color: '#64748B' }}>{sub}</div>}
    </div>
  )
}

function PrazoCel({ prazo, agora }: { prazo: string | null; agora: number }) {
  if (!prazo) return <span style={{ color: '#94A3B8' }}>—</span>
  const ms = new Date(prazo).getTime() - agora
  const hora = new Date(prazo).toLocaleString('pt-PT', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
  if (ms <= 0) return <span style={{ color: '#B91C1C', fontWeight: 800 }}>Atrasada ({min(Math.round(-ms / 60000))})</span>
  const m = Math.ceil(ms / 60000)
  return <span style={{ color: m <= 10 ? '#B91C1C' : '#334155', fontWeight: 700 }}>{hora} · {min(m)}</span>
}

function Definicoes({ def, vendedores, onSaved }: { def: Def; vendedores: NonNullable<Resp['vendedores']>; onSaved: () => void }) {
  const [f, setF] = useState<Def>(def)
  const [msg, setMsg] = useState('')
  const [aGuardar, setAGuardar] = useState(false)
  useEffect(() => setF(def), [def])
  const set = (k: keyof Def, v: any) => setF(p => ({ ...p, [k]: v }))
  async function guardar() {
    setAGuardar(true); setMsg('')
    try {
      const r = await authFetch('/api/admin/robot-fluxo', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) })
      const d = await r.json().catch(() => ({}))
      setMsg(r.ok ? 'Guardado.' : d?.error || 'Não foi possível guardar.')
      if (r.ok) onSaved()
    } finally { setAGuardar(false) }
  }
  const inp: React.CSSProperties = { width: 80, padding: '7px 9px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14 }
  return (
    <div style={card}>
      <div style={{ fontWeight: 900, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}><Settings2 size={18} /> Regras do fluxo</div>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
        <input type="checkbox" checked={f.ativo} onChange={e => set('ativo', e.target.checked)} /> Distribuir automaticamente as leads quentes do robot
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13.5, marginBottom: 12 }}>
        <label>Prazo para ligar (min)<br /><input type="number" min={5} max={1440} value={f.sla_minutos} onChange={e => set('sla_minutos', Number(e.target.value))} style={inp} /></label>
        <label>Das (hora)<br /><input type="number" min={0} max={23} value={f.hora_inicio} onChange={e => set('hora_inicio', Number(e.target.value))} style={inp} /></label>
        <label>Até (hora)<br /><input type="number" min={1} max={24} value={f.hora_fim} onChange={e => set('hora_fim', Number(e.target.value))} style={inp} /></label>
        <label>Passar no máximo<br /><input type="number" min={0} max={10} value={f.max_reatribuicoes} onChange={e => set('max_reatribuicoes', Number(e.target.value))} style={inp} /> vezes</label>
      </div>
      <div style={{ fontSize: 13.5, marginBottom: 6 }}>Dias de trabalho</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {DIAS.map((d, i) => {
          const on = f.dias.includes(i + 1)
          return <button key={d} type="button" onClick={() => set('dias', on ? f.dias.filter(x => x !== i + 1) : [...f.dias, i + 1].sort())}
            style={{ padding: '6px 11px', borderRadius: 999, border: '1.5px solid ' + (on ? '#2563EB' : '#E2E8F0'), background: on ? '#EFF6FF' : '#fff', color: on ? '#1D4ED8' : '#64748B', fontWeight: 800, fontSize: 12.5, cursor: 'pointer' }}>{d}</button>
        })}
      </div>
      <div style={{ fontSize: 13.5, marginBottom: 6 }}>Quem recebe leads do robot</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {vendedores.filter(v => v.ativo).map(v => {
          const on = !f.excluidos.includes(v.id)
          return <button key={v.id} type="button" onClick={() => set('excluidos', on ? [...f.excluidos, v.id] : f.excluidos.filter(x => x !== v.id))}
            style={{ padding: '6px 11px', borderRadius: 999, border: '1.5px solid ' + (on ? '#16A34A' : '#E2E8F0'), background: on ? '#F0FDF4' : '#fff', color: on ? '#166534' : '#94A3B8', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', textDecoration: on ? 'none' : 'line-through' }}>{v.nome}</button>
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={guardar} disabled={aGuardar} style={{ background: '#0F172A', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontWeight: 800, cursor: 'pointer' }}>{aGuardar ? 'A guardar…' : 'Guardar regras'}</button>
        {msg && <span style={{ fontSize: 13, color: msg === 'Guardado.' ? '#166534' : '#B91C1C', fontWeight: 700 }}>{msg}</span>}
      </div>
      <p style={{ fontSize: 12, color: '#64748B', margin: '10px 0 0' }}>O prazo só conta dentro do horário e dos dias escolhidos (hora de Lisboa). Uma lead quente que chegue à noite tem prazo a contar da abertura do dia seguinte.</p>
    </div>
  )
}

export default function FluxoRobotPage() {
  const [dias, setDias] = useState(7)
  const { data, mutate } = useSWR<Resp>(`/api/admin/robot-fluxo?dias=${dias}`, authFetcher, { refreshInterval: 30_000 })
  const [agora, setAgora] = useState(() => Date.now())
  const [aPassar, setAPassar] = useState<string | null>(null)
  const [aviso, setAviso] = useState('')
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 30_000); return () => clearInterval(t) }, [])

  async function passar(handoffId: string, para: string) {
    setAPassar(handoffId); setAviso('')
    try {
      const r = await authFetch('/api/admin/robot-fluxo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ handoffId, para: para || undefined }) })
      const d = await r.json().catch(() => ({}))
      setAviso(r.ok ? 'Lead passada.' : d?.error || 'Não foi possível passar a lead.')
      mutate()
    } finally { setAPassar(null) }
  }

  const k = data?.kpis
  const vendedores = data?.vendedores || []

  return (
    <div className="mx-auto min-w-0 max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
      <div style={{ borderRadius: 20, padding: '20px 22px', marginBottom: 16, color: '#fff', background: 'linear-gradient(120deg,#1E1B4B 0%,#312E81 55%,#4C1D95 100%)' }}>
        <div style={{ fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: '#C4B5FD', fontWeight: 800 }}>Robot → vendedor</div>
        <h1 style={{ margin: '6px 0 4px', fontSize: 26, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 10 }}><Bot size={24} /> Fluxo das leads quentes</h1>
        <p style={{ margin: 0, fontSize: 13.5, color: 'rgba(255,255,255,.82)', maxWidth: 680 }}>
          O robot qualifica, o sistema entrega na hora ao vendedor com menos leads por tratar e controla o prazo. Se ninguém ligar a tempo, a lead passa a outro e és avisado.
        </p>
      </div>

      {data && data.instalado === false && (
        <div style={{ ...card, borderColor: '#FDE68A', background: '#FFFBEB' }}>
          <b>O fluxo automático ainda não está ativo.</b> Falta instalar as regras na base de dados. Até lá, as leads continuam a ser passadas à mão em Superadmin IA.
        </div>
      )}
      {data?.error && <div style={{ ...card, borderColor: '#FECACA', background: '#FEF2F2', color: '#991B1B' }}>{data.error}</div>}

      {data?.instalado && k && (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {[1, 7, 30].map(d => (
              <button key={d} onClick={() => setDias(d)} style={{ padding: '7px 13px', borderRadius: 999, fontSize: 13, fontWeight: 800, cursor: 'pointer', border: '1.5px solid ' + (dias === d ? '#312E81' : '#E2E8F0'), background: dias === d ? '#312E81' : '#fff', color: dias === d ? '#fff' : '#334155' }}>{d === 1 ? 'Hoje' : `${d} dias`}</button>
            ))}
            {!data.definicoes?.ativo && <span style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: 12.5, fontWeight: 800, color: '#B45309' }}>Distribuição automática desligada</span>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10, marginBottom: 14 }}>
            <Kpi icon={Bot} label="Qualificadas pelo robot" valor={k.qualificadas} cor="#7C3AED" />
            <Kpi icon={Timer} label="À espera de chamada" valor={k.emCurso} sub={k.atrasadas ? `${k.atrasadas} com prazo ultrapassado` : 'nenhuma atrasada'} cor={k.atrasadas ? '#DC2626' : '#2563EB'} />
            <Kpi icon={Clock} label="Tempo de resposta" valor={min(k.respostaMedianaMin)} sub="mediana até à 1.ª chamada" cor="#0891B2" />
            <Kpi icon={CheckCircle2} label="Ligadas a tempo" valor={k.aTempoPct == null ? '—' : `${k.aTempoPct}%`} sub={`${k.contactadas} contactadas`} cor="#16A34A" />
            <Kpi icon={Trophy} label="Vendas" valor={k.vendas} sub={k.conversaoPct == null ? undefined : `${k.conversaoPct}% das qualificadas`} cor="#D97706" />
            <Kpi icon={Shuffle} label="Passadas por prazo" valor={k.reatribuidas} sub={k.semVendedor ? `${k.semVendedor} sem vendedor` : undefined} cor="#9333EA" />
          </div>

          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ fontWeight: 900, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}><PhoneCall size={18} /> À espera de chamada</div>
              {aviso && <span style={{ fontSize: 13, fontWeight: 700, color: aviso === 'Lead passada.' ? '#166534' : '#B91C1C' }}>{aviso}</span>}
            </div>
            {!data.emCurso?.length ? <div style={{ fontSize: 13.5, color: '#64748B' }}>Nenhuma lead quente à espera. 👌</div> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={th}>Lead</th><th style={th}>Interesse</th><th style={th}>Vendedor</th><th style={th}>Prazo</th><th style={th}>Passar a</th></tr></thead>
                  <tbody>
                    {data.emCurso.map(h => (
                      <tr key={h.id}>
                        <td style={td}><Link href={`/parceiro/leads/${h.leadId}`} style={{ fontWeight: 800, color: '#0F172A' }}>{h.nome}</Link>{h.reatribuicoes > 0 && <span style={{ fontSize: 11, color: '#9333EA', marginLeft: 6 }}>passada {h.reatribuicoes}×</span>}</td>
                        <td style={td}><span style={{ fontSize: 11.5, fontWeight: 800, borderRadius: 999, padding: '2px 8px', background: h.nivel === 'alto' ? '#DCFCE7' : '#FEF9C3', color: h.nivel === 'alto' ? '#166534' : '#854D0E' }}>{h.nivel === 'alto' ? 'Alto' : 'Médio'}</span></td>
                        <td style={td}>{h.estado === 'sem_vendedor' ? <span style={{ color: '#B91C1C', fontWeight: 800 }}>Sem vendedor</span> : h.vendedor}</td>
                        <td style={td}><PrazoCel prazo={h.prazo} agora={agora} /></td>
                        <td style={td}>
                          <select disabled={aPassar === h.id} defaultValue="" onChange={e => { const v = e.target.value; e.target.value = ''; if (v) passar(h.id, v === 'auto' ? '' : v) }}
                            style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}>
                            <option value="">Escolher…</option>
                            <option value="auto">Quem tem menos</option>
                            {vendedores.filter(v => v.ativo && v.id !== h.vendedorId).map(v => <option key={v.id} value={v.id}>{v.nome} ({v.emCurso} em espera)</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={card}>
            <div style={{ fontWeight: 900, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}><Users size={18} /> Equipa</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>Vendedor</th><th style={th}>Recebidas</th><th style={th}>Em espera</th><th style={th}>Contactadas</th><th style={th}>A tempo</th><th style={th}>Resposta</th><th style={th}>Perdeu prazo</th><th style={th}>Vendas</th></tr></thead>
                <tbody>
                  {vendedores.filter(v => v.ativo || v.recebidas).map(v => (
                    <tr key={v.id} style={{ opacity: v.participa ? 1 : 0.55 }}>
                      <td style={td}><b>{v.nome}</b>{!v.participa && <span style={{ fontSize: 11, color: '#94A3B8', marginLeft: 6 }}>não recebe</span>}</td>
                      <td style={td}>{v.recebidas}</td>
                      <td style={td}>{v.emCurso}</td>
                      <td style={td}>{v.contactadas}</td>
                      <td style={td}>{v.contactadas ? `${Math.round((v.aTempo / v.contactadas) * 100)}%` : '—'}</td>
                      <td style={td}>{min(v.respostaMedianaMin)}</td>
                      <td style={{ ...td, color: v.perdeuPrazo ? '#B91C1C' : undefined, fontWeight: v.perdeuPrazo ? 800 : undefined }}>{v.perdeuPrazo}</td>
                      <td style={{ ...td, fontWeight: 900, color: v.vendas ? '#166534' : undefined }}>{v.vendas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {!!data.recentes?.length && (
            <div style={card}>
              <div style={{ fontWeight: 900, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}><CheckCircle2 size={18} /> Últimas contactadas</div>
              <div style={{ display: 'grid', gap: 6 }}>
                {data.recentes.map(r => (
                  <div key={r.id} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13.5, flexWrap: 'wrap' }}>
                    <Link href={`/parceiro/leads/${r.leadId}`} style={{ fontWeight: 800, color: '#0F172A' }}>{r.nome}</Link>
                    <span style={{ color: '#64748B' }}>{r.vendedor} · ligou em {min(r.minutos)}</span>
                    {!r.aTempo && <span style={{ fontSize: 11, fontWeight: 800, color: '#B91C1C' }}>fora do prazo</span>}
                    <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 800, color: r.estado === 'venda' ? '#166534' : r.estado === 'perdida' ? '#64748B' : '#1D4ED8' }}>{RES[r.estado] || r.estado}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.podeEditar && data.definicoes && <Definicoes def={data.definicoes} vendedores={vendedores} onSaved={() => mutate()} />}
        </>
      )}

      {!data && <div style={{ ...card, color: '#64748B' }}>A carregar…</div>}
      {data?.instalado && k && k.atrasadas > 0 && (
        <div style={{ position: 'sticky', bottom: 12, ...card, borderColor: '#FECACA', background: '#FEF2F2', display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700, color: '#991B1B' }}>
          <AlertTriangle size={18} /> {k.atrasadas} lead{k.atrasadas > 1 ? 's' : ''} quente{k.atrasadas > 1 ? 's' : ''} com prazo ultrapassado.
        </div>
      )}
    </div>
  )
}
