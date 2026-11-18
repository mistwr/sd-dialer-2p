import { createClient } from '@/lib/supabase/client'
import { doorCaptureService } from '@/lib/services'

// Funil AEDCRAFAM (manual MyPoupar+). Os dados pessoais só são pedidos no Fechar.
export type Fase = 'abordar' | 'escutar' | 'descobrir' | 'comparar' | 'resolver' | 'fechar' | 'acompanhar' | 'multiplicar'
export const FASES: { id: Fase; letra: string; nome: string }[] = [
  { id: 'abordar', letra: 'A', nome: 'Abordar' },
  { id: 'escutar', letra: 'E', nome: 'Escutar' },
  { id: 'descobrir', letra: 'D', nome: 'Descobrir' },
  { id: 'comparar', letra: 'C', nome: 'Comparar' },
  { id: 'resolver', letra: 'R', nome: 'Resolver' },
  { id: 'fechar', letra: 'F', nome: 'Fechar' },
  { id: 'acompanhar', letra: 'A', nome: 'Acompanhar' },
  { id: 'multiplicar', letra: 'M', nome: 'Multiplicar' },
]

export type FunilState = {
  id: string
  started_at: string
  fase_final: Fase
  latitude: number | null
  longitude: number | null
  reacao: string
  operadora: string
  valoriza: string[]
  satisfacao: number
  dor: string
  mensalidade: string
  tem_tv: boolean
  tem_internet: boolean
  tem_fixo: boolean
  moveis: string
  velocidade: string
  fim_fidelizacao: string
  tem_fatura: boolean
  comparacao_feita: boolean
  diferenca: string
  proposta_apresentada: boolean
  interesse: '' | 'quer' | 'vai_pensar' | 'nao'
  motivo_recusa: string
  nome: string
  telefone: string
  email: string
  morada: string
  codigo_postal: string
  localidade: string
  rgpd: boolean
  proxima_acao: string
  data_proximo_contacto: string
  referencia_consentida: boolean
  notas: string
}

export const novoFunil = (): FunilState => ({
  id: crypto.randomUUID(), started_at: new Date().toISOString(), fase_final: 'abordar',
  latitude: null, longitude: null, reacao: '', operadora: '', valoriza: [], satisfacao: 0, dor: '', mensalidade: '',
  tem_tv: false, tem_internet: false, tem_fixo: false, moveis: '', velocidade: '', fim_fidelizacao: '', tem_fatura: false,
  comparacao_feita: false, diferenca: '', proposta_apresentada: false, interesse: '', motivo_recusa: '',
  nome: '', telefone: '', email: '', morada: '', codigo_postal: '', localidade: '', rgpd: false,
  proxima_acao: '', data_proximo_contacto: '', referencia_consentida: false, notas: '',
})

export type Pendente = { state: FunilState; companyId: string; comercialId: string; resultado: string; fechou: boolean }
const QUEUE_KEY = 'porta-funil-fila'
const DRAFT_KEY = 'porta-funil-rascunho'

export const lerFila = (): Pendente[] => { try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]') } catch { return [] } }
const gravarFila = (f: Pendente[]) => { try { localStorage.setItem(QUEUE_KEY, JSON.stringify(f)) } catch { /* sem espaço */ } }
export const guardarRascunho = (s: FunilState) => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(s)) } catch { /* ignora */ } }
export const lerRascunho = (): FunilState | null => { try { const r = localStorage.getItem(DRAFT_KEY); return r ? JSON.parse(r) : null } catch { return null } }
export const limparRascunho = () => { try { localStorage.removeItem(DRAFT_KEY) } catch { /* ignora */ } }

const num = (v: string) => (v.trim() === '' || Number.isNaN(Number(v.replace(',', '.'))) ? null : Number(v.replace(',', '.')))

