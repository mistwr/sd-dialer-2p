// ============================================================
// SD Dialer v2 — Shared TypeScript Types
// ============================================================

export type UserRole = 'admin' | 'supervisor' | 'parceiro'
export type UserStatus = 'active' | 'inactive' | 'suspended'
export type CompanyPlan = 'free' | 'starter' | 'pro' | 'enterprise'
export type CompanyStatus = 'active' | 'inactive' | 'trial'
export type LeadStatus =
  | 'novo'
  | 'contactado'
  | 'vendido'
  | 'nao_interessado'
  | 'nao_atende'
  | 'numero_errado'
  | 'ligar_depois'
  | 'sem_cobertura'
  | 'outro'
export type CallResult =
  | 'venda'
  | 'nao_interessado'
  | 'nao_atende'
  | 'numero_errado'
  | 'ligar_depois'
  | 'sem_cobertura'
  | 'outro'
export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived'
export type NotificationType = 'nova_lead' | 'follow_up' | 'objetivo' | 'sistema'

export interface Company {
  id: string
  name: string
  logo_url: string | null
  nif: string | null
  address: string | null
  email: string | null
  phone: string | null
  status: CompanyStatus
  plan: CompanyPlan
  created_at: string
  updated_at: string
}

export interface Usuario {
  id: string
  company_id: string | null
  email: string
  full_name: string
  phone: string | null
  role: UserRole
  status: UserStatus
  avatar_url: string | null
  last_seen_at: string | null
  created_at: string
  updated_at: string
}

export interface Campanha {
  id: string
  company_id: string
  name: string
  description: string | null
  status: CampaignStatus
  created_by: string | null
  starts_at: string | null
  ends_at: string | null
  created_at: string
  updated_at: string
}

export interface Lead {
  id: string
  company_id: string
  campanha_id: string | null
  assigned_to: string | null
  nome: string
  telefone: string
  email: string | null
  morada: string | null
  codigo_postal: string | null
  localidade: string | null
  operador: string | null
  observacoes: string | null
  status: LeadStatus
  priority: number
  imported_at: string
  created_at: string
  updated_at: string
  // Joined fields
  campanha?: Pick<Campanha, 'id' | 'name'> | null
  parceiro?: Pick<Usuario, 'id' | 'full_name' | 'avatar_url'> | null
}

export interface CallHistory {
  id: string
  lead_id: string
  parceiro_id: string
  company_id: string
  result: CallResult
  duration_sec: number
  notes: string | null
  called_at: string
  created_at: string
  // Joined
  lead?: Pick<Lead, 'id' | 'nome' | 'telefone'> | null
  parceiro?: Pick<Usuario, 'id' | 'full_name'> | null
}

export interface FollowUp {
  id: string
  lead_id: string
  parceiro_id: string
  company_id: string
  scheduled_at: string
  notes: string | null
  done: boolean
  created_at: string
  lead?: Pick<Lead, 'id' | 'nome' | 'telefone'> | null
}

export interface Notificacao {
  id: string
  user_id: string
  type: NotificationType
  title: string
  message: string
  read: boolean
  data: Record<string, unknown> | null
  created_at: string
}

// ============================================================
// UI helpers
// ============================================================
export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  novo: 'Novo',
  contactado: 'Contactado',
  vendido: 'Vendido',
  nao_interessado: 'Nao Interessado',
  nao_atende: 'Nao Atende',
  numero_errado: 'Numero Errado',
  ligar_depois: 'Ligar Depois',
  sem_cobertura: 'Sem Cobertura',
  outro: 'Outro',
}

export const CALL_RESULT_LABELS: Record<CallResult, string> = {
  venda: 'Venda',
  nao_interessado: 'Nao Interessado',
  nao_atende: 'Nao Atende',
  numero_errado: 'Numero Errado',
  ligar_depois: 'Ligar Depois',
  sem_cobertura: 'Sem Cobertura',
  outro: 'Outro',
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  supervisor: 'Supervisor',
  parceiro: 'Parceiro',
}

export const STATUS_COLORS: Record<LeadStatus, string> = {
  novo: '#2563EB',
  contactado: '#D97706',
  vendido: '#16A34A',
  nao_interessado: '#DC2626',
  nao_atende: '#6B7280',
  numero_errado: '#7C3AED',
  ligar_depois: '#0891B2',
  sem_cobertura: '#EA580C',
  outro: '#6B7280',
}

