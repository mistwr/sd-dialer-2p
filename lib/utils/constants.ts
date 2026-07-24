/**
 * SD Dialer - Constants
 * Constantes globais do projeto
 */

// Roles e Permissões
export const USER_ROLES = {
  ADMIN: 'admin',
  SUPERVISOR: 'supervisor',
  COMERCIAL: 'comercial',
} as const

export const ROLE_LABELS = {
  admin: 'Administrador',
  supervisor: 'Supervisor',
  comercial: 'Comercial',
} as const

// Lead Status
export const LEAD_STATUS = {
  NEW: 'new',
  CONTACTADO: 'contactado',
  VENDIDO: 'vendido',
  NAO_INTERESSADO: 'nao_interessado',
  AGENDAR: 'agendar',
  OUTRAS: 'outras',
} as const

export const LEAD_STATUS_LABELS = {
  new: 'Novo',
  contactado: 'Contactado',
  vendido: 'Vendido',
  nao_interessado: 'Não Interessado',
  agendar: 'Agendar',
  outras: 'Outras',
} as const

export const LEAD_STATUS_COLORS = {
  new: 'bg-blue-100 text-blue-800',
  contactado: 'bg-yellow-100 text-yellow-800',
  vendido: 'bg-green-100 text-green-800',
  nao_interessado: 'bg-red-100 text-red-800',
  agendar: 'bg-purple-100 text-purple-800',
  outras: 'bg-gray-100 text-gray-800',
} as const

// Call Results
export const CALL_RESULTS = {
  VENDA: 'venda',
  NAO_INTERESSADO: 'nao_interessado',
  NAO_ATENDE: 'nao_atende',
  NUMERO_ERRADO: 'numero_errado',
  LIGAR_DEPOIS: 'ligar_depois',
  CLIENTE_ADERIU: 'cliente_aderiu',
  SEM_COBERTURA: 'sem_cobertura',
  OUTRO: 'outro',
} as const

export const CALL_RESULTS_LABELS = {
  venda: 'Venda',
  nao_interessado: 'Não Interessado',
  nao_atende: 'Não Atende',
  numero_errado: 'Número Errado',
  ligar_depois: 'Ligar Depois',
  cliente_aderiu: 'Cliente Já Aderiu',
  sem_cobertura: 'Sem Cobertura',
  outro: 'Outro',
} as const

// Campaign Status
export const CAMPAIGN_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
} as const

export const CAMPAIGN_STATUS_LABELS = {
  draft: 'Rascunho',
  active: 'Ativa',
  paused: 'Pausada',
  completed: 'Concluída',
} as const

// Distribution Types
export const DISTRIBUTION_TYPES = {
  MANUAL: 'manual',
  AUTOMATIC: 'automatic',
  BY_TEAM: 'by_team',
  BY_PERCENTAGE: 'by_percentage',
} as const

export const DISTRIBUTION_TYPES_LABELS = {
  manual: 'Manual',
  automatic: 'Automática',
  by_team: 'Por Equipa',
  by_percentage: 'Por Percentagem',
} as const

// Notificação Types
export const NOTIFICATION_TYPES = {
  NEW_LEAD: 'new_lead',
  FOLLOW_UP_REMINDER: 'follow_up_reminder',
  OBJECTIVE_REACHED: 'objective_reached',
  ASSIGNMENT: 'assignment',
} as const

export const NOTIFICATION_LABELS = {
  new_lead: 'Nova Lead',
  follow_up_reminder: 'Lembrete Follow-up',
  objective_reached: 'Objectivo Atingido',
  assignment: 'Atribuição',
} as const

// Operadores Móveis (Portugal)
export const MOBILE_OPERATORS = {
  MEO: { name: 'MEO', prefix: '21' },
  VODAFONE: { name: 'Vodafone', prefix: '91' },
  MOVER: { name: 'Mover', prefix: '92' },
  NOS: { name: 'NOS', prefix: '93' },
} as const

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  OPTIONS: [10, 25, 50, 100],
} as const

// Timer
export const TIMER_STORAGE_KEY = 'sd_dialer_call_timer'
export const TIMER_COMPANY_KEY = (companyId: string) => `sd_dialer_timer_${companyId}`

// API
export const API_TIMEOUT = 30000 // 30 seconds

// Subscription Plans
export const SUBSCRIPTION_PLANS = {
  FREE: { name: 'free', maxUsers: 5, maxLeads: 1000 },
  BASIC: { name: 'basic', maxUsers: 20, maxLeads: 10000 },
  PRO: { name: 'pro', maxUsers: 100, maxLeads: 100000 },
  ENTERPRISE: { name: 'enterprise', maxUsers: 999, maxLeads: 999999 },
} as const

// Routes
export const PUBLIC_ROUTES = ['/', '/login', '/signup', '/callback']

export const PROTECTED_ROUTES = {
  ADMIN: '/dashboard/admin',
  SUPERVISOR: '/dashboard/supervisor',
  COMERCIAL: '/dashboard/comercial',
} as const

// Email
export const EMAIL_FROM = 'noreply@sddialer.com'