// Envia uma captura. Idempotente: o id é gerado no telemóvel, por isso reenviar não duplica.
async function enviar(p: Pendente) {
  const sb: any = createClient()
  const s = p.state
  let doorCaptureId: string | null = null
  if (p.fechou && s.nome.trim() && s.telefone.trim() && s.rgpd) {
    // Já enviada antes? (reenvio depois de falha a meio)
    const { data: ja } = await sb.from('door_funnel_captures').select('door_capture_id').eq('id', s.id).maybeSingle()
    if (ja?.door_capture_id) doorCaptureId = ja.door_capture_id
    else {
      const r = await doorCaptureService.createWithAutomation({
        companyId: p.companyId, comercialId: p.comercialId, temAnexos: false,
        door: {
          nome: s.nome.trim(), telefone: s.telefone.trim(), email: s.email.trim() || null, tipo_cliente: 'particular',
          morada: s.morada.trim() || null, codigo_postal: s.codigo_postal.trim() || null, localidade: s.localidade.trim() || null,
          latitude: s.latitude, longitude: s.longitude, consentimento_rgpd: true, data_consentimento: new Date().toISOString(),
          tc_operador_atual: s.operadora || null, tc_tem_tv: s.tem_tv, tc_tem_internet: s.tem_internet, tc_tem_fixo: s.tem_fixo,
          tc_num_cartoes_moveis: num(s.moveis), tc_mensalidade: num(s.mensalidade), tc_velocidade_internet: s.velocidade.trim() || null,
          tc_fim_fidelizacao: s.fim_fidelizacao || null, tc_satisfacao: s.satisfacao || null, tc_interesse_comparacao: s.comparacao_feita,
          interesse: 'alto' as any, temperatura: 'quente',
          notas: [s.dor && 'Dor: ' + s.dor, s.valoriza.length && 'Valoriza: ' + s.valoriza.join(', '), s.diferenca && 'Poupança estimada: ' + s.diferenca + ' €/mês', s.notas].filter(Boolean).join(' | ') || null,
          resultado: 'interessado' as any, proxima_acao: s.proxima_acao.trim() || null, data_proximo_contacto: s.data_proximo_contacto || null,
        } as any,
      })
      doorCaptureId = (r as any)?.doorCapture?.id || null
    }
  }
  const { error } = await sb.from('door_funnel_captures').upsert({
    id: s.id, company_id: p.companyId, comercial_id: p.comercialId, started_at: s.started_at, finished_at: new Date().toISOString(),
    fase_final: s.fase_final, resultado: p.resultado, motivo_recusa: s.motivo_recusa || null,
    latitude: s.latitude, longitude: s.longitude, reacao: s.reacao || null, operadora: s.operadora || null, valoriza: s.valoriza,
    dor: s.dor || null, mensalidade: num(s.mensalidade), satisfacao: s.satisfacao || null, fim_fidelizacao: s.fim_fidelizacao || null,
    servicos: { tv: s.tem_tv, internet: s.tem_internet, fixo: s.tem_fixo, moveis: num(s.moveis), velocidade: s.velocidade || null, tem_fatura: s.tem_fatura },
    comparacao_feita: s.comparacao_feita, diferenca_mensal_estimada: num(s.diferenca), proposta_apresentada: s.proposta_apresentada,
    notas: s.notas || null, door_capture_id: doorCaptureId, referencia_consentida: s.referencia_consentida, updated_at: new Date().toISOString(),
  }, { onConflict: 'id' })
  if (error) throw error
}

// Guarda sempre primeiro no telemóvel; tenta enviar; se não houver rede fica na fila.
export async function guardarCaptura(p: Pendente): Promise<'enviada' | 'na_fila'> {
  const fila = lerFila().filter(x => x.state.id !== p.state.id)
  gravarFila([...fila, p])
  limparRascunho()
  const r = await sincronizarFila()
  return r.restantes === 0 ? 'enviada' : 'na_fila'
}

let aSincronizar = false
export async function sincronizarFila(): Promise<{ enviadas: number; restantes: number }> {
  if (aSincronizar) return { enviadas: 0, restantes: lerFila().length }
  aSincronizar = true
  let enviadas = 0
  try {
    for (const p of lerFila()) {
      try { await enviar(p); enviadas++; gravarFila(lerFila().filter(x => x.state.id !== p.state.id)) } catch { break }
    }
  } finally { aSincronizar = false }
  return { enviadas, restantes: lerFila().length }
}
