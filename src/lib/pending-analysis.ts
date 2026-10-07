// Ametista Conversões — Fase 48.9: "Análises do Gestor pendentes" em
// Atividades — mesma lógica da função SQL `detect_new_manager_analysis_overdue`
// (migration-089), em JS puro, pra UI e lembrete nunca destoarem:
// "vencida" = já passou mais tempo que a cadência do plano
// (`PLAN_MEETING_CADENCE_DAYS`) desde a ÚLTIMA análise publicada desse
// cliente, ou desde o cadastro, se nunca publicou nenhuma.

import { PLAN_MEETING_CADENCE_DAYS } from './recurrence'

export interface PendingAnalysisClient {
  id: string
  name: string
  plan: string | null
  created_at: string
}

export interface PendingAnalysisRecord {
  client_id: string
  status: string
  published_at: string | null
}

export interface PendingAnalysis {
  clientId: string
  clientName: string
  cadenceDays: number
  daysSinceLastPublished: number
}

export function computePendingAnalyses(
  clients: PendingAnalysisClient[],
  analyses: PendingAnalysisRecord[],
  now: Date = new Date(),
): PendingAnalysis[] {
  const lastPublishedByClient = new Map<string, string>()
  for (const a of analyses) {
    if (a.status !== 'publicada' || !a.published_at) continue
    const existing = lastPublishedByClient.get(a.client_id)
    if (!existing || a.published_at > existing) lastPublishedByClient.set(a.client_id, a.published_at)
  }

  const pending: PendingAnalysis[] = []
  for (const client of clients) {
    const cadenceDays = client.plan ? PLAN_MEETING_CADENCE_DAYS[client.plan] : undefined
    if (!cadenceDays) continue
    const baseline = lastPublishedByClient.get(client.id) ?? client.created_at
    const daysSince = (now.getTime() - new Date(baseline).getTime()) / (24 * 60 * 60 * 1000)
    if (daysSince > cadenceDays) {
      pending.push({ clientId: client.id, clientName: client.name, cadenceDays, daysSinceLastPublished: Math.floor(daysSince) })
    }
  }
  return pending.sort((a, b) => b.daysSinceLastPublished - a.daysSinceLastPublished)
}
