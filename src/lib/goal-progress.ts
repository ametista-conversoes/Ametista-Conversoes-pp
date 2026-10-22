// Ametista Conversões — Fase 54: progresso das Metas SMART.
//
// • Menor é melhor (CPA, CPC, CPM): progresso = meta ÷ atual — no alvo ou
//   abaixo dele é 100%; acima, cai proporcionalmente (meta R$45, atual R$90
//   = 50%). Sem valor atual (0/nulo) = 0%.
// • As demais: atual ÷ meta.
// • Métricas automáticas: o valor atual é recalculado no banco a cada hora
//   (mês corrente) por `refresh_smart_goals_from_ads` (migration-102) —
//   a lista abaixo TEM que bater com a da função.

const LOWER_IS_BETTER = ['cpa', 'cpc', 'cpm']

const AUTO_METRICS = [
  'orcamento',
  'impressoes',
  'cliques',
  'leads',
  'conversoes',
  'cpa',
  'cpc',
  'ctr',
  'cpm',
  'taxa_conversao',
  'faturamento',
  'roas',
  'leads_qualificados',
  'vendas',
]

export function isLowerBetterMetric(metricType: string | null | undefined): boolean {
  return !!metricType && LOWER_IS_BETTER.includes(metricType)
}

export function isAutoGoalMetric(metricType: string | null | undefined): boolean {
  return !!metricType && AUTO_METRICS.includes(metricType)
}

/** Percentual de progresso (arredondado). `capped` limita a 100 (barra); o
 * PDF usa sem limite, de propósito (passar da meta mostra > 100%). */
export function goalProgressPercent(
  metricType: string | null | undefined,
  current: number | null | undefined,
  target: number | null | undefined,
  { capped = true }: { capped?: boolean } = {},
): number {
  const t = target ?? 0
  const c = current ?? 0
  if (t <= 0) return 0
  const raw = isLowerBetterMetric(metricType) ? (c > 0 ? (t / c) * 100 : 0) : (c / t) * 100
  const rounded = Math.round(raw)
  return capped ? Math.min(100, rounded) : rounded
}
