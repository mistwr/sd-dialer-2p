export type VoiceLead = {
  id: string
  nome: string
  telefone: string
  status: string
  assigned_to?: string | null
}

export type VoiceSeller = {
  id: string
  company_id: string | null
  full_name: string
  role: string
  status: string
  supervisor_id?: string | null
  created_by?: string | null
  restricted_admin?: boolean
}

export function canViewVoiceSeller(actor: VoiceSeller, seller: VoiceSeller) {
  if (!actor.company_id || actor.status !== 'active' || actor.company_id !== seller.company_id) return false
  if (seller.status !== 'active') return false
  if (actor.id === seller.id) return true
  if (actor.role === 'admin' && !actor.restricted_admin) return true
  if (actor.role !== 'supervisor' && actor.role !== 'admin') return false
  return seller.role === 'parceiro' && (
    seller.supervisor_id === actor.id || (!seller.supervisor_id && seller.created_by === actor.id)
  )
}

export const VOICE_BLOCKED_STATUSES = ['vendido', 'nao_interessado', 'desligado', 'numero_errado', 'numero_nao_atribuido', 'pertence_outra_pessoa']

// PostgREST OR expressions must never receive user-supplied syntax.
export function voiceLeadSearch(value: string) {
  return value.replace(/[^\p{L}\p{N}\s+@.-]/gu, '').trim().slice(0, 80)
}
