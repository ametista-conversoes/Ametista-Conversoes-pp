// Ametista Conversões — Fase 53: funil reverso (Impressões → Cliques →
// Leads → Leads Qualificados → Vendas) calculado de trás pra frente a partir
// da verba OU da meta de vendas. O funil não tem tabela própria: cada etapa
// vira (ou atualiza) uma meta SMART do cliente — ver `FUNNEL_GOAL_METRICS`.
import { formatCurrency, formatMultiplier, formatNumber, formatPercent } from './format'
import { computeRevenueFromLeads, computeRoas } from './metrics'

export type FunnelMode = 'verba' | 'vendas'

export interface FunnelInputs {
  mode: FunnelMode
  /** Verba mensal de mídia (R$) — usada no modo "verba". */
  budget: number | null
  /** Vendas no mês — usada no modo "vendas". */
  salesGoal: number | null
  cpa: number
  /** Percentuais (ex: 2 = 2%). */
  ctr: number
  conversionRate: number
  qualificationRate: number
  leadsToClose: number | null
  averageTicket: number | null
}

export interface FunnelResult {
  budget: number
  impressions: number
  clicks: number
  leads: number
  qualifiedLeads: number
  sales: number | null
  revenue: number | null
  roas: number | null
  /** CPC que o funil pressupõe (verba ÷ cliques = CPA × taxa de conversão). */
  impliedCpc: number
}

const round2 = (value: number) => Math.round(value * 100) / 100

/** `null` quando falta algum dado essencial (taxa zerada, verba/meta vazia,
 * modo "vendas" sem "Leads p/ fechar 1 venda"). */
export function computeFunnel(inputs: FunnelInputs): FunnelResult | null {
  const { mode, cpa, ctr, conversionRate, qualificationRate, leadsToClose, averageTicket } = inputs
  if (!(cpa > 0) || !(ctr > 0) || !(conversionRate > 0) || qualificationRate < 0) return null

  let leads: number
  let budget: number
  let sales: number | null
  if (mode === 'verba') {
    if (!inputs.budget || inputs.budget <= 0) return null
    budget = inputs.budget
    leads = budget / cpa
    sales = leadsToClose && leadsToClose > 0 ? leads / leadsToClose : null
  } else {
    if (!inputs.salesGoal || inputs.salesGoal <= 0 || !leadsToClose || leadsToClose <= 0) return null
    sales = inputs.salesGoal
    leads = sales * leadsToClose
    budget = leads * cpa
  }

  const clicks = leads / (conversionRate / 100)
  const impressions = clicks / (ctr / 100)
  const revenue = computeRevenueFromLeads(leads, leadsToClose, averageTicket)
  const roas = revenue == null ? null : computeRoas(revenue, budget)

  return {
    budget: round2(budget),
    impressions: Math.round(impressions),
    clicks: Math.round(clicks),
    leads: Math.round(leads),
    qualifiedLeads: Math.round(leads * (qualificationRate / 100)),
    sales: sales == null ? null : Math.round(sales * 10) / 10,
    revenue: revenue == null ? null : round2(revenue),
    roas: roas == null ? null : round2(roas),
    impliedCpc: round2(budget / clicks),
  }
}

/** Taxa de conversão (%) que o CPA-alvo exige com o CPC real — `null` sem
 * CPC real. Usada no aviso de coerência: se for maior que a taxa digitada,
 * o CPA-alvo não fecha com o leilão atual. */
export function requiredConversionRate(cpa: number, realCpc: number | null): number | null {
  if (realCpc == null || !(cpa > 0)) return null
  return round2((realCpc / cpa) * 100)
}

/** Ordem em que as metas do funil aparecem/são salvas. */
export const FUNNEL_GOAL_METRICS = [
  'orcamento',
  'impressoes',
  'cliques',
  'leads',
  'leads_qualificados',
  'vendas',
  'cpa',
  'ctr',
  'taxa_conversao',
  'faturamento',
  'roas',
] as const

export type FunnelGoalMetric = (typeof FUNNEL_GOAL_METRICS)[number]

/** Valor-alvo de cada meta a partir do funil calculado + entradas. */
export function funnelGoalTargets(inputs: FunnelInputs, result: FunnelResult): Record<FunnelGoalMetric, number | null> {
  return {
    orcamento: result.budget,
    impressoes: result.impressions,
    cliques: result.clicks,
    leads: result.leads,
    leads_qualificados: result.qualifiedLeads,
    vendas: result.sales,
    cpa: inputs.cpa,
    ctr: inputs.ctr,
    taxa_conversao: inputs.conversionRate,
    faturamento: result.revenue,
    roas: result.roas,
  }
}

/** Formato de exibição de cada meta do funil. */
export function formatFunnelValue(metric: string, value: number | null | undefined): string {
  if (metric === 'orcamento' || metric === 'cpa' || metric === 'faturamento') return formatCurrency(value)
  if (metric === 'ctr' || metric === 'taxa_conversao') return formatPercent(value)
  if (metric === 'roas') return formatMultiplier(value)
  return formatNumber(value)
}

/** Último dia do mês corrente (YYYY-MM-DD) — prazo padrão das metas do funil. */
export function endOfMonthIso(today: string): string {
  const [year, month] = today.split('-').map(Number)
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${today.slice(0, 7)}-${String(last).padStart(2, '0')}`
}
