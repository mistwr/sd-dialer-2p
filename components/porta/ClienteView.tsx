'use client'

import { ArrowRight, Minus, Plus } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import type { Fase, FunilState } from '@/lib/porta-funil'

// Vista para MOSTRAR AO CLIENTE na porta: passos grandes e simples que o cliente toca, enquanto o vendedor conversa.
// Usa o mesmo estado do questionário; não pede dados pessoais antes de "fechar".

export const FASES_CLIENTE: Fase[] = ['abordar', 'escutar', 'descobrir', 'comparar', 'resolver', 'fechar']

const OPERADORAS = ['MEO', 'NOS', 'Vodafone', 'DIGI', 'Outra', 'Nenhuma']
const VALORIZA = ['Internet', 'Cobertura', 'Televisão', 'Sport TV', 'Preço', 'Telemóveis', 'Atendimento', 'Estabilidade']
const DORES = ['Preço', 'Wi-Fi / cobertura em casa', 'Televisão', 'Atendimento', 'Fidelização', 'Outra', 'Nenhuma']
const CARAS = ['😠', '🙁', '😐', '🙂', '😀']

const titulo: CSSProperties = { fontSize: 28, fontWeight: 800, lineHeight: 1.2, margin: '4px 0 8px', color: '#0F172A' }
const sub: CSSProperties = { fontSize: 17, color: '#475569', margin: '0 0 18px', lineHeight: 1.5 }
const rot: CSSProperties = { fontSize: 16, fontWeight: 800, color: '#334155', margin: '22px 0 10px' }
const inp: CSSProperties = { width: '100%', padding: '16px 16px', borderRadius: 14, border: '2px solid #E2E8F0', fontSize: 20, boxSizing: 'border-box', background: '#fff' }

function Grande({ on, children, onClick, cor = '#2563EB' }: { on: boolean; children: ReactNode; onClick: () => void; cor?: string }) {
  return (
    <button type="button" onClick={onClick}
      style={{ padding: '18px 16px', borderRadius: 16, fontSize: 19, fontWeight: 700, cursor: 'pointer', textAlign: 'center',
        border: `2.5px solid ${on ? cor : '#E2E8F0'}`, background: on ? cor : '#fff', color: on ? '#fff' : '#0F172A', transition: 'all .15s', transform: on ? 'scale(1.02)' : 'none' }}>
      {children}
    </button>
  )
}

const grelha = (cols: number): CSSProperties => ({ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 10 })
const eur = (n: number) => new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 }).format(n)
const parse = (v: string) => { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : 0 }

