import { createClient } from '@/lib/supabase/client'

// fetch para as APIs que exigem o token da sessão (Authorization: Bearer).
export async function authFetch(url: string, init: RequestInit = {}) {
  const { data: { session } } = await createClient().auth.getSession()
  const headers = new Headers(init.headers || {})
  if (session?.access_token) headers.set('Authorization', 'Bearer ' + session.access_token)
  return fetch(url, { ...init, headers })
}

export const authFetcher = (url: string) => authFetch(url).then(r => r.json())
