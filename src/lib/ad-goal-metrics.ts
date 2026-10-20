// Ametista Conversões — Fase 53: Metas SMART com o valor real das contas
// de anúncio ao lado do valor atual (últimos 30 dias). Só SUGESTÃO — o
// valor atual da meta continua 100% manual e só muda quando o gestor
// clica em "Usar" no diálogo de progresso. Mesmas fórmulas do card de
// Performance (`computeRateMetrics`/`computeRevenueFromLeads`), pra o
// número nunca destoar do resto do app.
import { computeRateMetrics, computeRevenueFromLeads, computeRoas } from './metrics'
import { smartGoalMetricLabels } from './status-styles'

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

const AD_METRIC_TYPES = [
  'leads',
  'conversoes',
  'cliques',
  'impressoes',
  'cpa',
  'cpc',
  'ctr',
  'cpm',
  'taxa_conversao',
  'faturamento',
  'roas',
]

export function isAdMetric(metricType: string | null): boolean {
  return !!metricType && AD_METRIC_TYPES.includes(metricType)
}

/** `null` quando o metric_type não tem equivalente nas contas de anúncio.
 * "Leads" (Fase 37, Bloco 2) mantém o rótulo próprio: é a conversão que o
 * pixel/tag rastreia, número por natureza diferente de "respondeu meu
 * Google Forms" (mostrado separado, nunca somado). */
export function adMetricLabel(metricType: string | null): string | null {
  if (!isAdMetric(metricType)) return null
  if (metricType === 'leads') return 'Conversões rastreadas pelo pixel/tag do Google/Meta Ads (últimos 30 dias)'
  const label = smartGoalMetricLabels[metricType as string]
  if (metricType === 'faturamento' || metricType === 'roas') {
    return `${label} nas contas de anúncio (últimos 30 dias, receita estimada pela ficha do cliente)`
  }
  return `${label} nas contas de anúncio (últimos 30 dias)`
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
