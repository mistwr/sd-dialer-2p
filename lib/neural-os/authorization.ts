/**
 * Neural OS proof-of-concept contract.
 * No network requests, credentials, database access, or side effects.
 * Production code does not import this module.
 */
export type NeuralRole = 'super_admin' | 'admin' | 'supervisor' | 'parceiro'
export type NeuralCapability =
  | 'lead.read'
  | 'call.read'
  | 'call.start'
  | 'lead.update'
  | 'followup.create'
  | 'agent.configure'

export type NeuralContext = Readonly<{
  userId: string
  companyId: string
  role: NeuralRole
  isSuperAdmin: boolean
  active: boolean
}>

export type NeuralResource = Readonly<{
  companyId: string
  ownerId?: string | null
}>

export type NeuralDecision = Readonly<{
  allowed: boolean
  reason: string
  requiresHumanApproval: boolean
}>

const READ_ONLY = new Set<NeuralCapability>(['lead.read', 'call.read'])

/**
 * Default-deny authorization for an isolated read-only prototype.
 * This is not a replacement for Supabase RLS or API-side authorization.
 */
export function authorizeNeuralAction(
  context: NeuralContext,
  capability: NeuralCapability,
  resource: NeuralResource,
): NeuralDecision {
  if (!context.active || !context.userId || !context.companyId) {
    return { allowed: false, reason: 'inactive_or_missing_identity', requiresHumanApproval: false }
  }
  if (!resource.companyId || resource.companyId !== context.companyId) {
    return { allowed: false, reason: 'company_mismatch', requiresHumanApproval: false }
  }
  if (!READ_ONLY.has(capability)) {
    return { allowed: false, reason: 'write_capability_disabled', requiresHumanApproval: true }
  }
  const privileged = context.isSuperAdmin || ['super_admin', 'admin', 'supervisor'].includes(context.role)
  if (!privileged && resource.ownerId !== context.userId) {
    return { allowed: false, reason: 'resource_not_assigned', requiresHumanApproval: false }
  }
  return { allowed: true, reason: 'read_only_access', requiresHumanApproval: false }
}