export default function ClienteView({
  s, set, fase, vendedor, podeAvancar, onNext, onBack, onSair,
}: {
  s: FunilState
  set: <K extends keyof FunilState>(k: K, v: FunilState[K]) => void
  fase: Fase
  vendedor: string
  podeAvancar: boolean
  onNext: () => void
  onBack?: () => void
  onSair: () => void
}) {
  const passo = FASES_CLIENTE.indexOf(fase) + 1
  const mensal = parse(s.mensalidade)
  const poup = parse(s.diferenca)
  const moveis = Math.max(0, Math.floor(parse(s.moveis)))

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '8px 4px 110px', fontFamily: 'inherit' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 5, flex: 1 }}>
          {FASES_CLIENTE.map((f, i) => <div key={f} style={{ flex: 1, height: 6, borderRadius: 4, background: i < passo ? '#2563EB' : '#E2E8F0', transition: 'background .3s' }} />)}
        </div>
        <button onClick={onSair} style={{ background: 'none', border: 0, color: '#94A3B8', fontSize: 12, cursor: 'pointer' }}>Vista do vendedor</button>
      </div>

      {fase === 'abordar' && (<>
        <div style={{ fontSize: 44 }}>👋</div>
        <h1 style={titulo}>Olá! Sou {vendedor || 'da equipa MyPoupar+'}.</h1>
        <p style={sub}>Em poucos minutos vemos consigo se está a pagar mais do que devia pelos serviços de casa. Sem compromisso e sem pedir dados agora.</p>
        <div style={rot}>Posso ajudá-lo?</div>
        <div style={{ display: 'grid', gap: 10 }}>
          <Grande on={s.reacao === 'Aceitou conversar'} onClick={() => set('reacao', 'Aceitou conversar')}>Sim, pode ser</Grande>
          <Grande on={s.reacao === 'Apressado'} onClick={() => set('reacao', 'Apressado')}>Tenho pouco tempo</Grande>
          <Grande on={s.reacao === 'Recusou'} cor="#64748B" onClick={() => set('reacao', 'Recusou')}>Agora não, obrigado</Grande>
        </div>
      </>)}

      {fase === 'escutar' && (<>
        <h1 style={titulo}>Conte-nos como é hoje</h1>
        <p style={sub}>Toque nas opções, é rápido.</p>
        <div style={rot}>Que operadora tem?</div>
        <div style={grelha(2)}>{OPERADORAS.map(o => <Grande key={o} on={s.operadora === o} onClick={() => set('operadora', o)}>{o}</Grande>)}</div>
        <div style={rot}>O que mais valoriza? (pode escolher várias)</div>
        <div style={grelha(2)}>
          {VALORIZA.map(o => {
            const on = s.valoriza.includes(o)
            return <Grande key={o} on={on} onClick={() => set('valoriza', on ? s.valoriza.filter(x => x !== o) : [...s.valoriza, o])}>{o}</Grande>
          })}
        </div>
        <div style={rot}>Está satisfeito com o serviço atual?</div>
        <div style={grelha(5)}>
          {CARAS.map((c, i) => (
            <button key={c} type="button" onClick={() => set('satisfacao', i + 1)}
              style={{ fontSize: 34, padding: '10px 0', borderRadius: 14, cursor: 'pointer', border: `2.5px solid ${s.satisfacao === i + 1 ? '#2563EB' : '#E2E8F0'}`, background: s.satisfacao === i + 1 ? '#EFF6FF' : '#fff', transform: s.satisfacao === i + 1 ? 'scale(1.08)' : 'none', transition: 'all .15s' }}>{c}</button>
          ))}
        </div>
      </>)}

      {fase === 'descobrir' && (<>
        <h1 style={titulo}>O que paga hoje?</h1>
        <p style={sub}>Assim conseguimos comparar com valores reais.</p>
        <div style={rot}>Quanto paga por mês (€)?</div>
        <input style={{ ...inp, fontSize: 28, fontWeight: 800, textAlign: 'center' }} inputMode="decimal" value={s.mensalidade} onChange={e => set('mensalidade', e.target.value)} placeholder="Ex.: 75" />
        <div style={{ ...grelha(4), marginTop: 10 }}>
          {[-5, -1, 1, 5].map(d => (
            <button key={d} type="button" onClick={() => set('mensalidade', String(Math.max(0, mensal + d)))} style={{ padding: '12px 0', borderRadius: 12, border: '2px solid #E2E8F0', background: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>{d > 0 ? `+${d}` : d} €</button>
          ))}
        </div>
        <div style={rot}>Que serviços tem?</div>
        <div style={grelha(3)}>
          <Grande on={s.tem_internet} onClick={() => set('tem_internet', !s.tem_internet)}>Internet</Grande>
          <Grande on={s.tem_tv} onClick={() => set('tem_tv', !s.tem_tv)}>TV</Grande>
          <Grande on={s.tem_fixo} onClick={() => set('tem_fixo', !s.tem_fixo)}>Fixo</Grande>
        </div>
        <div style={rot}>Quantos telemóveis na família?</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22 }}>
          <button type="button" aria-label="Menos" onClick={() => set('moveis', String(Math.max(0, moveis - 1)))} style={{ width: 60, height: 60, borderRadius: 30, border: '2px solid #E2E8F0', background: '#fff', cursor: 'pointer' }}><Minus /></button>
          <div style={{ fontSize: 44, fontWeight: 800, minWidth: 60, textAlign: 'center' }}>{moveis}</div>
          <button type="button" aria-label="Mais" onClick={() => set('moveis', String(moveis + 1))} style={{ width: 60, height: 60, borderRadius: 30, border: '2px solid #E2E8F0', background: '#fff', cursor: 'pointer' }}><Plus /></button>
        </div>
        <div style={rot}>Há alguma coisa que o incomode?</div>
        <div style={grelha(2)}>{DORES.map(o => <Grande key={o} on={s.dor === o} onClick={() => set('dor', o)}>{o}</Grande>)}</div>
        <div style={{ marginTop: 16 }}>
          <Grande on={s.tem_fatura} onClick={() => set('tem_fatura', !s.tem_fatura)}>Tenho a fatura aqui comigo</Grande>
        </div>
      </>)}

      {fase === 'comparar' && (<>
        <h1 style={titulo}>Vamos comparar</h1>
        {poup > 0 && mensal > 0 ? (<>
          <p style={sub}>Com os seus dados, esta é a diferença estimada:</p>
          <div style={{ background: '#F8FAFC', borderRadius: 20, padding: 20, border: '2px solid #E2E8F0' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#64748B' }}>Hoje paga</div>
            <div style={{ height: 22, borderRadius: 11, background: '#FCA5A5', width: '100%', margin: '6px 0 4px' }} />
            <div style={{ fontSize: 24, fontWeight: 800 }}>{eur(mensal)} €/mês</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#64748B', marginTop: 16 }}>Pode passar a pagar cerca de</div>
            <div style={{ height: 22, borderRadius: 11, background: '#86EFAC', width: `${Math.max(8, Math.min(100, ((mensal - poup) / mensal) * 100))}%`, margin: '6px 0 4px', transition: 'width 1s ease' }} />
            <div style={{ fontSize: 24, fontWeight: 800, color: '#15803D' }}>{eur(Math.max(0, mensal - poup))} €/mês</div>
          </div>
          <div style={{ textAlign: 'center', margin: '22px 0 6px', fontSize: 16, color: '#475569' }}>Poupança estimada</div>
          <div style={{ textAlign: 'center', fontSize: 46, fontWeight: 900, color: '#15803D' }}>{eur(poup * 12)} € por ano</div>
          <p style={{ textAlign: 'center', fontSize: 13, color: '#94A3B8' }}>Valor estimado, a confirmar com a sua fatura e as condições da campanha.</p>
        </>) : (
          <p style={sub}>O vendedor está a fazer a comparação com a sua fatura. Um momento…<br /><span style={{ fontSize: 14, color: '#94A3B8' }}>(Vendedor: introduz a diferença na vista do vendedor.)</span></p>
        )}
      </>)}

      {fase === 'resolver' && (<>
        <h1 style={titulo}>Faz sentido para si?</h1>
        <p style={sub}>Só avançamos se quiser. Nada é decidido sem o seu OK.</p>
        <div style={{ display: 'grid', gap: 10 }}>
          <Grande on={s.interesse === 'quer'} cor="#15803D" onClick={() => { set('interesse', 'quer'); set('proposta_apresentada', true) }}>Sim, quero avançar</Grande>
          <Grande on={s.interesse === 'vai_pensar'} onClick={() => { set('interesse', 'vai_pensar'); set('proposta_apresentada', true) }}>Vou pensar</Grande>
          <Grande on={s.interesse === 'nao'} cor="#64748B" onClick={() => { set('interesse', 'nao'); set('proposta_apresentada', true) }}>Não, obrigado</Grande>
        </div>
      </>)}

      {fase === 'fechar' && (<>
        <h1 style={titulo}>Os seus dados</h1>
        <p style={sub}>Só usamos para tratar desta proposta. Pode preencher sozinho.</p>
        <div style={rot}>Nome *</div>
        <input style={inp} value={s.nome} onChange={e => set('nome', e.target.value)} autoComplete="off" />
        <div style={rot}>Telemóvel *</div>
        <input style={inp} inputMode="tel" value={s.telefone} onChange={e => set('telefone', e.target.value)} />
        <div style={rot}>Email (opcional)</div>
        <input style={inp} inputMode="email" value={s.email} onChange={e => set('email', e.target.value)} />
        <div style={rot}>Morada (opcional)</div>
        <input style={inp} value={s.morada} onChange={e => set('morada', e.target.value)} />
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <input style={inp} placeholder="Código postal" value={s.codigo_postal} onChange={e => set('codigo_postal', e.target.value)} />
          <input style={inp} placeholder="Localidade" value={s.localidade} onChange={e => set('localidade', e.target.value)} />
        </div>
        <div style={{ marginTop: 18 }}>
          <Grande on={s.rgpd} cor="#15803D" onClick={() => set('rgpd', !s.rgpd)}>{s.rgpd ? '✓ ' : ''}Autorizo o tratamento dos meus dados pessoais (RGPD) para tratarem desta proposta *</Grande>
        </div>
      </>)}

      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#fff', borderTop: '1px solid #E2E8F0', padding: 12, display: 'flex', justifyContent: 'center' }}>
        <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 560 }}>
          {onBack && <button onClick={onBack} style={{ padding: 16, borderRadius: 14, border: '1px solid #CBD5E1', background: '#fff', fontWeight: 700 }}>Voltar</button>}
          <button onClick={onNext} disabled={!podeAvancar}
            style={{ flex: 1, padding: 18, borderRadius: 14, border: 0, background: podeAvancar ? '#2563EB' : '#CBD5E1', color: '#fff', fontSize: 19, fontWeight: 800, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', cursor: podeAvancar ? 'pointer' : 'default' }}>
            Continuar <ArrowRight size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}
