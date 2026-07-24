/**
 * SD Dialer - Main Types & Interfaces
 * Tipos centralizados para todo o projeto
 */

export type UserRole = 'admin' | 'supervisor' | 'comercial'
export type LeadStatus = 'new' | 'contactado' | 'vendido' | 'nao_interessado' | 'agendar' | 'outras'
export type CallResult = 'venda' | 'nao_interessado' | 'nao_atende' | 'numero_errado' | 'ligar_depois' | 'cliente_aderiu' | 'sem_cobertura' | 'outro'
export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed'
export type DistributionType = 'manual' | 'automatic' | 'by_team' | 'by_percentage'
export type FollowUpStatus = 'pending' | 'completed' | 'cancelled'
export type NotificationType = 'new_lead' | 'follow_up_reminder' | 'objective_reached' | 'assignment'
export type SubscriptionPlan = 'free' | 'basic' | 'pro' | 'enterprise'
export type UserStatus = 'active' | 'inactive'

// Database Types
export interface Company {
  id: string
  name: string
  nif: string
  email: string
  phone: string
  address: string
  postal_code: string
  city: string
  logo_url: string | null
  subscription_plan: SubscriptionPlan
  max_users: number
  max_leads: number
  created_at: string
  updated_at: string
  active: boolean
}

export interface Usuario {
  id: string
  email: string
  full_name: string
  phone: string
  company_id: string
  role: UserRole
  supervisor_id: string | null
  avatar_url: string | null
  status: UserStatus
  last_login: string | null
  created_at: string
  updated_at: string
}

export interface Campanha {
  id: string
  company_id: string
  name: string
  description: string
  status: CampaignStatus
  start_date: string
  end_date: string
  target_count: number
  created_by: string
  created_at: string
  updated_at: string
}

export interface Lead {
  id: string
  company_id: string
  campaign_id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string
  mobile: string | null
  address: string | null
  postal_code: string | null
  city: string | null
  nif: string | null
  operator: string | null
  status: LeadStatus
  assigned_to: string | null
  notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface CallHistory {
  id: string
  lead_id: string
  company_id: string
  usuario_id: string
  campaign_id: string
  call_date: string
  call_time: string
  duration_seconds: number
  result: CallResult
  notes: string | null
  follow_up_date: string | null
  follow_up_time: string | null
  created_at: string
  updated_at: string
}

export interface FollowUp {
  id: string
  lead_id: string
  usuario_id: string
  company_id: string
  scheduled_date: string
  scheduled_time: string
  status: FollowUpStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Distribuicao {
  id: string
  company_id: string
  campaign_id: string | null
  distribution_type: DistributionType
  created_by: string
  total_leads: number
  created_at: string
  updated_at: string
}

export interface DistribuicaoLead {
  id: string
  distribuicao_id: string
  lead_id: string
  usuario_id: string
  percentage: number | null
  created_at: string
}

export interface Notificacao {
  id: string
  usuario_id: string
  company_id: string
  type: NotificationType
  title: string
  message: string
  related_entity_id: string | null
  read: boolean
  created_at: string
  read_at: string | null
}

export interface Objetivo {
  id: string
  company_id: string
  usuario_id: string | null
  period: 'daily' | 'weekly' | 'monthly'
  calls_target: number
  sales_target: number
  conversion_target: number
  start_date: string
  end_date: string
  created_at: string
  updated_at: string
}

// Session/Auth Types
export interface AuthUser {
  id: string
  email: string
  role: UserRole
  company_id: string
  full_name: string
}

export interface AuthSession {
  user: AuthUser
  access_token: string
  refresh_token: string
  expires_at: number
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Form Types
export interface LoginFormData {
  email: string
  password: string
}

export interface RegisterFormData {
  email: string
  password: string
  passwordConfirm: string
  fullName: string
  companyName: string
  nif: string
}

export interface UsuarioFormData {
  email: string
  fullName: string
  phone: string
  role: UserRole
  supervisorId?: string
}

export interface CampanhaFormData {
  name: string
  description: string
  startDate: string
  endDate: string
  targetCount: number
  status: CampaignStatus
}

export interface CallResultFormData {
  result: CallResult
  notes: string
  followUpDate?: string
  followUpTime?: string
  followUp: boolean
}

// Dashboard Stats
export interface DashboardStats {
  comerciaisOnline: number
  totalLeads: number
  leadsParaContactar: number
  chamadosHoje: number
  tempoTotalChamadas: number
  tempoMedioChamadas: number
  vendas: number
  taxaConversao: number
}

// Relatório Types
export interface RelatorioData {
  comercial: string
  totalChamadas: number
  tempoMedio: number
  tempoTotal: number
  conversao: number
  leadsTrabalhas: number
  vendas: number
}
