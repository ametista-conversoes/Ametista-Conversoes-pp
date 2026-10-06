import { jsPDF } from 'jspdf'
import type { TrendPoint } from '@/components/charts/PerformanceTrendChart'
import type { ChannelBreakdown } from '@/components/charts/SpendRevenueBarChart'
import type { ClientRecord, SmartGoalRecord } from '@/hooks/useClientPortalData'
import { formatCurrency, formatDate, formatMultiplier, formatNumber, formatPercent } from '@/lib/format'

export interface MonthlyReportPdfData {
  spend: number | null
  revenue: number | null
  monthlyFee: number | null
  roas: number | null
  cpa: number | null
  ctr: number | null
  cpc: number | null
  clicks: number | null
  impressions: number | null
  conversions: number | null
  health_score: number | null
  // Fase 48.2/48.3 — leads/vendas reais do mês (form_responses + manual_leads).
  leads: number | null
  sales: number | null
  costPerLead: number | null
  leadToSaleRate: number | null
}

export interface MonthlyReportPdfOptions {
  /** Datas exatas do período (ISO `YYYY-MM-DD`) — por padrão, o mês
   * inteiro (dia 1 ao último dia). Pro mês em andamento, passar o
   * último dia com dado real em vez do último dia do mês. */
  periodStart?: string
  periodEnd?: string
  /** Mês ainda não fechado oficialmente — marca "(parcial)" no título. */
  isPartial?: boolean
  /** Cliente tem pelo menos 1 projeto ativo do tipo "Leads" — controla
   * se Leads/Custo por lead/Vendas/Taxa lead→venda aparecem. Projeto
   * 100% "Vendas" não passa por etapa de qualificação de lead. */
  showLeadMetrics?: boolean
  /** Mesmos dados do mês anterior, pra coluna "vs. período anterior".
   * `undefined` omite a coluna inteira (sem dado pra comparar, ex:
   * primeiro mês do cliente); `null`/campos `null` mostram "—". */
  previousPeriod?: MonthlyReportPdfData | null
}

const PAGE_BOTTOM = 280

