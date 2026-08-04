'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import {
  ArrowLeft, ArrowRight, MapPin,
  CheckCircle2, Loader2, Mic, AlertTriangle,
} from 'lucide-react'
import { doorCaptureService, campanhaService } from '@/lib/services'
import { useAuth } from '@/lib/hooks/useAuth'
import type {
  TipoCliente, ProblemaTelecom, EnergiaTipo, InteresseEnergia,
  Interesse, ResultadoPorta,
} from '@/lib/types'

const DRAFT_KEY = 'porta-lead-draft'
const STEPS = ['Contacto', 'Telecom', 'Energia', 'Qualificação'] as const

interface FormState {
  nome: string
  telefone: string
  email: string
  tipo_cliente: TipoCliente
  nif: string
  morada: string
  codigo_postal: string
  localidade: string
  distrito: string
  latitude: number | null
  longitude: number | null
  consentimento_rgpd: boolean
  campanha_id: string

  tc_operador_atual: string
  tc_tem_tv: boolean
  tc_tem_internet: boolean
  tc_tem_fixo: boolean
  tc_num_cartoes_moveis: string
  tc_mensalidade: string
  tc_velocidade_internet: string
  tc_fim_fidelizacao: string
  tc_satisfacao: number
  tc_problemas: ProblemaTelecom[]
  tc_interesse_comparacao: boolean

  en_comercializador_atual: string
  en_tipo: EnergiaTipo | ''
  en_potencia_contratada: string
  en_tipo_tarifa: string
  en_valor_medio_mensal: string
  en_fim_contrato: string
  en_interesse: InteresseEnergia[]

  interesse: Interesse | ''
  temperatura: '' | 'quente' | 'morna' | 'fria'
  melhor_horario: string
  notas: string
  resultado: ResultadoPorta | ''
  proxima_acao: string
  data_proximo_contacto: string
}

const EMPTY: FormState = {
  nome: '', telefone: '', email: '', tipo_cliente: 'particular', nif: '',
  morada: '', codigo_postal: '', localidade: '', distrito: '',
  latitude: null, longitude: null, consentimento_rgpd: false, campanha_id: '',
  tc_operador_atual: '', tc_tem_tv: false, tc_tem_internet: false, tc_tem_fixo: false,
  tc_num_cartoes_moveis: '', tc_mensalidade: '', tc_velocidade_internet: '',
  tc_fim_fidelizacao: '', tc_satisfacao: 0, tc_problemas: [], tc_interesse_comparacao: false,
  en_comercializador_atual: '', en_tipo: '', en_potencia_contratada: '', en_tipo_tarifa: '',
  en_valor_medio_mensal: '', en_fim_contrato: '', en_interesse: [],
  interesse: '', temperatura: '', melhor_horario: '', notas: '',
  resultado: '', proxima_acao: '', data_proximo_contacto: '',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '13px 14px', borderRadius: 12, border: '1.5px solid #E2E8F0',
  fontSize: 15, outline: 'none', boxSizing: 'border-box', background: '#fff',
}
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6 }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 16 }}><label style={labelStyle}>{label}</label>{children}</div>
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
        borderRadius: 12, border: `1.5px solid ${checked ? '#2563EB' : '#E2E8F0'}`,
        background: checked ? '#EFF6FF' : '#fff', cursor: 'pointer', width: '100%', textAlign: 'left',
      }}
    >
      <div style={{
        width: 20, height: 20, borderRadius: 6, flexShrink: 0,
        border: `2px solid ${checked ? '#2563EB' : '#CBD5E1'}`, background: checked ? '#2563EB' : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {checked && <CheckCircle2 size={14} color="#fff" />}
      </div>
      <span style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{label}</span>
    </button>
  )
}

