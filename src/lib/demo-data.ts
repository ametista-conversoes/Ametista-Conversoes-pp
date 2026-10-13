import { fetchFriendly } from '@/lib/fetch-friendly'
import { supabase } from '@/lib/supabase'

// Cliente da Edge Function "demo-data" (Fase 50.B) — mesmo padrão de
// src/lib/integrations.ts.
const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/demo-data`

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  return {
    Authorization: `Bearer ${data.session?.access_token ?? ''}`,
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  }
}

export async function recreateDemoData(): Promise<void> {
  const res = await fetchFriendly(`${FUNCTIONS_BASE}/recreate`, {
    method: 'POST',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? 'Não foi possível recriar os dados de demonstração.')
}

export async function removeDemoData(): Promise<void> {
  const res = await fetchFriendly(`${FUNCTIONS_BASE}/remove`, {
    method: 'POST',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? 'Não foi possível remover os dados de demonstração.')
}
