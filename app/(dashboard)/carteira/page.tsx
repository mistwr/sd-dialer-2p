'use client'

import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { Wallet, Tv, Zap, Flame, Trophy, TrendingUp } from 'lucide-react'
import { authFetcher } from '@/lib/client/authFetch'

type Linha = { id: string; nome: string; empresa: string; tvs: number; energias: number; pontos: number; top: boolean; euros: number }
type Venda = { id: string; client_name: string | null; service_type: string | null; operator: string | null; plano: string | null; status: string | null; created_at: string; tipo: 'tv' | 'energia' }
type Resp = {
  mes: string; valorPonto: number; regras: { tv: number; energia: number; tvTop: number; energiaTop: number; limiteTv: number; limiteEnergia: number }
  eu: Linha; vendas: Venda[]; ajustes: { id: string; tvs: number; energias: number; nota: string | null }[]
  equipa?: Linha[]; total?: number; error?: string
}

const eur = (v: number) => (v || 0).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })
const pts = (v: number) => String(v).replace('.', ',')

function meses() {
  const out: { v: string; l: string }[] = []
  const d = new Date()
  for (let i = 0; i < 6; i++) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1)
    out.push({ v: `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`, l: x.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' }) })
  }
  return out
}

export default function CarteiraPage() {
  const lista = meses()
  const [mes, setMes] = useState(lista[0].v)
  const { data, isLoading } = useSWR<Resp>(`/api/carteira?mes=${mes}`, authFetcher, { refreshInterval: 20_000 })
  const eu = data?.eu
  const r = data?.regras
  const vp = data?.valorPonto ?? 25
  const progTv = r && eu ? Math.min(100, (eu.tvs / r.limiteTv) * 100) : 0
  const progEn = r && eu ? Math.min(100, (eu.energias / r.limiteEnergia) * 100) : 0
  const prog = Math.max(progTv, progEn)
  const valorTv = eu?.top ? r?.tvTop : r?.tv
  const valorEn = eu?.top ? r?.energiaTop : r?.energia

  return (
    <div className="cart" style={{ maxWidth: 900, margin: '0 auto' }}>
      <style>{CSS}</style>

      <section className="cart-hero">
        <div className="cart-eyebrow"><Wallet size={14} /> CARTEIRA DE COMISSÕES</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div className="cart-label">Já angariaste em {lista.find(x => x.v === mes)?.l}</div>
            <div className="cart-valor">{isLoading && !data ? '…' : eur(eu?.euros || 0)}</div>
            <div className="cart-sub">{pts(eu?.pontos || 0)} pontos × {eur(vp)} por ponto</div>
          </div>
          <select value={mes} onChange={e => setMes(e.target.value)} className="cart-sel">
            {lista.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
          </select>
        </div>

        <div className="cart-kpis">
          <div><Tv size={16} /><b>{eu?.tvs ?? 0}</b><span>TVs · {valorTv ?? 3} pts cada</span></div>
          <div><Zap size={16} /><b>{eu?.energias ?? 0}</b><span>Energias · {pts(valorEn ?? 0.5)} pt cada</span></div>
          <div className={eu?.top ? 'on' : ''}><Flame size={16} /><b>{eu?.top ? 'Ativo' : `${Math.round(prog)}%`}</b><span>Escalão 🔥</span></div>
        </div>

        {r && eu && !eu.top && (
          <div className="cart-prog">
            <div className="cart-bar"><i style={{ width: `${prog}%` }} /></div>
            <div className="cart-prog-txt">
              Faltam <b>{Math.max(0, r.limiteTv - eu.tvs)} TVs</b> ou <b>{Math.max(0, r.limiteEnergia - eu.energias)} energias</b> para o escalão 🔥.
              Aí todas as vendas do mês passam a valer TV {r.tvTop} pts e energia {r.energiaTop} pt.
            </div>
          </div>
        )}
        {eu?.top && <div className="cart-top">🔥 Estás no escalão top: cada TV vale {r?.tvTop} pts e cada energia {r?.energiaTop} pt.</div>}
      </section>

      {data?.equipa && (
        <section className="cart-card">
          <div className="cart-h"><Trophy size={17} /> Comissões da equipa · total {eur(data.total || 0)}</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {data.equipa.map((l, i) => (
              <div key={l.id} className="cart-row">
                <span className="cart-pos">{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.nome}{l.top ? ' 🔥' : ''}</div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>{l.empresa ? `${l.empresa} · ` : ''}📺 {l.tvs} · ⚡ {l.energias} · {pts(l.pontos)} pts</div>
                </div>
                <b style={{ color: '#047857', fontSize: 16 }}>{eur(l.euros)}</b>
              </div>
            ))}
            {data.equipa.length === 0 && <div style={{ color: '#64748B', fontSize: 14 }}>Sem vendas neste mês.</div>}
          </div>
        </section>
      )}

      <section className="cart-card">
        <div className="cart-h"><TrendingUp size={17} /> As minhas vendas deste mês</div>
        {(data?.vendas || []).length === 0 && (data?.ajustes || []).length === 0 && (
          <div style={{ color: '#64748B', fontSize: 14 }}>Ainda sem vendas neste mês. Cada TV vale {r?.tv ?? 3} pontos = {eur((r?.tv ?? 3) * vp)}.</div>
        )}
        <div style={{ display: 'grid', gap: 6 }}>
          {(data?.ajustes || []).map(a => (
            <div key={a.id} className="cart-row">
              <span className="cart-ic">📋</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: '#0F172A' }}>Resultados lançados pelo gestor</div>
                <div style={{ fontSize: 12, color: '#64748B' }}>📺 {a.tvs} TVs · ⚡ {a.energias} energias{a.nota ? ` · ${a.nota}` : ''}</div>
              </div>
            </div>
          ))}
          {(data?.vendas || []).map(v => (
            <div key={v.id} className="cart-row">
              <span className="cart-ic">{v.tipo === 'energia' ? '⚡' : '📺'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.client_name || 'Cliente'}</div>
                <div style={{ fontSize: 12, color: '#64748B' }}>{[v.operator, v.service_type, v.plano].filter(Boolean).join(' · ')} · {new Date(v.created_at).toLocaleDateString('pt-PT')}{v.status ? ` · ${v.status}` : ''}</div>
              </div>
              <b style={{ color: '#047857' }}>+{pts(v.tipo === 'energia' ? (valorEn ?? 0.5) : (valorTv ?? 3))} pts</b>
            </div>
          ))}
        </div>
      </section>

      <p style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center' }}>
        Valores estimados em tempo real a partir das vendas registadas. O pagamento segue as regras e validações da empresa. · <Link href="/gamificacao" style={{ color: '#4F46E5' }}>Ver ranking</Link>
      </p>
    </div>
  )
}

