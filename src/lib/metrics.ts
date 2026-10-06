import type { PerformanceSnapshotRecord, ProjectRecord } from '@/hooks/useClientPortalData'
import type { ChannelBreakdown } from '@/components/charts/SpendRevenueBarChart'
import type { TrendPoint } from '@/components/charts/PerformanceTrendChart'

/**
 * Receita estimada a partir de Leads reais — nenhuma plataforma de
 * anúncio reporta faturamento, então a Receita é calculada em 2 passos
 * a partir de duas premissas de negócio editáveis por cliente (Central
 * de Informações do Cliente): Vendas = Leads ÷ leadsToClose, Receita =
 * Vendas × averageTicket. `null` sem `leadsToClose`/`averageTicket`
 * configurados (evita divisão por zero).
 */
export function computeRevenueFromLeads(
  leads: number,
  leadsToClose: number | null,
  averageTicket: number | null,
): number | null {
  if (!leadsToClose || leadsToClose <= 0 || averageTicket == null) return null
  const sales = leads / leadsToClose
  return sales * averageTicket
}

/** ROAS cruza a Receita (calculada a partir de Leads) com o Investimento
 * real (snapshots). */
export function computeRoas(revenue: number, spend: number): number | null {
  return spend > 0 ? revenue / spend : null
}

/** Agrupa investimento/receita dos projetos por canal, para o gráfico de barras. */
export function groupByChannel(projects: ProjectRecord[]): ChannelBreakdown[] {
  const byChannel = new Map<string, ChannelBreakdown>()
  for (const project of projects) {
    const channel = project.channel ?? 'Sem canal'
    const existing = byChannel.get(channel) ?? { channel, investimento: 0, receita: 0 }
    existing.investimento += project.spend ?? 0
    existing.receita += project.revenue ?? 0
    byChannel.set(channel, existing)
  }
  return Array.from(byChannel.values())
}

/**
 * Investimento real por canal (retratos diários) dentro de um mês
 * específico, com a Receita do mês inteiro (calculada a partir dos
 * Leads reais, mesma fórmula de `computeRevenueFromLeads`) distribuída
 * proporcionalmente pela fatia de conversões de cada canal — não tem
 * receita reportada por canal em nenhuma plataforma de anúncio, essa é
 * a mesma lógica de atribuição já usada pro total do cliente, só
 * quebrada por canal (Fase 21.3b, aba "Histórico Mensal").
 */
export function groupByChannelForMonth(
  snapshots: PerformanceSnapshotRecord[],
  year: number,
  month: number,
  leadsToClose: number | null,
  averageTicket: number | null,
): ChannelBreakdown[] {
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  const monthSnapshots = snapshots.filter((s) => s.snapshot_date.startsWith(prefix))

  const byChannel = new Map<string, { spend: number; conversions: number }>()
  let totalConversions = 0
  for (const s of monthSnapshots) {
    const channel = s.channel ?? 'Sem canal'
    const existing = byChannel.get(channel) ?? { spend: 0, conversions: 0 }
    existing.spend += s.spend ?? 0
    existing.conversions += s.conversions ?? 0
    byChannel.set(channel, existing)
    totalConversions += s.conversions ?? 0
  }

  const totalRevenue = computeRevenueFromLeads(totalConversions, leadsToClose, averageTicket)

  return Array.from(byChannel.entries()).map(([channel, { spend, conversions }]) => ({
    channel,
    investimento: spend,
    receita: totalRevenue != null && totalConversions > 0 ? totalRevenue * (conversions / totalConversions) : 0,
    conversoes: conversions,
    cpa: conversions > 0 ? spend / conversions : null,
  }))
}

