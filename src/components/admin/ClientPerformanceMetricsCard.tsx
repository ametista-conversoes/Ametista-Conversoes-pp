import { useState } from 'react'
import {
  Activity,
  CheckCircle2,
  DollarSign,
  Eye,
  Gauge,
  MousePointerClick,
  Percent,
  Receipt,
  ShoppingBag,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { MetricDetailDialog } from '@/components/dashboard/MetricDetailDialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ManagerClientRecord } from '@/hooks/useManagerPortalData'
import { useClientHealthScoreHistory, useClientPerformanceSnapshots } from '@/hooks/useManagerPortalData'
import { monthStartIso, salesForMonth, useClientMonthlySales } from '@/hooks/useMonthlySales'
import { formatCurrency, formatMultiplier, formatNumber, formatPercent, getTodayIsoDate } from '@/lib/format'
import { kpiDescriptions } from '@/lib/kpi-descriptions'
import { buildHealthScoreSeries } from '@/lib/manager-metrics'
import { aggregateSnapshotKpis, buildMetricSeries, computeMonthFinancials, type MetricKey } from '@/lib/metrics'

interface MetricDetailConfig {
  label: string
  currentValue: number | null
  formatValue: (value: number | null) => string
}

interface ClientPerformanceMetricsCardProps {
  client: ManagerClientRecord
}

/** Fase 23b — antes só dava pra achar Receita/Lucro/CPA/etc de um
 * cliente perguntando pra Cassie ou vendo um alerta de limiar disparar
 * (Fase 21.2); esse card traz tudo isso de uma vez na Central de
 * Informações, com as MESMAS fórmulas já usadas no Dashboard/Relatórios
 * do próprio cliente (`aggregateSnapshotKpis`/`computeRevenueFromLeads`/
 * `computeRoas`) — nunca mostra um número diferente do que o cliente já
 * vê do lado dele. Clique em qualquer card abre o mesmo detalhe com
 * gráfico já usado no resto do app (Fases 22/23). */
type SelectedMetric = MetricKey | 'healthScore'

export function ClientPerformanceMetricsCard({ client }: ClientPerformanceMetricsCardProps) {
  const { data: snapshots, isLoading } = useClientPerformanceSnapshots(client.id)
  const { data: healthHistory } = useClientHealthScoreHistory(client.id)
  const [selectedMetric, setSelectedMetric] = useState<SelectedMetric | null>(null)

  const snapshotList = snapshots ?? []
  const kpis = aggregateSnapshotKpis(snapshotList)
  // Fase 58 — Receita/ROAS/Lucro do MÊS CORRENTE, a partir das vendas
  // informadas pelo cliente (o resto do card segue nos últimos 30 dias).
  const { data: monthlySales } = useClientMonthlySales(client.id)
  const [year, month] = getTodayIsoDate().split('-').map(Number)
  const monthSales = salesForMonth(monthlySales, monthStartIso())
  const { spend: monthSpend, revenue, roas } = computeMonthFinancials(
    snapshotList,
    year,
    month,
    monthSales,
    client.average_ticket,
  )
  // Mesma fórmula do FinancialSummaryCard/Histórico Mensal — Lucro
  // desconta a mensalidade da agência, não só o investimento em mídia.
  const totalCost = kpis.spend + (client.monthly_fee ?? 0)
  const profit = revenue != null ? revenue - (monthSpend + (client.monthly_fee ?? 0)) : null

  const metricConfigs: Record<MetricKey, MetricDetailConfig> = {
    spend: { label: 'Investimento', currentValue: kpis.spend, formatValue: formatCurrency },
    revenue: { label: 'Receita', currentValue: revenue, formatValue: formatCurrency },
    roas: { label: 'ROAS', currentValue: roas, formatValue: formatMultiplier },
    cpa: { label: 'CPA', currentValue: kpis.cpa, formatValue: formatCurrency },
    conversions: { label: 'Conversões', currentValue: kpis.conversions, formatValue: formatNumber },
    ctr: { label: 'CTR médio', currentValue: kpis.ctr, formatValue: formatPercent },
    cpc: { label: 'CPC', currentValue: kpis.cpc, formatValue: formatCurrency },
    conversionRate: { label: 'Taxa de Conversão', currentValue: kpis.conversionRate, formatValue: formatPercent },
    impressions: { label: 'Impressões', currentValue: kpis.impressions, formatValue: formatNumber },
    clicks: { label: 'Cliques', currentValue: kpis.clicks, formatValue: formatNumber },
  }
  const healthScoreConfig: MetricDetailConfig = {
    label: 'Health Score',
    currentValue: client.health_score,
    formatValue: formatNumber,
  }
  const selectedMetricConfig =
    selectedMetric === 'healthScore' ? healthScoreConfig : selectedMetric ? metricConfigs[selectedMetric] : undefined
  const selectedSeries =
    selectedMetric === 'healthScore'
      ? buildHealthScoreSeries(healthHistory ?? [])
      : selectedMetric
        ? buildMetricSeries(snapshotList, selectedMetric)
        : []

  return (
    <Card className="rounded-xl border border-[#1A2540] bg-[#131C31] p-5 hover:border-purple-600/30 md:p-6">
      <CardHeader className="p-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Gauge className="h-4 w-4 text-purple-400" />
          Métricas de Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-0 pt-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="content-grid-container">
            <div className="content-grid gap-4">
              <KpiCard
                label="Investimento"
                value={formatCurrency(kpis.spend)}
                icon={DollarSign}
                description={kpiDescriptions.investimento}
                onClick={() => setSelectedMetric('spend')}
              />
              <KpiCard
                label="Gasto Total"
                value={formatCurrency(totalCost)}
                icon={Receipt}
                description={kpiDescriptions.gastoTotal}
              />
              <KpiCard
                label="Vendas (mês)"
                value={monthSales != null ? formatNumber(monthSales) : '—'}
                icon={ShoppingBag}
                description="Vendas do mês corrente informadas pelo cliente no Portal do Cliente. Enquanto ele não informar, Receita, Lucro e ROAS ficam em branco."
              />
              <KpiCard
                label="Receita (mês)"
                value={formatCurrency(revenue)}
                icon={TrendingUp}
                description={kpiDescriptions.receita}
              />
              <KpiCard label="Lucro (mês)" value={formatCurrency(profit)} icon={Wallet} description={kpiDescriptions.lucro} />
              <KpiCard label="ROAS (mês)" value={formatMultiplier(roas)} icon={Gauge} description={kpiDescriptions.roas} />
              <KpiCard
                label="CPA"
                value={formatCurrency(kpis.cpa)}
                icon={Target}
                description={kpiDescriptions.cpa}
                onClick={() => setSelectedMetric('cpa')}
              />
              <KpiCard
                label="CTR médio"
                value={formatPercent(kpis.ctr)}
                icon={MousePointerClick}
                description={kpiDescriptions.ctrMedio}
                onClick={() => setSelectedMetric('ctr')}
              />
              <KpiCard
                label="CPC"
                value={formatCurrency(kpis.cpc)}
                icon={Target}
                description={kpiDescriptions.cpc}
                onClick={() => setSelectedMetric('cpc')}
              />
              <KpiCard
                label="Taxa de Conversão"
                value={formatPercent(kpis.conversionRate)}
                icon={Percent}
                description={kpiDescriptions.taxaConversao}
                onClick={() => setSelectedMetric('conversionRate')}
              />
              <KpiCard
                label="Cliques"
                value={formatNumber(kpis.clicks)}
                icon={MousePointerClick}
                description={kpiDescriptions.cliques}
                onClick={() => setSelectedMetric('clicks')}
              />
              <KpiCard
                label="Impressões"
                value={formatNumber(kpis.impressions)}
                icon={Eye}
                description={kpiDescriptions.impressoes}
                onClick={() => setSelectedMetric('impressions')}
              />
              <KpiCard
                label="Conversões"
                value={formatNumber(kpis.conversions)}
                icon={CheckCircle2}
                description={kpiDescriptions.conversoes}
                onClick={() => setSelectedMetric('conversions')}
              />
              <KpiCard
                label="Health Score"
                value={formatNumber(client.health_score)}
                icon={Activity}
                description={kpiDescriptions.healthScoreMedio}
                onClick={() => setSelectedMetric('healthScore')}
              />
            </div>
          </div>
        )}
      </CardContent>

      {selectedMetric && selectedMetricConfig && (
        <MetricDetailDialog
          open
          onOpenChange={(open) => !open && setSelectedMetric(null)}
          label={selectedMetricConfig.label}
          currentValue={selectedMetricConfig.currentValue}
          series={selectedSeries}
          formatValue={selectedMetricConfig.formatValue}
        />
      )}
    </Card>
  )
}
