'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, CheckCircle2, CloudOff, Loader2, Lightbulb, XCircle } from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import { FASES, type Fase, type FunilState, guardarCaptura, guardarRascunho, lerFila, lerRascunho, limparRascunho, novoFunil, sincronizarFila } from '@/lib/porta-funil'

const OPERADORAS = ['MEO', 'NOS', 'Vodafone', 'DIGI', 'Outra', 'Nenhuma']
const VALORIZA = ['Internet', 'Cobertura', 'Televisão', 'Sport TV', 'Preço', 'Telemóveis', 'Atendimento', 'Estabilidade']
const DORES = ['Preço', 'Wi-Fi / cobertura em casa', 'Televisão', 'Atendimento', 'Fidelização', 'Outra', 'Nenhuma']
const MOTIVOS = ['Satisfeito com o que tem', 'Preço já é bom', 'Fidelizado', 'Não decide sozinho', 'Sem tempo agora', 'Desconfiança', 'Outro']

// Pergunta-chave e dica por fase (manual MyPoupar+: perguntas certas, não frases decoradas).
const GUIA: Record<Fase, { objetivo: string; pergunta: string; dica: string }> = {
  abordar: { objetivo: 'Conseguir autorização para continuar a conversa.', pergunta: '“Boa tarde. Já atualizou os seus serviços de internet e TV? Aqui na zona houve atualizações e talvez o possa ajudar.”', dica: 'Fala normalmente, sem parecer desesperado por vender. Observa a reação e adapta.' },
  escutar: { objetivo: 'Ouvir. O cliente já te dá informação na primeira resposta.', pergunta: '“Ainda bem. O que mais gosta na sua operadora?”', dica: 'Não interrompas para apresentar produto. O que ele valoriza é o que não podes destruir na proposta.' },
  descobrir: { objetivo: 'Encontrar a dor e perceber o que tem.', pergunta: '“Quanto paga por mês? Que serviços tem? Quantos telemóveis? Está fidelizado? Tem a fatura consigo?”', dica: 'Se o problema é preço, trabalha preço. Se é Wi-Fi, trabalha Wi-Fi. Não fales do que não interessa ao cliente.' },
  comparar: { objetivo: 'Comparar com dados reais, de preferência com o cliente a participar.', pergunta: '“Pegue no telemóvel, abra aqui. Quantos móveis tem? Quanto está a pagar?”', dica: 'Não digas “eu consigo mais barato”. Usa a fatura e as condições reais. Quando o cliente constrói a comparação contigo, confia mais.' },
  resolver: { objetivo: 'Apresentar só a solução do diagnóstico.', pergunta: '“Pelas suas faturas e pelas condições que comparámos, a diferença estimada é X €/mês.”', dica: 'Preserva o que o cliente valoriza. Não tires algo importante só para mostrar um preço mais baixo. Nunca inventes poupanças.' },
  fechar: { objetivo: 'Só agora pedes os dados, de forma natural e com consentimento claro.', pergunta: '“Muito bem. Tem aí os seus dados? Eu ajudo, é só preenchermos isto.”', dica: 'O cliente tem de conhecer preço, serviços, fidelização e condições. Sem consentimento claro, não há venda.' },
  acompanhar: { objetivo: 'A venda não acaba na submissão.', pergunta: 'Combina o próximo passo: instalação, portabilidade, dúvidas, documentos.', dica: 'O objetivo é cliente instalado e satisfeito.' },
  multiplicar: { objetivo: 'Depois de ajudar, pedir uma apresentação, com consentimento.', pergunta: '“Na sua família tem mais alguém que gostasse de perceber se também consegue poupar?”', dica: 'Sem listas de números. Sugere que o cliente lhes mande uma mensagem a dizer que estiveste a comparar os serviços.' },
}

const card: React.CSSProperties = { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 16, marginBottom: 14 }
const input: React.CSSProperties = { width: '100%', padding: '13px 14px', borderRadius: 12, border: '1.5px solid #E2E8F0', fontSize: 16, boxSizing: 'border-box', background: '#fff' }
const lab: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 700, color: '#374151', margin: '14px 0 6px' }

