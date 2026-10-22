// Ametista Conversões — Fase 53: valor de uma métrica nas contas de anúncio
// (últimos 30 dias) — usado na coluna "Real (30 dias)" do "Montar funil".
// Mesmas fórmulas do card de Performance (`computeRateMetrics`/
// `computeRevenueFromLeads`). O progresso automático das metas (mês
// corrente) é calculado no banco — migration-102.
import { computeRateMetrics, computeRevenueFromLeads, computeRoas } from './metrics'

export interface AdTotals {
  spend: number
  clicks: number
  impressions: number
  conversions: number
  /** Da ficha do cliente — necessários só pra Faturamento/ROAS (receita
   * estimada = conversões ÷ leads p/ fechar 1 venda × ticket médio). */
  leadsToClose: number | null
  averageTicket: number | null
}

const round2 = (value: number | null) => (value == null ? null : Math.round(value * 100) / 100)

/** `null` quando não dá pra calcular (sem clique/impressão/conversão, ou
 * Faturamento/ROAS sem "Leads p/ fechar 1 venda"/"Ticket médio" na ficha). */
export function adMetricValue(metricType: string | null, totals: AdTotals): number | null {
  const { spend, clicks, impressions, conversions } = totals
  const rates = computeRateMetrics(spend, clicks, impressions, conversions)
  const revenue = computeRevenueFromLeads(conversions, totals.leadsToClose, totals.averageTicket)
  switch (metricType) {
    case 'leads':
    case 'conversoes':
      return conversions
    case 'cliques':
      return clicks
    case 'impressoes':
      return impressions
    case 'cpa':
      return round2(rates.cpa)
    case 'cpc':
      return round2(rates.cpc)
    case 'ctr':
      return round2(rates.ctr)
    case 'cpm':
      return round2(impressions > 0 ? (spend / impressions) * 1000 : null)
    case 'taxa_conversao':
      return round2(rates.conversionRate)
    case 'faturamento':
      return round2(revenue)
    case 'roas':
      return round2(revenue == null ? null : computeRoas(revenue, spend))
    default:
      return null
  }
}
