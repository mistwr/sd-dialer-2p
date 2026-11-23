'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Gift, Phone, MessageCircle, ShoppingBag, GraduationCap, Trophy, Pencil } from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import { authFetch, authFetcher as fetcher } from '@/lib/client/authFetch'

type Linha = { id: string; nome: string; avatar: string | null; role: string; chamadas: number; conversas: number; vendas: number; modulos: number; pontos: number }
type Resp = { ranking: Linha[]; natal: { inicio: string; fim: string; premios: string[] }; pontos: { chamada: number; conversa: number; venda: number; modulo: number }; eu: string; de: string; ate: string | null }

const card: React.CSSProperties = { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 16, marginBottom: 14 }

function medalhas(l: Linha) {
  const m: string[] = []
  if (l.vendas >= 1) m.push('🏆 Primeira venda')
  if (l.vendas >= 5) m.push('💎 5 vendas')
  if (l.chamadas >= 100) m.push('📞 100 chamadas')
  if (l.conversas >= 25) m.push('🗣️ 25 conversas')
  if (l.modulos >= 3) m.push('🎓 Estudioso')
  return m
}

function Avatar({ l, size = 36 }: { l: Linha; size?: number }) {
  const [falhou, setFalhou] = useState(false)
  const ini = l.nome.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
  return l.avatar && !falhou
    ? <img src={l.avatar} alt="" onError={() => setFalhou(true)} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.7)' }} />
    : <div style={{ width: size, height: size, borderRadius: '50%', background: '#E0E7FF', color: '#3730A3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: size / 2.8, border: '2px solid rgba(255,255,255,0.7)' }}>{ini}</div>
}

function EditarPremios({ natal, onDone }: { natal: Resp['natal']; onDone: () => void }) {
  const [premios, setPremios] = useState(natal.premios.join('\n'))
  const [inicio, setInicio] = useState(natal.inicio)
  const [fim, setFim] = useState(natal.fim)
  const [busy, setBusy] = useState(false)
  async function guardar() {
    setBusy(true)
    await authFetch('/api/gamificacao', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inicio, fim, premios: premios.split('\n').map(p => p.trim()).filter(Boolean) }) })
    setBusy(false); onDone()
  }
  const inp: React.CSSProperties = { padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 14 }
  return (
    <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 13 }}>
        <label>Início <input type="date" value={inicio} onChange={e => setInicio(e.target.value)} style={inp} /></label>
        <label>Fim <input type="date" value={fim} onChange={e => setFim(e.target.value)} style={inp} /></label>
      </div>
      <textarea value={premios} onChange={e => setPremios(e.target.value)} rows={3} style={{ ...inp, fontFamily: 'inherit' }} placeholder="Um prémio por linha (1.º, 2.º, 3.º…)" />
      <button disabled={busy} onClick={guardar} style={{ justifySelf: 'start', padding: '8px 14px', borderRadius: 8, border: 0, background: '#B91C1C', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>{busy ? 'A guardar…' : 'Guardar prémios'}</button>
    </div>
  )
}

