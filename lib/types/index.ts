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
