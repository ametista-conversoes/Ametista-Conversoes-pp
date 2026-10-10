// Ametista Conversões — Fase 48.4: limites de criativos/alterações por
// mês, por plano — hoje só documentados como texto solto em
// `supabase/checklist-meta-google-validacao.md`. Usado no bloco
// "Otimizações realizadas" da Análise do Gestor (Fase 48.6) pra
// comparar o uso real do mês contra o limite contratado.

export type PlanKey = 'validacao' | 'escala' | 'dominacao'

export interface PlanLimits {
  alteracoesPorMes: number
  criativosPorMes: number
  /** Anexo I do contrato — limite contratual, só informativo (o app não
   * conta anúncios ativos de verdade, exigiria somar status ao vivo do
   * Meta/Google por cliente). */
  anunciosAtivos: number
}

export const PLAN_LIMITS: Record<PlanKey, PlanLimits> = {
  validacao: { alteracoesPorMes: 4, criativosPorMes: 6, anunciosAtivos: 15 },
  escala: { alteracoesPorMes: 8, criativosPorMes: 10, anunciosAtivos: 25 },
  dominacao: { alteracoesPorMes: 12, criativosPorMes: 15, anunciosAtivos: 40 },
}

export function planLimitsFor(plan: string | null): PlanLimits | null {
  if (plan === 'validacao' || plan === 'escala' || plan === 'dominacao') return PLAN_LIMITS[plan]
  return null
}
