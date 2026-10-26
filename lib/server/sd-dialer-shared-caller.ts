import type { SupabaseClient } from '@supabase/supabase-js'

export async function resolveSharedCallerId(
  admin: SupabaseClient,
  userId: string,
  companyId: string,
  configuredPhone: string,
  now = Date.now(),
): Promise<string> {
  if (!configuredPhone) return ''
  const { data, error } = await admin
    .from('voice_call_subscriptions')
    .select('user_id,company_id,use_system_caller_id,status,expires_at')
    .eq('user_id', userId)
    .eq('company_id', companyId)
    .maybeSingle()
  if (error) throw new Error('Não foi possível consultar a autorização do número de saída.')
  if (
    !data || data.user_id !== userId || data.company_id !== companyId ||
    data.use_system_caller_id !== true || data.status !== 'active' ||
    !(new Date(data.expires_at).getTime() > now)
  ) return ''
  return configuredPhone
}