export default function GamificacaoPage() {
  const { profile } = useAuth()
  const [periodo, setPeriodo] = useState<'semana' | 'mes' | 'natal'>('natal')
  const [editar, setEditar] = useState(false)
  const { data, mutate, isLoading } = useSWR<Resp>(`/api/gamificacao?periodo=${periodo}`, fetcher, { refreshInterval: 60_000 })
  const ranking = Array.isArray(data?.ranking) ? data!.ranking : []
  const eu = ranking.findIndex(l => l.id === data?.eu)
  const gestor = profile?.role === 'admin' || profile?.role === 'supervisor' || profile?.is_super_admin

  return (
    <div className="mx-auto min-w-0 max-w-4xl px-3 py-4 sm:px-4 sm:py-6">
      <div style={{ borderRadius: 20, padding: '22px 22px 18px', marginBottom: 16, color: '#fff', background: 'radial-gradient(120% 140% at 0% 0%, #1F4D36 0%, #0C2B1E 45%, #2A0A0A 100%)', border: '1px solid rgba(212,175,55,0.35)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#E8C766', fontWeight: 800 }}>Juntos Somos +</div>
        <h1 style={{ margin: '6px 0 4px', fontSize: 26, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 10 }}><Trophy size={24} color="#E8C766" /> Ranking da equipa</h1>
        <p style={{ margin: 0, fontSize: 13.5, color: 'rgba(255,255,255,0.8)', maxWidth: 560 }}>Os teus resultados e os dos colegas da tua empresa. Chamada {data?.pontos?.chamada ?? 1} pt · conversa real +{data?.pontos?.conversa ?? 3} · venda {data?.pontos?.venda ?? 50} · módulo de formação {data?.pontos?.modulo ?? 10}.</p>
        {ranking.length >= 3 && ranking[2].pontos > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr 1fr', gap: 10, alignItems: 'end', marginTop: 18 }}>
            {[1, 0, 2].map(pos => {
              const l = ranking[pos]
              const alturas = [92, 70, 56]
              return (
                <div key={pos} style={{ textAlign: 'center', minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}><Avatar l={l} size={pos === 0 ? 48 : 40} /></div>
                  <div style={{ fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.nome.split(' ')[0]}</div>
                  <div style={{ fontSize: 12, color: '#E8C766', fontWeight: 800 }}>{l.pontos} pts</div>
                  <div style={{ height: alturas[pos], marginTop: 6, borderRadius: '10px 10px 0 0', background: pos === 0 ? 'linear-gradient(180deg,#E8C766,#A8862B)' : pos === 1 ? 'linear-gradient(180deg,#E2E8F0,#94A3B8)' : 'linear-gradient(180deg,#D6A27A,#8A5A36)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 6, color: '#1F2937', fontWeight: 900, fontSize: 18 }}>{pos + 1}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {([['natal', '🎄 Desafio de Natal'], ['semana', 'Esta semana'], ['mes', 'Este mês']] as const).map(([v, l]) => (
          <button key={v} onClick={() => setPeriodo(v)} style={{ padding: '8px 14px', borderRadius: 999, fontSize: 13, fontWeight: 800, cursor: 'pointer', border: `1.5px solid ${periodo === v ? (v === 'natal' ? '#0C2B1E' : '#0F172A') : '#E2E8F0'}`, background: periodo === v ? (v === 'natal' ? '#0C2B1E' : '#0F172A') : '#fff', color: periodo === v ? '#fff' : '#334155' }}>{l}</button>
        ))}
      </div>

      {periodo === 'natal' && data?.natal && (
        <div style={{ ...card, background: '#fff', color: '#0F172A', borderColor: 'rgba(212,175,55,0.6)', boxShadow: '0 1px 0 rgba(212,175,55,0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ fontSize: 17, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8, color: '#7F1D1D' }}><Gift size={19} /> Desafio de Natal</div>
            {gestor && <button onClick={() => setEditar(!editar)} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#334155', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 12.5, display: 'inline-flex', gap: 5, alignItems: 'center' }}><Pencil size={13} /> Prémios</button>}
          </div>
          <div style={{ fontSize: 13, color: '#64748B', margin: '4px 0 8px' }}>
            De {new Date(data.natal.inicio).toLocaleDateString('pt-PT')} a {new Date(data.natal.fim).toLocaleDateString('pt-PT')} · quem tiver mais pontos ganha.
          </div>
          <div style={{ display: 'grid', gap: 6 }}>{data.natal.premios.map((p, i) => <div key={i} style={{ fontSize: 14, fontWeight: 700, padding: '8px 10px', borderRadius: 10, background: i === 0 ? '#FEF9E7' : '#F8FAFC', border: '1px solid ' + (i === 0 ? '#F1D98A' : '#E2E8F0') }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🎁'} {p}</div>)}</div>
          {editar && gestor && <div style={{ background: '#F8FAFC', color: '#0F172A', borderRadius: 12, padding: 12, marginTop: 10, border: '1px solid #E2E8F0' }}><EditarPremios natal={data.natal} onDone={() => { setEditar(false); mutate() }} /></div>}
        </div>
      )}

      {eu >= 0 && (
        <div style={{ ...card, borderColor: '#BFDBFE', background: '#EFF6FF' }}>
          <div style={{ fontSize: 13, color: '#1E40AF', fontWeight: 700 }}>A tua posição</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#0F172A' }}>{eu + 1}.º lugar · {ranking[eu].pontos} pontos</div>
          {eu > 0 && <div style={{ fontSize: 13, color: '#334155', marginTop: 2 }}>Faltam {ranking[eu - 1].pontos - ranking[eu].pontos + 1} pontos para passares {ranking[eu - 1].nome.split(' ')[0]}.</div>}
        </div>
      )}

      {isLoading && <div style={{ color: '#64748B' }}>A carregar…</div>}
      {!isLoading && ranking.length === 0 && <div style={card}>Ainda não há comerciais ativos nesta empresa.</div>}

      <div style={{ display: 'grid', gap: 8 }}>
        {ranking.map((l, i) => (
          <div key={l.id} style={{ ...card, marginBottom: 0, padding: 12, display: 'flex', alignItems: 'center', gap: 12, borderColor: l.id === data?.eu ? '#2563EB' : '#E2E8F0', borderWidth: l.id === data?.eu ? 2 : 1 }}>
            <div style={{ width: 30, textAlign: 'center', fontSize: i < 3 ? 22 : 15, fontWeight: 900, color: '#64748B' }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</div>
            <Avatar l={l} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.nome}{l.id === data?.eu ? ' (tu)' : ''}</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 12.5, color: '#64748B', marginTop: 2 }}>
                <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}><Phone size={12} /> {l.chamadas}</span>
                <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}><MessageCircle size={12} /> {l.conversas}</span>
                <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}><ShoppingBag size={12} /> {l.vendas}</span>
                <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}><GraduationCap size={12} /> {l.modulos}</span>
              </div>
              {medalhas(l).length > 0 && <div style={{ fontSize: 11.5, color: '#92400E', marginTop: 3 }}>{medalhas(l).join(' · ')}</div>}
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#0F172A' }}>{l.pontos}<span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700 }}> pts</span></div>
          </div>
        ))}
      </div>
    </div>
  )
}
