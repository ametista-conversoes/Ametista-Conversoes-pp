import { useState } from 'react'
import { CheckCircle2, DollarSign, Gauge, Target, TrendingUp } from 'lucide-react'
import { AssignedTasksCard } from '@/components/dashboard/AssignedTasksCard'
import { EmergencyPauseButton } from '@/components/dashboard/EmergencyPauseButton'
import { FinancialSummaryCard } from '@/components/dashboard/FinancialSummaryCard'
import { GoalsProgressCard } from '@/components/dashboard/GoalsProgressCard'
import { HealthScoreGauge } from '@/components/dashboard/HealthScoreGauge'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { LatestManagerAnalysisCard } from '@/components/dashboard/LatestManagerAnalysisCard'
import { MetricDetailDialog } from '@/components/dashboard/MetricDetailDialog'
import { NotificationsCard } from '@/components/dashboard/NotificationsCard'
import { UpcomingMeetingsCard } from '@/components/dashboard/UpcomingMeetingsCard'
import { UnlinkedClientNotice } from '@/components/shared/UnlinkedClientNotice'
import { useAuth } from '@/contexts/AuthContext'
import {
  useAlerts,
  useClient,
  usePerformanceSnapshots,
  usePublishedManagerAnalysesForClient,
  useSmartGoals,
  useTasks,
  useUpcomingMeetings,
} from '@/hooks/useClientPortalData'
import { formatCurrency, formatMultiplier, formatNumber } from '@/lib/format'
import { kpiDescriptions } from '@/lib/kpi-descriptions'
import { aggregateSnapshotKpis, buildMetricSeries, computeRevenueFromLeads, computeRoas, type MetricKey } from '@/lib/metrics'

interface MetricDetailConfig {
  label: string
  currentValue: number | null
  formatValue: (value: number | null) => string
}

export default function Dashboard() {
  const { clientId } = useAuth()
  const { data: client, isLoading: loadingClient, isError: clientIsError } = useClient()
  const { data: snapshots, isLoading: loadingSnapshots, isError: snapshotsIsError } = usePerformanceSnapshots()
  const { data: tasks } = useTasks()
  const { data: meetings } = useUpcomingMeetings()
  const { data: goals } = useSmartGoals()
  const { data: alerts } = useAlerts()
  const { data: managerAnalyses } = usePublishedManagerAnalysesForClient()
  const [selectedMetric, setSelectedMetric] = useState<MetricKey | null>(null)

  if (!clientId) {
    return <UnlinkedClientNotice page="um Dashboard" />
  }

  if (loadingClient || loadingSnapshots) {
    return <p className="text-sm text-muted-foreground">Carregando...</p>
  }

  if (clientIsError || snapshotsIsError) {
    return <p className="text-sm text-destructive">Erro ao carregar os dados. Tente novamente.</p>
  }

  const snapshotList = snapshots ?? []
  const kpis = aggregateSnapshotKpis(snapshotList)
  const revenue = computeRevenueFromLeads(kpis.conversions, client?.leads_to_close ?? null, client?.average_ticket ?? null)
  const roas = revenue != null ? computeRoas(revenue, kpis.spend) : null

  const metricConfigs: Partial<Record<MetricKey, MetricDetailConfig>> = {
    spend: { label: 'Investimento', currentValue: kpis.spend, formatValue: formatCurrency },
    revenue: { label: 'Receita', currentValue: revenue, formatValue: formatCurrency },
    roas: { label: 'ROAS', currentValue: roas, formatValue: formatMultiplier },
    cpa: { label: 'CPA', currentValue: kpis.cpa, formatValue: formatCurrency },
    conversions: { label: 'Conversões', currentValue: kpis.conversions, formatValue: formatNumber },
  }
  const selectedMetricConfig = selectedMetric ? metricConfigs[selectedMetric] : undefined

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Portal Cliente</p>
          <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        </div>
        <EmergencyPauseButton />
      </div>

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
            label="Receita"
            value={formatCurrency(revenue)}
            icon={TrendingUp}
            description={kpiDescriptions.receita}
            onClick={() => setSelectedMetric('revenue')}
          />
          <KpiCard
            label="ROAS"
            value={formatMultiplier(roas)}
            icon={Gauge}
            description={kpiDescriptions.roas}
            onClick={() => setSelectedMetric('roas')}
          />
          <KpiCard
            label="CPA"
            value={formatCurrency(kpis.cpa)}
            icon={Target}
            description={kpiDescriptions.cpa}
            onClick={() => setSelectedMetric('cpa')}
          />
          <KpiCard
            label="Conversões"
            value={formatNumber(kpis.conversions)}
            icon={CheckCircle2}
            description={kpiDescriptions.conversoes}
            onClick={() => setSelectedMetric('conversions')}
          />
        </div>
      </div>

      <div className="content-grid-container">
        <div className="content-grid gap-4">
          <HealthScoreGauge
            score={client?.health_score ?? null}
            subScores={[
              { label: 'Desempenho', value: client?.health_performance ?? null },
              { label: 'Financeiro', value: client?.health_financial ?? null },
              { label: 'Entrega', value: client?.health_delivery ?? null },
              { label: 'Relacionamento', value: client?.health_relationship ?? null },
            ]}
          />
          <UpcomingMeetingsCard meetings={meetings ?? []} />
          <AssignedTasksCard tasks={tasks ?? []} />
          <FinancialSummaryCard monthlyFee={client?.monthly_fee ?? null} spend={kpis.spend} revenue={revenue} />
          <GoalsProgressCard goals={goals ?? []} />
          <LatestManagerAnalysisCard analyses={managerAnalyses ?? []} />
          <NotificationsCard alerts={alerts ?? []} />
        </div>
      </div>

      {selectedMetric && selectedMetricConfig && (
        <MetricDetailDialog
          open
          onOpenChange={(open) => !open && setSelectedMetric(null)}
          label={selectedMetricConfig.label}
          currentValue={selectedMetricConfig.currentValue}
          series={buildMetricSeries(snapshotList, selectedMetric, client?.leads_to_close ?? null, client?.average_ticket ?? null)}
          formatValue={selectedMetricConfig.formatValue}
        />
      )}
    </div>
  )
}