// ============================================================
// Porta → Lead (Captação de Porta)
// ============================================================

export type TipoCliente = 'particular' | 'empresa'
export type EnergiaTipo = 'eletricidade' | 'gas' | 'ambos'
export type Interesse = 'telecomunicacoes' | 'energia' | 'ambos'
export type Temperatura = 'quente' | 'morna' | 'fria'
export type ResultadoPorta = 'interessado' | 'follow_up' | 'sem_interesse' | 'ja_cliente' | 'venda'
export type ProblemaTelecom = 'preco' | 'cobertura' | 'velocidade' | 'avarias' | 'atendimento' | 'fidelizacao' | 'outro'
export type InteresseEnergia = 'poupanca' | 'solar' | 'wallbox' | 'mobilidade_eletrica'
export type TipoAnexoPorta = 'fatura_telecom' | 'fatura_energia' | 'outro'
export type TipoTimeline = 'porta' | 'chamada' | 'follow_up' | 'nota' | 'sistema'

export interface DoorCapture {
  id: string
  company_id: string
  lead_id: string | null
  comercial_id: string
  campanha_id: string | null

  // Etapa 1
  nome: string
  telefone: string
  email: string | null
  tipo_cliente: TipoCliente
  nif: string | null
  morada: string | null
  codigo_postal: string | null
  localidade: string | null
  distrito: string | null
  latitude: number | null
  longitude: number | null
  consentimento_rgpd: boolean
  data_consentimento: string | null

  // Etapa 2 — Telecom
  tc_operador_atual: string | null
  tc_tem_tv: boolean | null
  tc_tem_internet: boolean | null
  tc_tem_fixo: boolean | null
  tc_num_cartoes_moveis: number | null
  tc_mensalidade: number | null
  tc_velocidade_internet: string | null
  tc_fim_fidelizacao: string | null
  tc_satisfacao: number | null
  tc_problemas: ProblemaTelecom[]
  tc_interesse_comparacao: boolean | null

  // Etapa 3 — Energia
  en_comercializador_atual: string | null
  en_tipo: EnergiaTipo | null
  en_potencia_contratada: string | null
  en_tipo_tarifa: string | null
  en_valor_medio_mensal: number | null
  en_fim_contrato: string | null
  en_interesse: InteresseEnergia[]

  // Etapa 4 — Qualificação
  interesse: Interesse | null
  temperatura: Temperatura | null
  melhor_horario: string | null
  notas: string | null
  resultado: ResultadoPorta | null
  proxima_acao: string | null
  data_proximo_contacto: string | null

  // Score
  score: number
  score_motivos: string[]

  duplicado_de_lead_id: string | null
  created_at: string
  updated_at: string

  // Joined
  comercial?: Pick<Usuario, 'id' | 'full_name' | 'avatar_url'> | null
  campanha?: Pick<Campanha, 'id' | 'name'> | null
  lead?: Pick<Lead, 'id' | 'nome' | 'status'> | null
}

export interface DoorCaptureAttachment {
  id: string
  door_capture_id: string
  company_id: string
  tipo: TipoAnexoPorta
  storage_path: string
  file_name: string | null
  file_size: number | null
  content_type: string | null
  uploaded_by: string | null
  created_at: string
}

export interface LeadTimelineEntry {
  id: string
  company_id: string
  lead_id: string
  tipo: TipoTimeline
  descricao: string
  usuario_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  usuario?: Pick<Usuario, 'id' | 'full_name'> | null
}

export const RESULTADO_PORTA_LABELS: Record<ResultadoPorta, string> = {
  interessado: 'Interessado',
  follow_up: 'Follow-up',
  sem_interesse: 'Sem interesse',
  ja_cliente: 'Já é cliente',
  venda: 'Venda',
}

export const TEMPERATURA_LABELS: Record<Temperatura, string> = {
  quente: 'Quente',
  morna: 'Morna',
  fria: 'Fria',
}

export const TEMPERATURA_COLORS: Record<Temperatura, string> = {
  quente: '#DC2626',
  morna: '#D97706',
  fria: '#2563EB',
}

export const PROBLEMA_TELECOM_LABELS: Record<ProblemaTelecom, string> = {
  preco: 'Preço',
  cobertura: 'Cobertura',
  velocidade: 'Velocidade',
  avarias: 'Avarias',
  atendimento: 'Atendimento',
  fidelizacao: 'Fidelização',
  outro: 'Outro',
}