interface MinimalSpeechRecognition {
  lang: string
  continuous: boolean
  onstart: (() => void) | null
  onend: (() => void) | null
  onresult: ((event: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null
  start: () => void
}

function VoiceTextarea({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [listening, setListening] = useState(false)

  const startDictation = useCallback(() => {
    const w = window as unknown as {
      webkitSpeechRecognition?: new () => MinimalSpeechRecognition
      SpeechRecognition?: new () => MinimalSpeechRecognition
    }
    const SpeechRecognitionCtor = w.webkitSpeechRecognition ?? w.SpeechRecognition
    if (!SpeechRecognitionCtor) return
    const recognition = new SpeechRecognitionCtor()
    recognition.lang = 'pt-PT'
    recognition.continuous = false
    recognition.onstart = () => setListening(true)
    recognition.onend = () => setListening(false)
    recognition.onresult = (e) => {
      const text = e.results[0]?.[0]?.transcript
      if (text) onChange(value ? `${value} ${text}` : text)
    }
    recognition.start()
  }, [value, onChange])

  const supported = typeof window !== 'undefined' &&
    ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)

  return (
    <div style={{ position: 'relative' }}>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        style={{ ...inputStyle, resize: 'vertical', paddingRight: supported ? 46 : 14 }}
      />
      {supported && (
        <button
          type="button"
          onClick={startDictation}
          title="Ditar por voz"
          style={{
            position: 'absolute', right: 10, top: 10, width: 30, height: 30, borderRadius: 8,
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: listening ? '#DC2626' : '#F1F5F9', color: listening ? '#fff' : '#64748B',
          }}
        >
          <Mic size={15} />
        </button>
      )}
    </div>
  )
}

export default function NovaCaptacaoPage() {
  const router = useRouter()
  const { user, profile } = useAuth()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [locStatus, setLocStatus] = useState<'idle' | 'asking' | 'granted' | 'denied'>('idle')
  const [dirty, setDirty] = useState(false)

  const { data: campanhas = [] } = useSWR('campanhas-porta', () => campanhaService.getAll())

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(f => ({ ...f, [key]: value }))
    setDirty(true)
  }

  // Autosave draft
  useEffect(() => {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (raw) {
      try { setForm({ ...EMPTY, ...JSON.parse(raw) }) } catch { /* ignore corrupted draft */ }
    }
  }, [])
  useEffect(() => {
    const t = setTimeout(() => localStorage.setItem(DRAFT_KEY, JSON.stringify(form)), 500)
    return () => clearTimeout(t)
  }, [form])

  // Confirm before leaving with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) { e.preventDefault() }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const requestLocation = () => {
    if (!navigator.geolocation) return
    setLocStatus('asking')
    navigator.geolocation.getCurrentPosition(
      pos => {
        set('latitude', pos.coords.latitude)
        set('longitude', pos.coords.longitude)
        setLocStatus('granted')
      },
      () => setLocStatus('denied'),
      { timeout: 8000 }
    )
  }

