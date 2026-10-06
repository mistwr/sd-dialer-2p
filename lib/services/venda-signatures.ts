import 'server-only'

import { createHash, randomBytes } from 'node:crypto'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient as createSessionClient } from '@/lib/supabase/server'

export const SIGNATURE_BUCKET = 'venda-assinaturas'
export const SIGNATURE_MAX_FILE_SIZE = 10 * 1024 * 1024
export const SIGNATURE_MAX_FILES = 6
export const SIGNATURE_MIME_EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
}
export const SIGNATURE_DOCUMENT_TYPES = new Set([
  'identificacao',
  'comprovativo_morada',
  'fatura',
  'outro',
])

export function createSignatureToken() {
  return randomBytes(32).toString('base64url')
}

export function hashSignatureToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function getSignatureAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Configuração segura do Supabase em falta.')
  return createServiceClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function getSignatureUser() {
  const supabase = await createSessionClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

export async function canManageSignatureSale(
  admin: ReturnType<typeof getSignatureAdminClient>,
  userId: string,
  sale: { seller_id: string; company_id: string | null },
) {
  if (sale.seller_id === userId) return true

  const { data: actor, error } = await admin
    .from('usuarios')
    .select('role, company_id, is_super_admin')
    .eq('id', userId)
    .maybeSingle()

  if (error || !actor) return false
  if (actor.is_super_admin) return true
  return actor.company_id === sale.company_id &&
    (actor.role === 'admin' || actor.role === 'supervisor')
}

export function sanitizeSignatureFileName(value: unknown) {
  if (typeof value !== 'string') return 'documento'
  const cleaned = value.trim().replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 120)
  return cleaned || 'documento'
}

export function privateNoStoreHeaders() {
  return { 'Cache-Control': 'private, no-store, max-age=0' }
}
