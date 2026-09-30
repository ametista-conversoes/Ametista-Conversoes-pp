import { useState } from 'react'
import {
  AlertTriangle,
  Briefcase,
  DollarSign,
  Siren,
  TrendingDown,
  Users,
  Wallet,
  Zap,
} from 'lucide-react'
import { AtRiskClientsList } from '@/components/admin/AtRiskClientsList'
import { ProductivityGauge } from '@/components/admin/ProductivityGauge'
import { RecentIncidentsList } from '@/components/admin/RecentIncidentsList'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { MetricDetailDialog } from '@/components/dashboard/MetricDetailDialog'
import { useAllClients, useAllIncidents, useAllProjects, useAllTasks, useExecutiveKpiHistory } from '@/hooks/useManagerPortalData'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/format'
import { kpiDescriptions } from '@/lib/kpi-descriptions'
import { buildExecutiveMetricSeries, computeExecutiveKpis, type ExecutiveMetricField } from '@/lib/manager-metrics'

interface MetricDetailConfig {
  label: string
  currentValue: number | null
  formatValue: (value: number | null) => string
}

export default function DashboardExecutivo() {
  const { data: clients, isLoading: loadingClients } = useAllClients()
  const { data: incidents, isLoading: loadingIncidents } = useAllIncidents()
  const { data: tasks, isLoading: loadingTasks } = useAllTasks()
  const { data: projects, isLoading: loadingProjects } = useAllProjects()
  const { data: kpiHistory } = useExecutiveKpiHistory()
  const [selectedMetric, setSelectedMetric] = useState<ExecutiveMetricField | null>(null)

  if (loadingClients || loadingIncidents || loadingTasks || loadingProjects) {
    return <p className="text-sm text-muted-foreground">Carregando...</p>
  }

  const kpis = computeExecutiveKpis(clients ?? [], incidents ?? [], tasks ?? [], projects ?? [])

  const metricConfigs: Record<ExecutiveMetricField, MetricDetailConfig> = {
    mrr_total: { label: 'MRR Total', currentValue: kpis.mrrTotal, formatValue: formatCurrency },
    active_clients: { label: 'Clientes Ativos', currentValue: kpis.activeClients, formatValue: formatNumber },
    churn_rate: { label: 'Churn Rate', currentValue: kpis.churnRate, formatValue: formatPercent },
    open_incidents: { label: 'Incidentes Abertos', currentValue: kpis.openIncidents, formatValue: formatNumber },
    at_risk_clients: { label: 'Clientes em Risco', currentValue: kpis.atRiskClients, formatValue: formatNumber },
    workload: { label: 'Carga de Trabalho', currentValue: kpis.workload, formatValue: formatNumber },
    productivity: { label: 'Produtividade', currentValue: kpis.productivity, formatValue: formatPercent },
    managed_budget: { label: 'Budget Gerenciado', currentValue: kpis.managedBudget, formatValue: formatCurrency },
  }
  const selectedMetricConfig = selectedMetric ? metricConfigs[selectedMetric] : undefined

  return (
    <div className="space-y-6">
      <div>
        <span className="inline-flex items-center rounded-full border border-purple-600/30 bg-purple-600/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-purple-400">
          Portal Gestor
        </span>
        <h1 className="mt-2 text-2xl font-semibold text-foreground md:text-3xl">
          Dashboard{' '}
          <span className="bg-gradient-to-r from-purple-300 to-purple-500 bg-clip-text text-transparent">
            Executivo
          </span>
        </h1>
      </div>

      <div className="content-grid-container">
        <div className="content-grid gap-4">
          <KpiCard
            label="MRR Total"
            value={formatCurrency(kpis.mrrTotal)}
            icon={DollarSign}
            description={kpiDescriptions.mrrTotal}
            onClick={() => setSelectedMetric('mrr_total')}
          />
          <KpiCard
            label="Clientes Ativos"
            value={formatNumber(kpis.activeClients)}
            icon={Users}
            description={kpiDescriptions.clientesAtivos}
            onClick={() => setSelectedMetric('active_clients')}
          />
          <KpiCard
            label="Churn Rate"
            value={formatPercent(kpis.churnRate)}
            icon={TrendingDown}
            description={kpiDescriptions.churnRate}
            onClick={() => setSelectedMetric('churn_rate')}
          />
          <KpiCard
            label="Incidentes Abertos"
            value={formatNumber(kpis.openIncidents)}
            icon={Siren}
            description={kpiDescriptions.incidentesAbertos}
            onClick={() => setSelectedMetric('open_incidents')}
          />
          <KpiCard
            label="Clientes em Risco"
            value={formatNumber(kpis.atRiskClients)}
            icon={AlertTriangle}
            description={kpiDescriptions.clientesEmRisco}
            onClick={() => setSelectedMetric('at_risk_clients')}
          />
          <KpiCard
            label="Carga de Trabalho"
            value={formatNumber(kpis.workload)}
            icon={Briefcase}
            description={kpiDescriptions.cargaDeTrabalho}
            onClick={() => setSelectedMetric('workload')}
          />
          <KpiCard
            label="Produtividade"
            value={formatPercent(kpis.productivity)}
            icon={Zap}
            description={kpiDescriptions.produtividade}
            onClick={() => setSelectedMetric('productivity')}
          />
          <KpiCard
            label="Budget Gerenciado"
            value={formatCurrency(kpis.managedBudget)}
            icon={Wallet}
            description={kpiDescriptions.budgetGerenciado}
            onClick={() => setSelectedMetric('managed_budget')}
          />
        </div>
      </div>

      <div className="content-grid-container">
        <div className="content-grid gap-4">
          <ProductivityGauge value={kpis.productivity} />
          <AtRiskClientsList clients={clients ?? []} />
          <RecentIncidentsList incidents={incidents ?? []} />
        </div>
      </div>

      {selectedMetric && selectedMetricConfig && (
        <MetricDetailDialog
          open
          onOpenChange={(open) => !open && setSelectedMetric(null)}
          label={selectedMetricConfig.label}
          currentValue={selectedMetricConfig.currentValue}
          series={buildExecutiveMetricSeries(kpiHistory ?? [], selectedMetric)}
          formatValue={selectedMetricConfig.formatValue}
        />
      )}
    </div>
  )
}
