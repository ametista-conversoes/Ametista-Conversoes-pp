import { jsPDF } from 'jspdf'
import type { TrendPoint } from '@/components/charts/PerformanceTrendChart'
import type { ChannelBreakdown } from '@/components/charts/SpendRevenueBarChart'
import type { ClientRecord, ManagerAnalysisRecord, SmartGoalRecord } from '@/hooks/useClientPortalData'
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
  /** Análise do Gestor publicada que cobre esse período, se houver —
   * a seção só aparece quando existe uma (Fase 48.8). */
  managerAnalysis?: ManagerAnalysisRecord | null
}

// Fase 48.12 — identidade visual do PDF: tons derivados da paleta do
// app (CLAUDE.md), adaptados pra um documento impresso em fundo
// branco (o tema escuro do produto não faz sentido num PDF pra
// imprimir/anexar em e-mail). Mesmos limiares de cor de Health Score
// (`getHealthScoreColor`, status-styles.ts) e de status geral da
// Análise do Gestor, só que em RGB pro jsPDF.
const COLOR_PURPLE: [number, number, number] = [124, 58, 237] // #7C3AED, primary do design system
const COLOR_GRAY_BG: [number, number, number] = [247, 247, 250]
const COLOR_GRAY_LINE: [number, number, number] = [228, 228, 233]
const COLOR_GRAY_TEXT: [number, number, number] = [110, 110, 116]
const COLOR_TEXT: [number, number, number] = [28, 28, 32]
const COLOR_RED: [number, number, number] = [220, 38, 38]
const COLOR_AMBER: [number, number, number] = [202, 138, 4]
const COLOR_GREEN: [number, number, number] = [5, 150, 105]

const MARGIN_X = 14
const CONTENT_RIGHT = 196
const CONTENT_WIDTH = CONTENT_RIGHT - MARGIN_X
const PAGE_BOTTOM = 280
const FOOTER_RULE_Y = 288
const FOOTER_TEXT_Y = 293