function pctChangeLabel(current: number | null | undefined, previous: number | null | undefined): string {
  if (current == null || previous == null || previous === 0) return '—'
  const pct = ((current - previous) / Math.abs(previous)) * 100
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(0)}%`
}

interface MetricRow {
  label: string
  value: string
  /** Presente só nas métricas que entram na comparação "vs. período
   * anterior" — valor numérico bruto (não formatado) pra calcular a
   * variação %. */
  current?: number | null
  previous?: number | null
}

/** Fase 21.3/21.3b/21.3c/48.3 — monta e baixa o PDF do fechamento
 * mensal, 100% no navegador (jsPDF), sem round-trip de backend. */
export function generateMonthlyReportPdf(
  client: ClientRecord,
  data: MonthlyReportPdfData,
  year: number,
  month: number,
  channelBreakdown: ChannelBreakdown[] = [],
  trendData: TrendPoint[] = [],
  goals: SmartGoalRecord[] = [],
  options: MonthlyReportPdfOptions = {},
) {
  const doc = new jsPDF()
  const isPartial = options.isPartial ?? false
  const showLeadMetrics = options.showLeadMetrics ?? true
  const prev = options.previousPeriod
  const hasComparison = prev !== undefined
  const lastDayOfMonth = new Date(year, month, 0).toISOString().slice(0, 10)
  const firstDayOfMonth = `${year}-${String(month).padStart(2, '0')}-01`
  const periodStart = options.periodStart ?? firstDayOfMonth
  const periodEnd = options.periodEnd ?? lastDayOfMonth

  // Mesma fórmula do FinancialSummaryCard (aba Financeiro) — Resultado
  // estimado desconta a mensalidade da agência, não só o investimento
  // em mídia.
  const totalCost = (data.spend ?? 0) + (data.monthlyFee ?? 0)
  const profit = data.revenue != null ? data.revenue - totalCost : null

  /** Pula pra próxima página se a próxima linha não couber — os
   * blocos do relatório podem crescer bastante (tendência diária,
   * várias metas), então nenhuma seção pode assumir que cabe inteira
   * numa página só. */
  let y = 20
  function ensureSpace(neededHeight: number) {
    if (y + neededHeight > PAGE_BOTTOM) {
      doc.addPage()
      y = 20
    }
  }
  function sectionTitle(title: string) {
    ensureSpace(14)
    doc.setFontSize(13)
    doc.setTextColor(0)
    doc.text(title, 14, y)
    y += 8
    doc.setFontSize(11)
  }

  doc.setFontSize(18)
  doc.text('Ametista Conversões', 14, y)
  y += 7
  doc.setFontSize(12)
  doc.setTextColor(100)
  doc.text(`Relatório mensal${isPartial ? ' (parcial)' : ''} de performance`, 14, y)
  y += 13

  doc.setTextColor(0)
  doc.setFontSize(11)
  doc.text(`Cliente: ${client.name}${client.company ? ` (${client.company})` : ''}`, 14, y)
  y += 7
  doc.text(`Período: ${formatDate(periodStart)} a ${formatDate(periodEnd)}`, 14, y)
  y += 7
  doc.text(`Gerado em: ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date())}`, 14, y)
  y += 14

  const metricRows: MetricRow[] = [
    { label: 'Investimento em mídia', value: formatCurrency(data.spend), current: data.spend, previous: prev?.spend },
    { label: 'Mensalidade da agência', value: formatCurrency(data.monthlyFee) },
    { label: 'Gasto total', value: formatCurrency(totalCost) },
    { label: 'Receita estimada', value: formatCurrency(data.revenue), current: data.revenue, previous: prev?.revenue },
    { label: 'Resultado estimado', value: formatCurrency(profit) },
    { label: 'ROAS', value: formatMultiplier(data.roas), current: data.roas, previous: prev?.roas },
    { label: 'CPA', value: formatCurrency(data.cpa), current: data.cpa, previous: prev?.cpa },
    { label: 'CPC', value: formatCurrency(data.cpc), current: data.cpc, previous: prev?.cpc },
    { label: 'CTR', value: formatPercent(data.ctr), current: data.ctr, previous: prev?.ctr },
    { label: 'Cliques', value: formatNumber(data.clicks) },
    { label: 'Impressões', value: formatNumber(data.impressions) },
    { label: 'Conversões', value: formatNumber(data.conversions), current: data.conversions, previous: prev?.conversions },
    { label: 'Health Score', value: formatNumber(data.health_score) },
  ]
  if (showLeadMetrics) {
    metricRows.push(
      { label: 'Leads', value: formatNumber(data.leads), current: data.leads, previous: prev?.leads },
      { label: 'Custo por lead', value: formatCurrency(data.costPerLead) },
      { label: 'Vendas', value: formatNumber(data.sales), current: data.sales, previous: prev?.sales },
      { label: 'Taxa lead → venda', value: formatPercent(data.leadToSaleRate) },
    )
  }

  sectionTitle('Métricas do mês')
  if (hasComparison) {
    doc.setFontSize(9)
    doc.setTextColor(120)
    doc.text('vs. período anterior', 165, y)
    doc.setFontSize(11)
    doc.setTextColor(0)
    y += 2
  }
  for (const row of metricRows) {
    ensureSpace(8)
    doc.text(row.label, 14, y)
    doc.text(row.value, 100, y)
    if (hasComparison && row.current !== undefined) {
      doc.text(pctChangeLabel(row.current, row.previous), 165, y)
    }
    y += 8
  }

  y += 2
  doc.setFontSize(8)
  doc.setTextColor(130)
  const footnoteLines = doc.splitTextToSize(
    'Receita estimada é calculada a partir de Leads reais × Ticket Médio informado pelo cliente (ou direto por ' +
      'Conversões × Ticket Médio, quando o projeto é do tipo "Vendas") — não é um valor de venda confirmado, exceto ' +
      'quando o projeto rastreia valor de conversão real. Resultado estimado = Receita estimada − Gasto total.',
    180,
  )
  doc.text(footnoteLines, 14, y)
  y += footnoteLines.length * 4 + 6
  doc.setFontSize(11)
  doc.setTextColor(0)

  if (channelBreakdown.length > 0) {
    y += 2
    sectionTitle('Investimento vs. Receita por canal')
    doc.setFontSize(9)
    doc.text('Canal', 14, y)
    doc.text('Investimento', 55, y)
    doc.text('Receita (estimada)', 95, y)
    doc.text('Conversões', 145, y)
    doc.text('CPA', 175, y)
    doc.setFontSize(11)
    y += 6
    for (const row of channelBreakdown) {
      ensureSpace(7)
      doc.text(row.channel, 14, y)
      doc.text(formatCurrency(row.investimento), 55, y)
      doc.text(formatCurrency(row.receita), 95, y)
      doc.text(row.conversoes != null ? formatNumber(row.conversoes) : '—', 145, y)
      doc.text(row.cpa != null ? formatCurrency(row.cpa) : '—', 175, y)
      y += 7
    }
  }

  if (trendData.length > 0) {
    y += 6
    sectionTitle('Tendência diária do mês')
    doc.text('Data', 14, y)
    doc.text('Investimento', 90, y)
    doc.text('Receita', 140, y)
    y += 6
    for (const point of trendData) {
      ensureSpace(7)
      doc.text(formatDate(point.date), 14, y)
      doc.text(formatCurrency(point.investimento), 90, y)
      doc.text(formatCurrency(point.receita), 140, y)
      y += 7
    }
  }

  if (goals.length > 0) {
    y += 6
    sectionTitle('Metas — probabilidade de cumprimento')
    for (const goal of goals) {
      ensureSpace(8)
      const target = goal.target_value ?? 0
      const current = goal.current_value ?? 0
      // Fase 21.3c, a pedido do usuário: (já feito ÷ meta) × 100, sem
      // limitar em 100% — passar da meta mostra mais de 100% de
      // propósito, diferente da barra de progresso na tela (essa sim
      // limitada visualmente a 100%, já que é uma barra).
      const probability = target > 0 ? (current / target) * 100 : 0
      doc.text(`${goal.title} — ${current} de ${target}`, 14, y)
      doc.text(`${probability.toFixed(0)}%`, 170, y)
      y += 8
    }
  }

  const fileClientName = client.name.trim().replace(/\s+/g, '-').toLowerCase()
  doc.save(`relatorio-${fileClientName}-${year}-${String(month).padStart(2, '0')}.pdf`)
}
