'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { Phone, Pencil, Check, Tv, Zap, Users } from 'lucide-react'
import { authFetch, authFetcher } from '@/lib/client/authFetch'

type Pessoa = { id: string; nome: string; empresa: string; avatar: string | null; chamadas: number; conversas: number; vendas: number; euros: number }
type Feed = { id: string; vendedor: string; empresa: string; tipo: 'tv' | 'energia'; operador: string; euros: number; quando: string }
type Resp = {
  eu: string; podeEditar: boolean; valorPonto: number
  total: { euros: number; vendas: number; tvs: number; energias: number; chamadas: number; ativos: number }
  objetivo: number; rankingChamadas: Pessoa[]; feed: Feed[]; atualizado: string; error?: string
}

const eur = (v: number) => (v || 0).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const ini = (n: string) => n.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
function ha(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  return m < 1 ? 'agora mesmo' : m < 60 ? `há ${m} min` : `há ${Math.floor(m / 60)} h`
}

export function PainelHoje() {
  const { data, mutate } = useSWR<Resp>('/api/gamificacao/hoje', authFetcher, { refreshInterval: 10_000 })
  const [editar, setEditar] = useState(false)
  const [obj, setObj] = useState('')
  const vistos = useRef<Set<string> | null>(null)
  const [novos, setNovos] = useState<Set<string>>(new Set())

  // destacar vendas que chegaram desde a última atualização
  useEffect(() => {
    if (!data?.feed) return
    const ids = data.feed.map((f) => f.id)
    if (vistos.current) {
      const n = new Set(ids.filter((id) => !vistos.current!.has(id)))
      if (n.size) { setNovos(n); setTimeout(() => setNovos(new Set()), 6000) }
    }
    vistos.current = new Set(ids)
  }, [data?.feed])

  if (!data || data.error) return null
  const t = data.total
  const pct = data.objetivo > 0 ? Math.min(100, (t.euros / data.objetivo) * 100) : 0
  const rk = data.rankingChamadas
  const euPos = rk.findIndex((p) => p.id === data.eu)

  async function guardarObjetivo() {
    await authFetch('/api/gamificacao/hoje', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eur: obj }) })
    setEditar(false); mutate()
  }

  return (
    <div className="ph">
      <style>{CSS}</style>

      <section className="ph-hero">
        <div className="ph-top">
          <span className="ph-live"><i /> AO VIVO · HOJE NO SD DIALER</span>
          <span className="ph-upd">atualizado {new Date(data.atualizado).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div className="ph-lbl">Vendas geradas hoje</div>
        <div className="ph-big">{eur(t.euros)}</div>
        <div className="ph-kpis">
          <span><Tv size={14} /> {t.tvs} TV</span>
          <span><Zap size={14} /> {t.energias} energia</span>
          <span><Phone size={14} /> {t.chamadas.toLocaleString('pt-PT')} chamadas</span>
          <span><Users size={14} /> {t.ativos} a trabalhar</span>
        </div>

        <div className="ph-goal">
          <div className="ph-goal-row">
            <span>Objetivo da equipa hoje</span>
            {editar ? (
              <span style={{ display: 'inline-flex', gap: 6 }}>
                <input inputMode="numeric" value={obj} onChange={(e) => setObj(e.target.value)} className="ph-in" placeholder="€" />
                <button onClick={guardarObjetivo} className="ph-ok" aria-label="Guardar"><Check size={14} /></button>
              </span>
            ) : (
              <b>{eur(t.euros)} / {eur(data.objetivo)} {data.podeEditar && <button onClick={() => { setObj(String(data.objetivo)); setEditar(true) }} className="ph-ed" aria-label="Mudar objetivo"><Pencil size={12} /></button>}</b>
            )}
          </div>
          <div className="ph-bar"><i style={{ width: `${pct}%` }} /></div>
          <div className="ph-goal-txt">{pct >= 100 ? '🎉 Objetivo batido! Bora fazer história hoje.' : `Faltam ${eur(Math.max(0, data.objetivo - t.euros))} para o objetivo. Cada TV conta!`}</div>
        </div>

        <div className="ph-feed">
          {data.feed.length === 0 && <div className="ph-empty">Ainda sem vendas hoje. Quem é o primeiro? 🚀</div>}
          {data.feed.slice(0, 6).map((f) => (
            <div key={f.id} className={'ph-fi' + (novos.has(f.id) ? ' new' : '')}>
              <span className="ph-fe">{f.tipo === 'energia' ? '⚡' : '🎉'}</span>
              <span className="ph-ft"><b>{f.vendedor.split(' ')[0]}</b> fechou {f.tipo === 'energia' ? 'uma energia' : 'uma TV'}{f.operador ? ` ${f.operador}` : ''}</span>
              <span className="ph-fv">+{eur(f.euros)}</span>
              <span className="ph-fw">{ha(f.quando)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="ph-card">
        <div className="ph-h"><Phone size={17} /> Ranking de chamadas de hoje</div>
        {rk.length === 0 && <div className="ph-muted">Ainda ninguém ligou hoje. A primeira chamada lidera! 📞</div>}
        {rk.length >= 3 && (
          <div className="ph-podio">
            {[1, 0, 2].map((pos) => {
              const p = rk[pos]
              return (
                <div key={pos} className={'ph-pd p' + pos}>
                  <div className="ph-av lg">{ini(p.nome)}</div>
                  <div className="ph-pn">{p.nome.split(' ')[0]}</div>
                  <div className="ph-pc">{p.chamadas} 📞</div>
                  <div className="ph-step">{pos + 1}</div>
                </div>
              )
            })}
          </div>
        )}
        {euPos > 0 && <div className="ph-me">Estás em <b>{euPos + 1}.º</b> com {rk[euPos].chamadas} chamadas · faltam <b>{rk[euPos - 1].chamadas - rk[euPos].chamadas + 1}</b> para passares {rk[euPos - 1].nome.split(' ')[0]}.</div>}
        {euPos === 0 && <div className="ph-me lead">👑 Estás a liderar as chamadas de hoje! Não pares.</div>}
        <div className="ph-list">
          {rk.slice(0, 15).map((p, i) => (
            <div key={p.id} className={'ph-row' + (p.id === data.eu ? ' eu' : '')}>
              <span className="ph-n">{i + 1}</span>
              <span className="ph-av">{ini(p.nome)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ph-nm">{p.nome}{p.id === data.eu ? ' (tu)' : ''}</div>
                <div className="ph-sub">{p.empresa ? `${p.empresa} · ` : ''}{p.conversas} conversas{p.vendas ? ` · ${p.vendas} vendas · ${eur(p.euros)}` : ''}</div>
              </div>
              <div className="ph-val">{p.chamadas}<small> chamadas</small></div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

const CSS = `
.ph-hero{position:relative;overflow:hidden;border-radius:26px;padding:20px clamp(16px,3vw,26px);color:#fff;margin-bottom:14px;
  background:radial-gradient(700px 320px at -10% -20%,rgba(99,102,241,.45),transparent 60%),radial-gradient(600px 340px at 110% 0%,rgba(16,185,129,.32),transparent 60%),radial-gradient(500px 300px at 50% 130%,rgba(236,72,153,.18),transparent 60%),#060914;
  box-shadow:0 30px 70px -30px rgba(15,23,42,.8)}
.ph-top{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}
.ph-live{display:inline-flex;align-items:center;gap:8px;font-size:11px;letter-spacing:.16em;font-weight:800;color:#FCA5A5}
.ph-live i{width:8px;height:8px;border-radius:99px;background:#EF4444;box-shadow:0 0 0 4px rgba(239,68,68,.2);animation:phP 1.3s ease-in-out infinite}
.ph-upd{font-size:11.5px;color:#94A3B8}
.ph-lbl{margin-top:14px;font-size:13px;font-weight:700;color:#A5B4FC}
.ph-big{font-size:clamp(42px,9vw,64px);font-weight:900;letter-spacing:-.035em;line-height:1.02;background:linear-gradient(90deg,#fff,#A7F3D0 60%,#FDE68A);-webkit-background-clip:text;background-clip:text;color:transparent}
.ph-kpis{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.ph-kpis span{display:inline-flex;gap:6px;align-items:center;font-size:12.5px;font-weight:700;padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);color:#E2E8F0}
.ph-goal{margin-top:16px;padding:12px;border-radius:16px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09)}
.ph-goal-row{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:13px;color:#CBD5E1}
.ph-goal-row b{color:#fff;display:inline-flex;gap:6px;align-items:center}
.ph-bar{height:12px;border-radius:99px;background:rgba(255,255,255,.1);overflow:hidden;margin-top:8px}
.ph-bar i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#6366F1,#10B981,#FBBF24);transition:width .8s cubic-bezier(.2,.7,.2,1)}
.ph-goal-txt{font-size:12.5px;color:#A7F3D0;margin-top:6px}
.ph-ed,.ph-ok{border:0;border-radius:8px;padding:4px 6px;background:rgba(255,255,255,.12);color:#fff;cursor:pointer;display:inline-grid;place-items:center}
.ph-in{width:90px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:rgba(2,6,23,.6);color:#fff;padding:4px 8px;font-size:13px}
.ph-feed{margin-top:14px;display:grid;gap:6px}
.ph-empty{font-size:13px;color:#94A3B8;padding:6px 2px}
.ph-fi{display:flex;align-items:center;gap:8px;min-width:0;overflow:hidden;padding:8px 10px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);font-size:13px;transition:background .4s}
.ph-fi.new{background:linear-gradient(90deg,rgba(16,185,129,.35),rgba(99,102,241,.2));border-color:rgba(110,231,183,.6);animation:phIn .6s ease both}
.ph-fe{font-size:16px}
.ph-ft{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#E2E8F0}
.ph-fv{font-weight:900;color:#6EE7B7}
.ph-fw{font-size:11px;color:#94A3B8;flex:none;text-align:right}
.ph-card{background:#fff;border:1px solid #E2E8F0;border-radius:22px;padding:16px;margin-bottom:14px;box-shadow:0 12px 30px -22px rgba(15,23,42,.35)}
.ph-h{display:flex;align-items:center;gap:8px;font-size:16px;font-weight:900;color:#0F172A;margin-bottom:12px}
.ph-muted{color:#64748B;font-size:14px}
.ph-podio{display:grid;grid-template-columns:1fr 1.15fr 1fr;gap:10px;align-items:end;margin:6px 0 12px}
.ph-pd{text-align:center;min-width:0}
.ph-pn{font-size:13px;font-weight:800;color:#0F172A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:4px}
.ph-pc{font-size:12.5px;font-weight:800;color:#4338CA}
.ph-step{margin-top:6px;border-radius:12px 12px 0 0;display:flex;justify-content:center;padding-top:6px;font-weight:900;font-size:18px;color:#1F2937}
.ph-pd.p0 .ph-step{height:84px;background:linear-gradient(180deg,#FDE68A,#D97706)}
.ph-pd.p1 .ph-step{height:62px;background:linear-gradient(180deg,#E2E8F0,#94A3B8)}
.ph-pd.p2 .ph-step{height:48px;background:linear-gradient(180deg,#FBCFA8,#B45309)}
.ph-av{flex:none;width:34px;height:34px;border-radius:11px;display:grid;place-items:center;font-weight:800;font-size:12.5px;color:#fff;background:linear-gradient(135deg,#6366F1,#8B5CF6 60%,#10B981)}
.ph-av.lg{width:46px;height:46px;border-radius:15px;margin:0 auto;font-size:15px}
.ph-me{font-size:13.5px;color:#1E3A8A;background:#EEF2FF;border:1px solid #C7D2FE;border-radius:12px;padding:9px 11px;margin-bottom:10px}
.ph-me.lead{color:#92400E;background:#FFFBEB;border-color:#FDE68A}
.ph-list{display:grid;gap:6px}
.ph-row{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:14px;background:#F8FAFC;border:1px solid #EEF2F7}
.ph-row.eu{border-color:#818CF8;background:#EEF2FF}
.ph-n{width:22px;text-align:center;font-weight:900;color:#64748B}
.ph-nm{font-weight:800;color:#0F172A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ph-sub{font-size:12px;color:#64748B}
.ph-val{font-size:18px;font-weight:900;color:#0F172A;text-align:right}
.ph-val small{font-size:11px;color:#94A3B8;font-weight:700}
@keyframes phP{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes phIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
`
