// Ametista Conversões — Fase 35, Parte 2 (Fechamento do Loop de Venda):
// pequeno helper compartilhado entre SmartGoalCard e
// UpdateGoalProgressDialog pra não duplicar o "qual contagem de lead
// esse metric_type representa" nos dois lugares.

export interface LeadStatusCounts {
  qualificados: number
  vendas: number
  /** Total de respostas de formulário, qualquer status (inclusive
   * "Novo"/"Perdido") — volume bruto, nada validado. */
  total: number
}

const LEAD_COUNT_METRIC_TYPES = ['leads', 'leads_qualificados', 'vendas']

/** Verdadeiro só pros 3 metric_types que têm uma contagem real por trás
 * (alimentada pelo status de cada resposta de formulário) — os outros
 * (CPA, ROAS, Faturamento, etc.) são sempre 100% manuais. */
export function isLeadCountMetric(metricType: string | null): boolean {
  return !!metricType && LEAD_COUNT_METRIC_TYPES.includes(metricType)
}

/** `null` quando o metric_type da meta não é nenhum dos 3 alimentados
 * por status de lead — nesse caso não faz sentido mostrar sugestão
 * nenhuma. "Leads" (bruto) conta QUALQUER resposta recebida, sem
 * validação nenhuma — bem diferente de "Leads Qualificados"/"Vendas",
 * que só contam quem o gestor/cliente de fato marcou como
 * qualificado/vendido em cada resposta. */
export function leadCountForMetric(metricType: string | null, counts: LeadStatusCounts | undefined): number | null {
  if (!counts) return null
  if (metricType === 'leads') return counts.total
  if (metricType === 'leads_qualificados') return counts.qualificados
  if (metricType === 'vendas') return counts.vendas
  return null
}

/** Rótulo da contagem real mostrada ao lado do valor atual — a métrica
 * "Leads" (bruta) precisa de um aviso explícito de que é só volume de
 * respostas recebidas, NÃO validado, pra não ser mal interpretada como
 * lead de verdade (pedido do usuário: essa distinção precisa ficar
 * visível pra quem for usar o número, senão o cliente pode achar que
 * preencher o formulário já conta como lead qualificado). */
export function leadCountLabel(metricType: string | null): string {
  if (metricType === 'leads') return 'Respostas de formulário recebidas (bruto, sem validação)'
  return 'Contagem real nas respostas de formulário'
}