export function pctChangeLabel(current: number | null | undefined, previous: number | null | undefined): string {
  if (current == null || previous == null || previous === 0) return '—'
  const pct = ((current - previous) / Math.abs(previous)) * 100
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(0)}%`
}

function pctChangeColor(label: string): [number, number, number] {
  if (label.startsWith('+')) return COLOR_GREEN
  if (label.startsWith('-')) return COLOR_RED
  return COLOR_GRAY_TEXT
}

/** Mesmos limiares de `getHealthScoreColor` (status-styles.ts). */
function healthScoreColor(score: number | null): [number, number, number] {
  if (score == null) return COLOR_TEXT
  if (score < 50) return COLOR_RED
  if (score < 70) return COLOR_AMBER
  return COLOR_GREEN
}

const STATUS_GERAL_COLORS: Record<string, [number, number, number]> = {
  no_alvo: COLOR_GREEN,
  atencao: COLOR_AMBER,
  fora_do_alvo: COLOR_RED,
}
const STATUS_GERAL_LABELS: Record<string, string> = {
  no_alvo: 'No alvo',
  atencao: 'Atenção',
  fora_do_alvo: 'Fora do alvo',
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

/** Fase 21.3/21.3b/21.3c/48.3/48.12 — monta e baixa o PDF do
 * fechamento mensal, 100% no navegador (jsPDF), sem round-trip de
 * backend. */
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
  function resetBodyStyle() {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10.5)
    doc.setTextColor(...COLOR_TEXT)
  }
  function sectionTitle(title: string) {
    ensureSpace(18)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12.5)
    doc.setTextColor(...COLOR_PURPLE)
    doc.text(title, MARGIN_X, y)
    y += 3
    doc.setDrawColor(...COLOR_GRAY_LINE)
    doc.setLineWidth(0.4)
    doc.line(MARGIN_X, y, CONTENT_RIGHT, y)
    y += 7
    resetBodyStyle()
  }
  /** Linha de cabeçalho de tabela (rótulos em maiúsculas, cinza,
   * seguidos de uma régua fina) — mesmo padrão em todas as tabelas do
   * relatório (Métricas/Canal/Tendência/Metas). */
  function tableHeader(columns: Array<{ label: string; x: number; align?: 'left' | 'right' }>) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...COLOR_GRAY_TEXT)
    for (const col of columns) {
      doc.text(col.label, col.x, y, col.align ? { align: col.align } : undefined)
    }
    y += 2
    doc.setDrawColor(...COLOR_GRAY_LINE)
    doc.setLineWidth(0.3)
    doc.line(MARGIN_X, y, CONTENT_RIGHT, y)
    y += 6
    resetBodyStyle()
  }
  /** Fundo listrado (zebra) de uma linha de tabela — chamar ANTES de
   * desenhar o texto da linha, com o `y` já na posição da linha. */
  function zebraRow(index: number, rowHeight: number, baselineOffset: number) {
    if (index % 2 !== 0) return
    doc.setFillColor(...COLOR_GRAY_BG)
    doc.rect(MARGIN_X, y - baselineOffset, CONTENT_WIDTH, rowHeight, 'F')
  }

  // ---- Cabeçalho ----
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...COLOR_PURPLE)
  doc.text('Ametista Conversões', MARGIN_X, y)
  y += 7
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11.5)
  doc.setTextColor(...COLOR_GRAY_TEXT)
  doc.text(`Relatório mensal${isPartial ? ' (parcial)' : ''} de performance`, MARGIN_X, y)
  y += 5
  doc.setDrawColor(...COLOR_PURPLE)
  doc.setLineWidth(0.8)
  doc.line(MARGIN_X, y, CONTENT_RIGHT, y)
  y += 9

  // ---- Cartão de identificação (cliente/período/geração) ----
  const infoLines = [
    `Cliente: ${client.name}${client.company ? ` (${client.company})` : ''}`,
    `Período: ${formatDate(periodStart)} a ${formatDate(periodEnd)}`,
    `Gerado em: ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date())}`,
  ]
  const infoBoxTop = y
  const infoBoxHeight = infoLines.length * 6.5 + 7
  doc.setFillColor(...COLOR_GRAY_BG)
  doc.roundedRect(MARGIN_X, infoBoxTop, CONTENT_WIDTH, infoBoxHeight, 2, 2, 'F')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10.5)
  doc.setTextColor(...COLOR_TEXT)
  let infoY = infoBoxTop + 7.5
  for (const line of infoLines) {
    doc.text(line, MARGIN_X + 5, infoY)
    infoY += 6.5
  }
  y = infoBoxTop + infoBoxHeight + 10
  resetBodyStyle()

  // ---- Métricas do mês ----
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
      // "→" sai corrompido ("!'") nas fontes padrão do jsPDF (WinAnsi,
      // sem esse glifo) — troca só aqui pro PDF; a tela usa o label com
      // seta normal (renderiza bem em HTML/CSS).
      { label: 'Taxa lead -> venda', value: formatPercent(data.leadToSaleRate) },
    )
  }

  sectionTitle('Métricas do mês')
  tableHeader([
    { label: 'MÉTRICA', x: MARGIN_X },
    { label: 'VALOR', x: 100 },
    ...(hasComparison ? [{ label: 'VS. ANTERIOR', x: 165 }] : []),
  ])
  metricRows.forEach((row, i) => {
    ensureSpace(8)
    zebraRow(i, 7.5, 5.3)
    doc.setTextColor(...COLOR_TEXT)
    doc.text(row.label, MARGIN_X + 2, y)
    if (row.label === 'Health Score' && data.health_score != null) {
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...healthScoreColor(data.health_score))
    }
    doc.text(row.value, 100, y)
    resetBodyStyle()
    if (hasComparison && row.current !== undefined) {
      const label = pctChangeLabel(row.current, row.previous)
      doc.setTextColor(...pctChangeColor(label))
      doc.text(label, 165, y)
      doc.setTextColor(...COLOR_TEXT)
    }
    y += 8
  })

  y += 3
  ensureSpace(20)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8.5)
  doc.setTextColor(...COLOR_GRAY_TEXT)
  const footnoteLines = doc.splitTextToSize(
    'Receita estimada é calculada a partir de Leads reais × Ticket Médio informado pelo cliente (ou direto por ' +
      'Conversões × Ticket Médio, quando o projeto é do tipo "Vendas") — não é um valor de venda confirmado, exceto ' +
      // "−" (sinal de menos tipográfico) também sai corrompido no PDF —
      // hífen normal em vez disso.
      'quando o projeto rastreia valor de conversão real. Resultado estimado = Receita estimada - Gasto total.',
    CONTENT_WIDTH,
  )
  doc.text(footnoteLines, MARGIN_X, y)
  y += footnoteLines.length * 4 + 7
  resetBodyStyle()

  // ---- Investimento vs. Receita por canal ----
  if (channelBreakdown.length > 0) {
    y += 2
    sectionTitle('Investimento vs. Receita por canal')
    tableHeader([
      { label: 'CANAL', x: MARGIN_X },
      { label: 'INVESTIMENTO', x: 55 },
      { label: 'RECEITA (EST.)', x: 95 },
      { label: 'CONVERSÕES', x: 145 },
      { label: 'CPA', x: 175 },
    ])
    doc.setFontSize(9.5)
    channelBreakdown.forEach((row, i) => {
      ensureSpace(7)
      zebraRow(i, 6.8, 4.8)
      doc.setTextColor(...COLOR_TEXT)
      doc.text(row.channel, MARGIN_X + 2, y)
      doc.text(formatCurrency(row.investimento), 55, y)
      doc.text(formatCurrency(row.receita), 95, y)
      doc.text(row.conversoes != null ? formatNumber(row.conversoes) : '—', 145, y)
      doc.text(row.cpa != null ? formatCurrency(row.cpa) : '—', 175, y)
      y += 7
    })
    resetBodyStyle()
  }

  // ---- Tendência diária do mês ----
  if (trendData.length > 0) {
    y += 6
    sectionTitle('Tendência diária do mês')
    tableHeader([
      { label: 'DATA', x: MARGIN_X },
      { label: 'INVESTIMENTO', x: 90 },
      { label: 'RECEITA', x: 140 },
    ])
    doc.setFontSize(9.5)
    trendData.forEach((point, i) => {
      ensureSpace(7)
      zebraRow(i, 6.8, 4.8)
      doc.setTextColor(...COLOR_TEXT)
      doc.text(formatDate(point.date), MARGIN_X + 2, y)
      doc.text(formatCurrency(point.investimento), 90, y)
      doc.text(formatCurrency(point.receita), 140, y)
      y += 7
    })
    resetBodyStyle()
  }

  // ---- Metas — probabilidade de cumprimento ----
  if (goals.length > 0) {
    y += 6
    sectionTitle('Metas — probabilidade de cumprimento')
    tableHeader([
      { label: 'META', x: MARGIN_X },
      { label: 'PROGRESSO', x: CONTENT_RIGHT, align: 'right' },
    ])
    goals.forEach((goal, i) => {
      ensureSpace(8)
      zebraRow(i, 7.5, 5.3)
      const target = goal.target_value ?? 0
      const current = goal.current_value ?? 0
      // Fase 21.3c, a pedido do usuário: (já feito ÷ meta) × 100, sem
      // limitar em 100% — passar da meta mostra mais de 100% de
      // propósito, diferente da barra de progresso na tela (essa sim
      // limitada visualmente a 100%, já que é uma barra).
      const probability = target > 0 ? (current / target) * 100 : 0
      doc.setTextColor(...COLOR_TEXT)
      doc.text(`${goal.title} — ${current} de ${target}`, MARGIN_X + 2, y)
      doc.setFont('helvetica', 'bold')
      doc.text(`${probability.toFixed(0)}%`, CONTENT_RIGHT, y, { align: 'right' })
      resetBodyStyle()
      y += 8
    })
  }

  // ---- Análise do Gestor (Fase 48.8) ----
  const managerAnalysis = options.managerAnalysis
  if (managerAnalysis) {
    y += 6
    sectionTitle('Análise do Gestor')

    if (managerAnalysis.resumo) {
      const wrapped = doc.splitTextToSize(managerAnalysis.resumo, CONTENT_WIDTH)
      ensureSpace(wrapped.length * 6 + 2)
      doc.text(wrapped, MARGIN_X, y)
      y += wrapped.length * 6 + 5
    }

    if (managerAnalysis.status_geral) {
      ensureSpace(9)
      const color = STATUS_GERAL_COLORS[managerAnalysis.status_geral] ?? COLOR_TEXT
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...color)
      doc.text(`Status geral: ${STATUS_GERAL_LABELS[managerAnalysis.status_geral] ?? managerAnalysis.status_geral}`, MARGIN_X, y)
      resetBodyStyle()
      y += 9
    }

    const labeledBlocks: Array<[string, string | null]> = [
      ['Diagnóstico', managerAnalysis.diagnostico],
      ['Otimizações realizadas', managerAnalysis.otimizacoes_realizadas],
    ]
    for (const [label, text] of labeledBlocks) {
      if (!text) continue
      ensureSpace(8)
      doc.setFont('helvetica', 'bold')
      doc.text(`${label}:`, MARGIN_X, y)
      y += 6
      doc.setFont('helvetica', 'normal')
      const wrapped = doc.splitTextToSize(text, CONTENT_WIDTH)
      ensureSpace(wrapped.length * 6)
      doc.text(wrapped, MARGIN_X, y)
      y += wrapped.length * 6 + 5
    }

    if (managerAnalysis.proximos_passos.length > 0) {
      ensureSpace(8)
      doc.setFont('helvetica', 'bold')
      doc.text('Próximos passos:', MARGIN_X, y)
      y += 7
      doc.setFont('helvetica', 'normal')
      for (const passo of managerAnalysis.proximos_passos) {
        ensureSpace(6)
        doc.text(`•  ${passo.titulo}${passo.data ? ` (${formatDate(passo.data)})` : ''}`, MARGIN_X + 4, y)
        y += 6
      }
    }
  }

  // ---- Rodapé (em todas as páginas, só depois de montar o conteúdo
  // inteiro — só aí dá pra saber quantas páginas o relatório tem). ----
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setDrawColor(...COLOR_GRAY_LINE)
    doc.setLineWidth(0.3)
    doc.line(MARGIN_X, FOOTER_RULE_Y, CONTENT_RIGHT, FOOTER_RULE_Y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...COLOR_GRAY_TEXT)
    doc.text('Ametista Conversões', MARGIN_X, FOOTER_TEXT_Y)
    doc.text(`Página ${i} de ${pageCount}`, CONTENT_RIGHT, FOOTER_TEXT_Y, { align: 'right' })
  }

  const fileClientName = client.name.trim().replace(/\s+/g, '-').toLowerCase()
  doc.save(`relatorio-${fileClientName}-${year}-${String(month).padStart(2, '0')}.pdf`)
}