const CSS = `
.cart-hero{position:relative;overflow:hidden;border-radius:26px;padding:24px clamp(16px,3vw,28px);color:#fff;margin-bottom:16px;
  background:radial-gradient(700px 320px at 0% -20%,rgba(52,211,153,.45),transparent 60%),radial-gradient(600px 320px at 110% 10%,rgba(99,102,241,.35),transparent 60%),#04130E;box-shadow:0 30px 70px -30px rgba(4,120,87,.7)}
.cart-eyebrow{display:inline-flex;gap:6px;align-items:center;font-size:11px;letter-spacing:.18em;font-weight:800;color:#A7F3D0;padding:6px 10px;border:1px solid rgba(167,243,208,.3);border-radius:999px;background:rgba(16,185,129,.12);margin-bottom:14px}
.cart-label{font-size:13px;color:#A7F3D0;font-weight:700}
.cart-valor{font-size:clamp(40px,8vw,60px);font-weight:900;letter-spacing:-.03em;line-height:1.05;margin:4px 0;background:linear-gradient(90deg,#fff,#A7F3D0);-webkit-background-clip:text;background-clip:text;color:transparent}
.cart-sub{font-size:14px;color:#D1FAE5}
.cart-sel{background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.18);border-radius:12px;padding:9px 12px;font-size:14px;font-weight:700;text-transform:capitalize}
.cart-sel option{color:#0F172A}
.cart-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:18px}
.cart-kpis div{display:grid;gap:2px;padding:12px;border-radius:16px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1)}
.cart-kpis div.on{background:linear-gradient(135deg,rgba(251,146,60,.3),rgba(239,68,68,.2));border-color:rgba(251,146,60,.5)}
.cart-kpis b{font-size:24px;font-weight:900}
.cart-kpis span{font-size:11.5px;color:#A7F3D0;font-weight:700}
.cart-prog{margin-top:16px}
.cart-bar{height:10px;border-radius:99px;background:rgba(255,255,255,.12);overflow:hidden}
.cart-bar i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#34D399,#FBBF24,#F97316);transition:width .6s}
.cart-prog-txt{font-size:13px;color:#D1FAE5;margin-top:8px;line-height:1.45}
.cart-top{margin-top:14px;padding:10px 12px;border-radius:12px;background:rgba(251,146,60,.18);border:1px solid rgba(251,146,60,.45);font-size:13.5px;font-weight:700}
.cart-card{background:#fff;border:1px solid #E2E8F0;border-radius:20px;padding:16px;margin-bottom:14px;box-shadow:0 10px 30px -20px rgba(15,23,42,.25)}
.cart-h{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:900;color:#0F172A;margin-bottom:12px}
.cart-row{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:14px;background:#F8FAFC;border:1px solid #EEF2F7}
.cart-pos{width:26px;height:26px;border-radius:9px;display:grid;place-items:center;background:#EEF2FF;color:#4338CA;font-weight:900;font-size:13px;flex:none}
.cart-ic{font-size:18px;flex:none}
@media (max-width:560px){.cart-kpis b{font-size:20px}}
`