  const toggleArrayItem = <T extends string>(arr: T[], item: T): T[] =>
    arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item]

  const canProceedStep0 = form.nome.trim() && form.telefone.trim() && form.consentimento_rgpd

  const handleSubmit = async () => {
    if (!user?.id || !profile?.company_id) return
    setSaving(true)
    setError(null)
    try {
      const temAnexos = false // uploads handled separately após criação
      await doorCaptureService.createWithAutomation({
        companyId: profile.company_id,
        comercialId: user.id,
        temAnexos,
        door: {
          nome: form.nome.trim(),
          telefone: form.telefone.trim(),
          email: form.email.trim() || null,
          tipo_cliente: form.tipo_cliente,
          nif: form.nif.trim() || null,
          morada: form.morada.trim() || null,
          codigo_postal: form.codigo_postal.trim() || null,
          localidade: form.localidade.trim() || null,
          distrito: form.distrito.trim() || null,
          latitude: form.latitude,
          longitude: form.longitude,
          consentimento_rgpd: form.consentimento_rgpd,
          data_consentimento: form.consentimento_rgpd ? new Date().toISOString() : null,
          campanha_id: form.campanha_id || null,

          tc_operador_atual: form.tc_operador_atual.trim() || null,
          tc_tem_tv: form.tc_tem_tv,
          tc_tem_internet: form.tc_tem_internet,
          tc_tem_fixo: form.tc_tem_fixo,
          tc_num_cartoes_moveis: form.tc_num_cartoes_moveis ? Number(form.tc_num_cartoes_moveis) : null,
          tc_mensalidade: form.tc_mensalidade ? Number(form.tc_mensalidade) : null,
          tc_velocidade_internet: form.tc_velocidade_internet.trim() || null,
          tc_fim_fidelizacao: form.tc_fim_fidelizacao || null,
          tc_satisfacao: form.tc_satisfacao || null,
          tc_problemas: form.tc_problemas,
          tc_interesse_comparacao: form.tc_interesse_comparacao,

          en_comercializador_atual: form.en_comercializador_atual.trim() || null,
          en_tipo: form.en_tipo || null,
          en_potencia_contratada: form.en_potencia_contratada.trim() || null,
          en_tipo_tarifa: form.en_tipo_tarifa.trim() || null,
          en_valor_medio_mensal: form.en_valor_medio_mensal ? Number(form.en_valor_medio_mensal) : null,
          en_fim_contrato: form.en_fim_contrato || null,
          en_interesse: form.en_interesse,

          interesse: form.interesse || null,
          temperatura: form.temperatura || null,
          melhor_horario: form.melhor_horario.trim() || null,
          notas: form.notas.trim() || null,
          resultado: form.resultado || null,
          proxima_acao: form.proxima_acao.trim() || null,
          data_proximo_contacto: form.data_proximo_contacto || null,
        },
      })
      localStorage.removeItem(DRAFT_KEY)
      setDirty(false)
      router.push('/parceiro/porta')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao guardar captação')
    } finally {
      setSaving(false)
    }
  }

  const goBack = () => {
    if (dirty && !confirm('Tens alterações não guardadas. Sair mesmo assim?')) return
    router.push('/parceiro/porta')
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <button onClick={goBack} style={{ background: '#F1F5F9', border: 'none', borderRadius: 10, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ArrowLeft size={18} color="#0F172A" />
        </button>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', margin: 0 }}>Nova captação</h1>
          <p style={{ fontSize: 12, color: '#64748B', margin: '2px 0 0' }}>Etapa {step + 1} de {STEPS.length} — {STEPS[step]}</p>
        </div>
      </div>

      {/* Progress */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 22 }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ flex: 1, height: 5, borderRadius: 3, background: i <= step ? '#2563EB' : '#E2E8F0', transition: 'background 0.2s' }} />
        ))}
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', color: '#991B1B', padding: '12px 14px', borderRadius: 12, fontSize: 13, marginBottom: 16, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
        </div>
      )}

      {/* STEP 0 — Contacto */}
      {step === 0 && (
        <div>
          <Field label="Nome *">
            <input style={inputStyle} value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Nome do cliente" />
          </Field>
          <Field label="Telefone *">
            <input style={inputStyle} value={form.telefone} onChange={e => set('telefone', e.target.value)} placeholder="9XX XXX XXX" inputMode="tel" />
          </Field>
          <Field label="Email (opcional)">
            <input style={inputStyle} value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@exemplo.pt" inputMode="email" />
          </Field>
          <Field label="Tipo de cliente">
            <div style={{ display: 'flex', gap: 8 }}>
              {(['particular', 'empresa'] as TipoCliente[]).map(t => (
                <button key={t} type="button" onClick={() => set('tipo_cliente', t)} style={{
                  flex: 1, padding: '11px', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 600,
                  border: `1.5px solid ${form.tipo_cliente === t ? '#2563EB' : '#E2E8F0'}`,
                  background: form.tipo_cliente === t ? '#EFF6FF' : '#fff',
                  color: form.tipo_cliente === t ? '#2563EB' : '#64748B',
                }}>{t === 'particular' ? 'Particular' : 'Empresa'}</button>
              ))}
            </div>
          </Field>
          {form.tipo_cliente === 'empresa' && (
            <Field label="NIF (opcional)">
              <input style={inputStyle} value={form.nif} onChange={e => set('nif', e.target.value)} inputMode="numeric" />
            </Field>
          )}
          <Field label="Morada">
            <input style={inputStyle} value={form.morada} onChange={e => set('morada', e.target.value)} placeholder="Rua, número" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Código postal">
              <input style={inputStyle} value={form.codigo_postal} onChange={e => set('codigo_postal', e.target.value)} placeholder="0000-000" />
            </Field>
            <Field label="Localidade">
              <input style={inputStyle} value={form.localidade} onChange={e => set('localidade', e.target.value)} />
            </Field>
          </div>
          <Field label="Distrito">
            <input style={inputStyle} value={form.distrito} onChange={e => set('distrito', e.target.value)} />
          </Field>
          <Field label="Campanha">
            <select style={inputStyle} value={form.campanha_id} onChange={e => set('campanha_id', e.target.value)}>
              <option value="">Sem campanha</option>
              {campanhas.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>

          <Field label="Localização">
            <button type="button" onClick={requestLocation} style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px 14px',
              borderRadius: 12, border: '1.5px solid #E2E8F0', background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#374151',
            }}>
              <MapPin size={16} color={locStatus === 'granted' ? '#16A34A' : '#64748B'} />
              {locStatus === 'granted' ? 'Localização registada ✓' : locStatus === 'asking' ? 'A obter localização...' : locStatus === 'denied' ? 'Sem permissão — toca para tentar de novo' : 'Registar localização atual (opcional)'}
            </button>
          </Field>

          <div style={{ marginTop: 20 }}>
            <Toggle checked={form.consentimento_rgpd} onChange={v => set('consentimento_rgpd', v)} label="Cliente deu consentimento para ser contactado (RGPD) *" />
          </div>
        </div>
      )}

      {/* STEP 1 — Telecom */}
      {step === 1 && (
        <div>
          <Field label="Operador atual">
            <input style={inputStyle} value={form.tc_operador_atual} onChange={e => set('tc_operador_atual', e.target.value)} placeholder="MEO, NOS, Vodafone, NOWO..." />
          </Field>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            <Toggle checked={form.tc_tem_tv} onChange={v => set('tc_tem_tv', v)} label="Tem TV" />
            <Toggle checked={form.tc_tem_internet} onChange={v => set('tc_tem_internet', v)} label="Tem Internet" />
            <Toggle checked={form.tc_tem_fixo} onChange={v => set('tc_tem_fixo', v)} label="Tem telefone fixo" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Nº cartões móveis">
              <input style={inputStyle} type="number" value={form.tc_num_cartoes_moveis} onChange={e => set('tc_num_cartoes_moveis', e.target.value)} />
            </Field>
            <Field label="Mensalidade atual (€)">
              <input style={inputStyle} type="number" value={form.tc_mensalidade} onChange={e => set('tc_mensalidade', e.target.value)} />
            </Field>
          </div>
          <Field label="Velocidade da internet">
            <input style={inputStyle} value={form.tc_velocidade_internet} onChange={e => set('tc_velocidade_internet', e.target.value)} placeholder="ex: 300 Mbps" />
          </Field>
          <Field label="Fim da fidelização">
            <input style={inputStyle} type="date" value={form.tc_fim_fidelizacao} onChange={e => set('tc_fim_fidelizacao', e.target.value)} />
          </Field>
          <Field label="Satisfação (1-5)">
            <div style={{ display: 'flex', gap: 6 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} type="button" onClick={() => set('tc_satisfacao', n)} style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 14,
                  border: `1.5px solid ${form.tc_satisfacao === n ? '#2563EB' : '#E2E8F0'}`,
                  background: form.tc_satisfacao === n ? '#2563EB' : '#fff',
                  color: form.tc_satisfacao === n ? '#fff' : '#64748B',
                }}>{n}</button>
              ))}
            </div>
          </Field>
          <Field label="Problemas identificados">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(['preco', 'cobertura', 'velocidade', 'avarias', 'atendimento', 'fidelizacao', 'outro'] as ProblemaTelecom[]).map(p => (
                <button key={p} type="button" onClick={() => set('tc_problemas', toggleArrayItem(form.tc_problemas, p))} style={{
                  padding: '8px 14px', borderRadius: 999, cursor: 'pointer', fontSize: 13, fontWeight: 600, textTransform: 'capitalize',
                  border: `1.5px solid ${form.tc_problemas.includes(p) ? '#2563EB' : '#E2E8F0'}`,
                  background: form.tc_problemas.includes(p) ? '#EFF6FF' : '#fff',
                  color: form.tc_problemas.includes(p) ? '#2563EB' : '#64748B',
                }}>{p}</button>
              ))}
            </div>
          </Field>
          <Toggle checked={form.tc_interesse_comparacao} onChange={v => set('tc_interesse_comparacao', v)} label="Interessado em receber comparação" />
          <div style={{ marginTop: 16, fontSize: 13, color: '#94A3B8' }}>
            Upload de fatura disponível depois de guardares a captação.
          </div>
        </div>
      )}

      {/* STEP 2 — Energia */}
      {step === 2 && (
        <div>
          <Field label="Comercializador atual">
            <input style={inputStyle} value={form.en_comercializador_atual} onChange={e => set('en_comercializador_atual', e.target.value)} placeholder="EDP, Endesa, Galp, Iberdrola..." />
          </Field>
          <Field label="Tipo">
            <div style={{ display: 'flex', gap: 8 }}>
              {(['eletricidade', 'gas', 'ambos'] as EnergiaTipo[]).map(t => (
                <button key={t} type="button" onClick={() => set('en_tipo', t)} style={{
                  flex: 1, padding: '11px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, textTransform: 'capitalize',
                  border: `1.5px solid ${form.en_tipo === t ? '#2563EB' : '#E2E8F0'}`,
                  background: form.en_tipo === t ? '#EFF6FF' : '#fff',
                  color: form.en_tipo === t ? '#2563EB' : '#64748B',
                }}>{t}</button>
              ))}
            </div>
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Potência contratada">
              <input style={inputStyle} value={form.en_potencia_contratada} onChange={e => set('en_potencia_contratada', e.target.value)} placeholder="ex: 6.9 kVA" />
            </Field>
            <Field label="Tipo de tarifa">
              <input style={inputStyle} value={form.en_tipo_tarifa} onChange={e => set('en_tipo_tarifa', e.target.value)} placeholder="Simples, bi-horária..." />
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Valor médio mensal (€)">
              <input style={inputStyle} type="number" value={form.en_valor_medio_mensal} onChange={e => set('en_valor_medio_mensal', e.target.value)} />
            </Field>
            <Field label="Fim de contrato">
              <input style={inputStyle} type="date" value={form.en_fim_contrato} onChange={e => set('en_fim_contrato', e.target.value)} />
            </Field>
          </div>
          <Field label="Interesse em">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {([
                ['poupanca', 'Poupança'], ['solar', 'Solar'], ['wallbox', 'Wallbox'], ['mobilidade_eletrica', 'Mobilidade Elétrica'],
              ] as [InteresseEnergia, string][]).map(([v, l]) => (
                <button key={v} type="button" onClick={() => set('en_interesse', toggleArrayItem(form.en_interesse, v))} style={{
                  padding: '8px 14px', borderRadius: 999, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  border: `1.5px solid ${form.en_interesse.includes(v) ? '#2563EB' : '#E2E8F0'}`,
                  background: form.en_interesse.includes(v) ? '#EFF6FF' : '#fff',
                  color: form.en_interesse.includes(v) ? '#2563EB' : '#64748B',
                }}>{l}</button>
              ))}
            </div>
          </Field>
        </div>
      )}

      {/* STEP 3 — Qualificação */}
      {step === 3 && (
        <div>
          <Field label="Interesse">
            <div style={{ display: 'flex', gap: 8 }}>
              {([['telecomunicacoes', 'Telecom'], ['energia', 'Energia'], ['ambos', 'Ambos']] as [Interesse, string][]).map(([v, l]) => (
                <button key={v} type="button" onClick={() => set('interesse', v)} style={{
                  flex: 1, padding: '11px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  border: `1.5px solid ${form.interesse === v ? '#2563EB' : '#E2E8F0'}`,
                  background: form.interesse === v ? '#EFF6FF' : '#fff',
                  color: form.interesse === v ? '#2563EB' : '#64748B',
                }}>{l}</button>
              ))}
            </div>
          </Field>
          <Field label="Temperatura (deixa vazio para calcular automaticamente pelo score)">
            <div style={{ display: 'flex', gap: 8 }}>
              {([['quente', '🔥 Quente'], ['morna', '🌤️ Morna'], ['fria', '❄️ Fria']] as [string, string][]).map(([v, l]) => (
                <button key={v} type="button" onClick={() => set('temperatura', form.temperatura === v ? '' : v as FormState['temperatura'])} style={{
                  flex: 1, padding: '11px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  border: `1.5px solid ${form.temperatura === v ? '#2563EB' : '#E2E8F0'}`,
                  background: form.temperatura === v ? '#EFF6FF' : '#fff',
                  color: form.temperatura === v ? '#2563EB' : '#64748B',
                }}>{l}</button>
              ))}
            </div>
          </Field>
          <Field label="Melhor horário para contacto">
            <input style={inputStyle} value={form.melhor_horario} onChange={e => set('melhor_horario', e.target.value)} placeholder="ex: Depois das 18h" />
          </Field>
          <Field label="Notas do comercial">
            <VoiceTextarea value={form.notas} onChange={v => set('notas', v)} placeholder="Observações da abordagem..." />
          </Field>
          <Field label="Resultado">
            <select style={inputStyle} value={form.resultado} onChange={e => set('resultado', e.target.value as ResultadoPorta)}>
              <option value="">Seleciona...</option>
              <option value="interessado">Interessado</option>
              <option value="follow_up">Follow-up</option>
              <option value="sem_interesse">Sem interesse</option>
              <option value="ja_cliente">Já é cliente</option>
              <option value="venda">Venda</option>
            </select>
          </Field>
          {form.resultado === 'follow_up' && (
            <>
              <Field label="Próxima ação">
                <input style={inputStyle} value={form.proxima_acao} onChange={e => set('proxima_acao', e.target.value)} placeholder="ex: Enviar proposta por WhatsApp" />
              </Field>
              <Field label="Data do próximo contacto">
                <input style={inputStyle} type="date" value={form.data_proximo_contacto} onChange={e => set('data_proximo_contacto', e.target.value)} />
              </Field>
            </>
          )}
        </div>
      )}

      {/* Nav buttons */}
      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)} style={{
            flex: 1, padding: '15px', borderRadius: 14, border: '1.5px solid #E2E8F0', background: '#fff',
            fontSize: 15, fontWeight: 700, color: '#374151', cursor: 'pointer',
          }}>Voltar</button>
        )}
        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep(s => s + 1)}
            disabled={step === 0 && !canProceedStep0}
            style={{
              flex: 2, padding: '15px', borderRadius: 14, border: 'none',
              background: (step === 0 && !canProceedStep0) ? '#CBD5E1' : '#2563EB', color: '#fff',
              fontSize: 15, fontWeight: 700, cursor: (step === 0 && !canProceedStep0) ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            Continuar <ArrowRight size={17} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{
              flex: 2, padding: '15px', borderRadius: 14, border: 'none',
              background: '#16A34A', color: '#fff', fontSize: 15, fontWeight: 700,
              cursor: saving ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {saving ? <><Loader2 size={17} className="spin" /> A guardar...</> : <><CheckCircle2 size={17} /> Guardar captação</>}
          </button>
        )}
      </div>
      {step === 0 && !canProceedStep0 && (
        <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 8, textAlign: 'center' }}>
          Nome, telefone e consentimento RGPD são obrigatórios para continuar.
        </p>
      )}

      <style>{`
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        select { appearance: none; -webkit-appearance: none; }
      `}</style>
    </div>
  )
}
