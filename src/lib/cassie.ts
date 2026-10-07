import type { CassieMode } from '@/lib/cassie-modes'
import { fetchFriendly } from '@/lib/fetch-friendly'
import { supabase } from '@/lib/supabase'

// Cliente da Edge Function da Cassie (Fase 7.1) — chamado direto via
// fetch (não supabase.functions.invoke), mesmo padrão já usado em
// src/lib/integrations.ts. Nome da função no painel do Supabase é
// "CASSIE" (não "cassie") — é só isso que muda aqui.
const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/CASSIE`

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  return {
    Authorization: `Bearer ${data.session?.access_token ?? ''}`,
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  }
}

interface SendCassieMessageParams {
  clientId: string
  message: string
  mode: CassieMode
}

export async function sendCassieMessage({ clientId, message, mode }: SendCassieMessageParams): Promise<string> {
  const res = await fetchFriendly(`${FUNCTIONS_BASE}/chat`, {
    method: 'POST',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, message, mode }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? 'Não foi possível falar com a Cassie.')
  return body.reply as string
}

interface SendPersuasiveCopyMessageParams {
  clientId: string
  connectionId?: string
  message: string
}

/** Fase 8.4/8.4b ("Comunicação Persuasiva") — chat persistido que pede
 * pra Cassie gerar/ajustar headlines e textos de anúncio a partir das
 * respostas abertas de Google Forms do cliente. */
export async function sendPersuasiveCopyMessage({ clientId, connectionId, message }: SendPersuasiveCopyMessageParams): Promise<string> {
  const res = await fetchFriendly(`${FUNCTIONS_BASE}/persuasive-copy`, {
    method: 'POST',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, connection_id: connectionId, message }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? 'Não foi possível gerar sugestões.')
  return body.reply as string
}

/** Fase 48.10 — formato solto de propósito: as chaves presentes variam
 * por plano/tipo (ver `extraFieldKeysFor` na Edge Function), e o
 * front-end só aplica via form.setValue as chaves que fazem sentido
 * pro formulário aberto no momento, ignorando o resto. */
export interface ManagerAnalysisDraft {
  resumo?: string
  status_geral?: string
  diagnostico?: string
  otimizacoes_realizadas?: string
  proximos_passos?: Array<{ titulo?: string; data?: string | null }>
  pendencias_cliente_texto?: string
  [extraField: string]: unknown
}

interface SuggestManagerAnalysisDraftParams {
  clientId: string
  plan: string
  tipo: string
  periodStart: string
  periodEnd: string
}

/** "Sugerir rascunho" em ManagerAnalysisFormDialog.tsx — rota dedicada
 * (não /chat), resposta de 1 tiro sem histórico persistido. A Cassie só
 * sugere texto; quem decide salvar (e o quê) continua sendo o gestor. */
export async function suggestManagerAnalysisDraft(params: SuggestManagerAnalysisDraftParams): Promise<ManagerAnalysisDraft> {
  const res = await fetchFriendly(`${FUNCTIONS_BASE}/suggest-analysis-draft`, {
    method: 'POST',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: params.clientId,
      plan: params.plan,
      tipo: params.tipo,
      period_start: params.periodStart,
      period_end: params.periodEnd,
    }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? 'Não foi possível gerar a sugestão.')
  return body.draft as ManagerAnalysisDraft
}