/** Soma os retratos diários de todos os projetos do cliente, por data. */
export function buildTrendSeries(snapshots: PerformanceSnapshotRecord[]): TrendPoint[] {
  const byDate = new Map<string, TrendPoint>()
  for (const snapshot of snapshots) {
    const existing = byDate.get(snapshot.snapshot_date) ?? {
      date: snapshot.snapshot_date,
      investimento: 0,
      receita: 0,
    }
    existing.investimento += snapshot.spend ?? 0
    existing.receita += snapshot.revenue ?? 0
    byDate.set(snapshot.snapshot_date, existing)
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
}

export interface SnapshotKpis {
  spend: number
  impressions: number
  clicks: number
  conversions: number
  ctr: number | null
  cpc: number | null
  conversionRate: number | null
  cpa: number | null
}

const SNAPSHOT_WINDOW_DAYS = 30

/**
 * Investimento/impressões/cliques/conversões/CTR/CPC/taxa de
 * conversão/CPA reais, somados dos últimos 30 dias de retratos diários
 * (vêm de integrações reais, Google Ads/Meta Ads) — mesma janela de 30
 * dias já usada em `useCampaignPerformance` (useManagerPortalData.ts) e
 * no resumo que a Cassie usa, pra não ter duas convenções de período
 * diferentes no app. CTR é calculado na hora (cliques ÷ impressões),
 * não lido de um campo salvo — mesmo padrão de `useCampaignPerformance`.
 * Sem cliques/impressões, os campos derivados ficam null (cliente sem
 * integração conectada ainda).
 */
export function aggregateSnapshotKpis(snapshots: PerformanceSnapshotRecord[]): SnapshotKpis {
  const since = new Date(Date.now() - SNAPSHOT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const recent = snapshots.filter((s) => s.snapshot_date >= since)
  return sumSnapshotKpis(recent)
}

/**
 * Mesmas fórmulas de `aggregateSnapshotKpis`, mas filtrando por um mês
 * específico (ano+mês) em vez da janela rolante dos últimos 30 dias —
 * usado na aba "Histórico Mensal" de Relatórios pra mostrar o mês
 * ainda em andamento (Fase 21.3) com os mesmos números que o
 * fechamento oficial (client_monthly_reports) vai gravar quando o mês
 * terminar.
 */
export function aggregateSnapshotKpisForMonth(snapshots: PerformanceSnapshotRecord[], year: number, month: number): SnapshotKpis {
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  return sumSnapshotKpis(snapshots.filter((s) => s.snapshot_date.startsWith(prefix)))
}

// Fase 22 — chave de cada métrica clicável (KpiCard -> MetricDetailDialog).
export type MetricKey = 'spend' | 'revenue' | 'roas' | 'cpa' | 'ctr' | 'cpc' | 'conversionRate' | 'conversions' | 'impressions' | 'clicks'

export interface MetricSeriesPoint {
  date: string
  value: number | null
}

/**
 * Série diária de UMA métrica, pro gráfico de linha do
 * `MetricDetailDialog` — agrupa os retratos por data (mesmo padrão de
 * `buildTrendSeries`) e aplica, dia a dia, a MESMA fórmula já usada em
 * `aggregateSnapshotKpis`/`computeRevenueFromLeads`/`computeRoas`, pra
 * nunca destoar do que já é mostrado no resto do app.
 */
export function buildMetricSeries(
  snapshots: PerformanceSnapshotRecord[],
  metricKey: MetricKey,
  leadsToClose: number | null,
  averageTicket: number | null,
): MetricSeriesPoint[] {
  const byDate = new Map<string, { spend: number; clicks: number; impressions: number; conversions: number }>()
  for (const s of snapshots) {
    const existing = byDate.get(s.snapshot_date) ?? { spend: 0, clicks: 0, impressions: 0, conversions: 0 }
    existing.spend += s.spend ?? 0
    existing.clicks += s.clicks ?? 0
    existing.impressions += s.impressions ?? 0
    existing.conversions += s.conversions ?? 0
    byDate.set(s.snapshot_date, existing)
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, day]) => {
      let value: number | null
      switch (metricKey) {
        case 'spend':
          value = day.spend
          break
        case 'clicks':
          value = day.clicks
          break
        case 'impressions':
          value = day.impressions
          break
        case 'conversions':
          value = day.conversions
          break
        case 'ctr':
          value = day.impressions > 0 ? (day.clicks / day.impressions) * 100 : null
          break
        case 'cpc':
          value = day.clicks > 0 ? day.spend / day.clicks : null
          break
        case 'conversionRate':
          value = day.clicks > 0 ? (day.conversions / day.clicks) * 100 : null
          break
        case 'cpa':
          value = day.conversions > 0 ? day.spend / day.conversions : null
          break
        case 'revenue':
          value = computeRevenueFromLeads(day.conversions, leadsToClose, averageTicket)
          break
        case 'roas': {
          const dayRevenue = computeRevenueFromLeads(day.conversions, leadsToClose, averageTicket)
          value = dayRevenue != null ? computeRoas(dayRevenue, day.spend) : null
          break
        }
      }
      return { date, value }
    })
}

/** CTR/CPC/Taxa de Conversão/CPA a partir de totais brutos — mesma
 * fórmula usada em `sumSnapshotKpis` (conta inteira), `useCampaignPerformance`
 * (por campanha) e `useAdGroups` (por grupo de anúncios), pra nunca
 * duplicar/destoar a conta entre os 3 níveis. "Taxa de Conversão" é a
 * mesma coisa que a coluna personalizada "Taxa Conv. LP" do Google Ads
 * (Conversões ÷ Cliques) — não é um conceito novo. */
export function computeRateMetrics(spend: number, clicks: number, impressions: number, conversions: number) {
  return {
    ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
    cpc: clicks > 0 ? spend / clicks : null,
    conversionRate: clicks > 0 ? (conversions / clicks) * 100 : null,
    cpa: conversions > 0 ? spend / conversions : null,
  }
}

function sumSnapshotKpis(snapshots: PerformanceSnapshotRecord[]): SnapshotKpis {
  const spend = snapshots.reduce((sum, s) => sum + (s.spend ?? 0), 0)
  const impressions = snapshots.reduce((sum, s) => sum + (s.impressions ?? 0), 0)
  const clicks = snapshots.reduce((sum, s) => sum + (s.clicks ?? 0), 0)
  const conversions = snapshots.reduce((sum, s) => sum + (s.conversions ?? 0), 0)

  return { spend, impressions, clicks, conversions, ...computeRateMetrics(spend, clicks, impressions, conversions) }
}