function Chips({ options, value, onChange, multi }: { options: string[]; value: string | string[]; onChange: (v: any) => void; multi?: boolean }) {
  const on = (o: string) => (multi ? (value as string[]).includes(o) : value === o)
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map(o => (
        <button key={o} type="button" onClick={() => onChange(multi ? (on(o) ? (value as string[]).filter(x => x !== o) : [...(value as string[]), o]) : o)}
          style={{ padding: '12px 15px', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${on(o) ? '#2563EB' : '#E2E8F0'}`, background: on(o) ? '#EFF6FF' : '#fff', color: on(o) ? '#1D4ED8' : '#0F172A' }}>{o}</button>
      ))}
    </div>
  )
}
const Toggle = ({ v, set, children }: { v: boolean; set: (b: boolean) => void; children: React.ReactNode }) => (
  <button type="button" onClick={() => set(!v)} style={{ display: 'flex', gap: 10, alignItems: 'center', width: '100%', textAlign: 'left', padding: '12px 14px', borderRadius: 12, marginBottom: 8, border: `1.5px solid ${v ? '#2563EB' : '#E2E8F0'}`, background: v ? '#EFF6FF' : '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
    <CheckCircle2 size={20} color={v ? '#2563EB' : '#CBD5E1'} /> {children}
  </button>
)

export default function FunilPortaPage() {
  const router = useRouter()
  const { user, profile } = useAuth()
  const [s, setS] = useState<FunilState | null>(null)
  const [fase, setFase] = useState<Fase>('abordar')
  const [saving, setSaving] = useState(false)
  const [terminar, setTerminar] = useState(false)
  const [msg, setMsg] = useState('')
  const [pendentes, setPendentes] = useState(0)
  const [online, setOnline] = useState(true)
  const [offlineOk, setOfflineOk] = useState(false)
  const [ident, setIdent] = useState<{ userId: string; companyId: string } | null>(null)
  const iniciado = useRef(false)

  const set = useCallback(<K extends keyof FunilState>(k: K, v: FunilState[K]) => setS(p => (p ? { ...p, [k]: v } : p)), [])

  useEffect(() => {
    if (iniciado.current) return
    iniciado.current = true
    const r = lerRascunho()
    const inicial = r && confirm('Tens uma conversa por terminar. Continuar nela?') ? r : (limparRascunho(), novoFunil())
    setS(inicial); setFase(inicial.fase_final)
    setPendentes(lerFila().length); setOnline(navigator.onLine)
    if (!inicial.latitude && navigator.geolocation) navigator.geolocation.getCurrentPosition(p => setS(x => (x ? { ...x, latitude: p.coords.latitude, longitude: p.coords.longitude } : x)), () => undefined, { timeout: 8000 })
    void sincronizarFila().then(x => setPendentes(x.restantes))
    const on = () => { setOnline(true); void sincronizarFila().then(x => setPendentes(x.restantes)) }
    const off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  useEffect(() => {
    // Guarda quem és neste telemóvel para poderes guardar capturas sem rede.
    if (user?.id && profile?.company_id) {
      const i = { userId: user.id, companyId: profile.company_id }
      setIdent(i)
      try { localStorage.setItem('porta-funil-ident', JSON.stringify(i)) } catch { /* ignora */ }
    } else {
      try { const r = localStorage.getItem('porta-funil-ident'); if (r) setIdent(JSON.parse(r)) } catch { /* ignora */ }
    }
  }, [user?.id, profile?.company_id])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.ready.then(() => setOfflineOk(!!navigator.serviceWorker.controller)).catch(() => undefined)
  }, [])

  useEffect(() => { if (s) { const t = setTimeout(() => guardarRascunho({ ...s, fase_final: fase }), 300); return () => clearTimeout(t) } }, [s, fase])

  if (!s) return <div style={{ padding: 24 }}><Loader2 className="animate-spin" /></div>

  const idx = FASES.findIndex(f => f.id === fase)
  const g = GUIA[fase]
  const podeFechar = s.nome.trim() && s.telefone.trim() && s.rgpd
  const podeAvancar =
    fase === 'abordar' ? !!s.reacao : fase === 'escutar' ? !!s.operadora : fase === 'resolver' ? !!s.interesse : fase === 'fechar' ? !!podeFechar : true

  async function concluir(resultado: 'fechado' | 'vai_pensar' | 'sem_interesse', fechou: boolean) {
    if (!ident || !s) { setMsg('Abre o funil uma vez com rede para te identificar neste telemóvel.'); return }
    setSaving(true); setMsg('')
    const r = await guardarCaptura({ state: { ...s, fase_final: fase }, companyId: ident.companyId, comercialId: ident.userId, resultado, fechou })
    setSaving(false)
    setPendentes(lerFila().length)
    alert(r === 'enviada' ? 'Guardado.' : 'Guardado no telemóvel. Envia sozinho quando tiveres rede.')
    router.push('/parceiro/porta')
  }

  function seguinte() {
    if (fase === 'resolver' && s!.interesse !== 'quer') { setTerminar(true); return }
    if (fase === 'multiplicar') { void concluir('fechado', true); return }
    setFase(FASES[idx + 1].id)
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', paddingBottom: 90 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button onClick={() => router.push('/parceiro/porta')} style={{ background: 'none', border: 0, display: 'flex', gap: 6, alignItems: 'center', fontWeight: 700 }}><ArrowLeft size={18} /> Porta</button>
        <span style={{ fontSize: 12, color: online ? '#047857' : '#B45309', display: 'flex', gap: 5, alignItems: 'center' }}>
          {!online && <CloudOff size={14} />} {online ? 'Com rede' : 'Sem rede, guarda no telemóvel'}{offlineOk ? ' · disponível offline' : ''}{pendentes > 0 ? ` · ${pendentes} por enviar` : ''}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
        {FASES.map((f, i) => (
          <div key={f.id} title={f.nome} style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 800, padding: '6px 0', borderRadius: 8, background: i === idx ? '#2563EB' : i < idx ? '#BFDBFE' : '#F1F5F9', color: i === idx ? '#fff' : '#334155' }}>{f.letra}</div>
        ))}
      </div>

      <div style={card}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#2563EB', letterSpacing: '.05em' }}>{FASES[idx].letra} — {FASES[idx].nome.toUpperCase()}</div>
        <div style={{ fontSize: 17, fontWeight: 800, margin: '4px 0 8px' }}>{g.objetivo}</div>
        <div style={{ fontSize: 14, color: '#0F172A', background: '#F8FAFC', borderRadius: 12, padding: '10px 12px' }}>{g.pergunta}</div>
        <div style={{ display: 'flex', gap: 8, fontSize: 13, color: '#92400E', background: '#FFFBEB', borderRadius: 12, padding: '10px 12px', marginTop: 8 }}><Lightbulb size={16} style={{ flexShrink: 0, marginTop: 2 }} /> {g.dica}</div>
      </div>

      <div style={card}>
        {fase === 'abordar' && (<>
          <label style={lab}>Como reagiu?</label>
          <Chips options={['Aceitou conversar', 'Apressado', 'Desconfiado', 'Recusou']} value={s.reacao} onChange={v => set('reacao', v)} />
          <p style={{ fontSize: 12, color: '#64748B' }}>Nesta fase não se pede nenhum dado pessoal.</p>
        </>)}

        {fase === 'escutar' && (<>
          <label style={lab}>Que operadora tem?</label>
          <Chips options={OPERADORAS} value={s.operadora} onChange={v => set('operadora', v)} />
          <label style={lab}>O que mais valoriza?</label>
          <Chips multi options={VALORIZA} value={s.valoriza} onChange={v => set('valoriza', v)} />
          <label style={lab}>Satisfação com o serviço atual</label>
          <Chips options={['1', '2', '3', '4', '5']} value={String(s.satisfacao || '')} onChange={v => set('satisfacao', Number(v))} />
        </>)}

        {fase === 'descobrir' && (<>
          <label style={lab}>Qual é a dor principal?</label>
          <Chips options={DORES} value={s.dor} onChange={v => set('dor', v)} />
          <label style={lab}>Quanto paga por mês (€)</label>
          <input style={input} inputMode="decimal" value={s.mensalidade} onChange={e => set('mensalidade', e.target.value)} placeholder="Ex.: 75" />
          <label style={lab}>Que serviços tem?</label>
          <Toggle v={s.tem_internet} set={b => set('tem_internet', b)}>Internet</Toggle>
          <Toggle v={s.tem_tv} set={b => set('tem_tv', b)}>Televisão</Toggle>
          <Toggle v={s.tem_fixo} set={b => set('tem_fixo', b)}>Telefone fixo</Toggle>
          <label style={lab}>Quantos telemóveis</label>
          <input style={input} inputMode="numeric" value={s.moveis} onChange={e => set('moveis', e.target.value)} />
          <label style={lab}>Velocidade da internet (opcional)</label>
          <input style={input} value={s.velocidade} onChange={e => set('velocidade', e.target.value)} placeholder="Ex.: 500 Mbps" />
          <label style={lab}>Fim da fidelização (opcional)</label>
          <input style={input} type="date" value={s.fim_fidelizacao} onChange={e => set('fim_fidelizacao', e.target.value)} />
          <div style={{ marginTop: 10 }}><Toggle v={s.tem_fatura} set={b => set('tem_fatura', b)}>Tem a fatura consigo</Toggle></div>
        </>)}

        {fase === 'comparar' && (<>
          <Toggle v={s.comparacao_feita} set={b => set('comparacao_feita', b)}>Fiz a comparação com os dados reais</Toggle>
          <label style={lab}>Diferença estimada (€/mês)</label>
          <input style={input} inputMode="decimal" value={s.diferenca} onChange={e => set('diferenca', e.target.value)} placeholder="Ex.: 18" />
        </>)}

        {fase === 'resolver' && (<>
          <Toggle v={s.proposta_apresentada} set={b => set('proposta_apresentada', b)}>Apresentei a solução</Toggle>
          <label style={lab}>O cliente quer avançar?</label>
          <Chips options={['Quer avançar', 'Vai pensar', 'Não quer']} value={s.interesse === 'quer' ? 'Quer avançar' : s.interesse === 'vai_pensar' ? 'Vai pensar' : s.interesse === 'nao' ? 'Não quer' : ''}
            onChange={v => set('interesse', v === 'Quer avançar' ? 'quer' : v === 'Vai pensar' ? 'vai_pensar' : 'nao')} />
        </>)}

        {fase === 'fechar' && (<>
          <label style={lab}>Nome *</label>
          <input style={input} value={s.nome} onChange={e => set('nome', e.target.value)} autoComplete="off" />
          <label style={lab}>Telemóvel *</label>
          <input style={input} inputMode="tel" value={s.telefone} onChange={e => set('telefone', e.target.value)} />
          <label style={lab}>Email (opcional)</label>
          <input style={input} inputMode="email" value={s.email} onChange={e => set('email', e.target.value)} />
          <label style={lab}>Morada (opcional)</label>
          <input style={input} value={s.morada} onChange={e => set('morada', e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={input} placeholder="Código postal" value={s.codigo_postal} onChange={e => set('codigo_postal', e.target.value)} />
            <input style={input} placeholder="Localidade" value={s.localidade} onChange={e => set('localidade', e.target.value)} />
          </div>
          <div style={{ marginTop: 12 }}><Toggle v={s.rgpd} set={b => set('rgpd', b)}>O cliente autoriza o tratamento dos seus dados (RGPD) *</Toggle></div>
        </>)}

        {fase === 'acompanhar' && (<>
          <label style={lab}>Próximo passo combinado</label>
          <input style={input} value={s.proxima_acao} onChange={e => set('proxima_acao', e.target.value)} placeholder="Ex.: confirmar instalação, enviar documentos" />
          <label style={lab}>Data do próximo contacto</label>
          <input style={input} type="date" value={s.data_proximo_contacto} onChange={e => set('data_proximo_contacto', e.target.value)} />
        </>)}

        {fase === 'multiplicar' && (<>
          <Toggle v={s.referencia_consentida} set={b => set('referencia_consentida', b)}>O cliente aceitou apresentar alguém</Toggle>
          <label style={lab}>Notas</label>
          <textarea style={{ ...input, minHeight: 80 }} value={s.notas} onChange={e => set('notas', e.target.value)} placeholder="O que ficou combinado" />
        </>)}
      </div>

      {msg && <p style={{ color: '#B91C1C', fontSize: 14 }}>{msg}</p>}

      {terminar && (
        <div style={{ ...card, borderColor: '#FCA5A5' }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Terminar sem avançar. Qual foi o motivo?</div>
          <Chips options={MOTIVOS} value={s.motivo_recusa} onChange={v => set('motivo_recusa', v)} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button disabled={saving || !s.motivo_recusa} onClick={() => void concluir(s.interesse === 'vai_pensar' ? 'vai_pensar' : 'sem_interesse', false)} style={{ flex: 1, padding: 13, borderRadius: 12, border: 0, background: s.motivo_recusa ? '#0F172A' : '#CBD5E1', color: '#fff', fontWeight: 700 }}>{saving ? 'A guardar…' : 'Guardar sem dados pessoais'}</button>
            <button onClick={() => setTerminar(false)} style={{ padding: 13, borderRadius: 12, border: '1px solid #CBD5E1', background: '#fff' }}>Voltar</button>
          </div>
        </div>
      )}

      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#fff', borderTop: '1px solid #E2E8F0', padding: 12, display: 'flex', gap: 8, justifyContent: 'center' }}>
        <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 560 }}>
          {idx > 0 && fase !== 'acompanhar' && <button onClick={() => setFase(FASES[idx - 1].id)} style={{ padding: 14, borderRadius: 12, border: '1px solid #CBD5E1', background: '#fff' }}><ArrowLeft size={18} /></button>}
          {idx <= 4 && <button onClick={() => setTerminar(true)} style={{ padding: '14px 12px', borderRadius: 12, border: '1px solid #FCA5A5', background: '#fff', color: '#B91C1C', fontWeight: 700, display: 'flex', gap: 5, alignItems: 'center' }}><XCircle size={16} /> Terminar</button>}
          <button onClick={seguinte} disabled={!podeAvancar || saving} style={{ flex: 1, padding: 14, borderRadius: 12, border: 0, background: podeAvancar ? '#2563EB' : '#CBD5E1', color: '#fff', fontSize: 16, fontWeight: 800, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
            {fase === 'multiplicar' ? (saving ? 'A guardar…' : 'Concluir e guardar') : <>Seguinte <ArrowRight size={18} /></>}
          </button>
        </div>
      </div>
    </div>
  )
}
