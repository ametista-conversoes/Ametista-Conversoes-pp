import { Filter, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { DeleteItemButton } from '@/components/shared/DeleteItemButton'
import type { ManagerSmartGoalRecord } from '@/hooks/useManagerPortalData'
import { useDeleteSmartGoal } from '@/hooks/useManagerPortalData'
import { formatDate } from '@/lib/format'
import { FUNNEL_GOAL_METRICS, formatFunnelValue } from '@/lib/funnel'
import { goalProgressPercent, isAutoGoalMetric, isLowerBetterMetric } from '@/lib/goal-progress'
import { smartGoalMetricLabels, smartGoalStatusLabels, smartGoalStatusStyles } from '@/lib/status-styles'
import { UpdateGoalProgressDialog } from './UpdateGoalProgressDialog'

interface FunnelGoalsListProps {
  clientName: string
  /** Só as metas `funnel = true` de UM cliente. */
  goals: ManagerSmartGoalRecord[]
  deleteMode?: boolean
}

const order = (metric: string | null) => {
  const i = FUNNEL_GOAL_METRICS.indexOf((metric ?? '') as (typeof FUNNEL_GOAL_METRICS)[number])
  return i === -1 ? FUNNEL_GOAL_METRICS.length : i
}

/** Fase 54 — metas do "Montar funil" numa lista única por cliente (uma linha
 * por métrica), em vez de um card por meta. Destaca a métrica mais longe da
 * meta quando há diferença entre elas. */
export function FunnelGoalsList({ clientName, goals, deleteMode }: FunnelGoalsListProps) {
  const deleteGoal = useDeleteSmartGoal()
  const rows = [...goals]
    .sort((a, b) => order(a.metric_type) - order(b.metric_type))
    .map((goal) => ({ goal, percent: goalProgressPercent(goal.metric_type, goal.current_value, goal.target_value) }))
  if (rows.length === 0) return null

  const worst = rows.reduce((min, row) => (row.percent < min.percent ? row : min), rows[0])
  const hasGap = rows.some((row) => row.percent !== worst.percent)
  const anyAuto = rows.some((row) => isAutoGoalMetric(row.goal.metric_type))

  return (
    <Card className="rounded-xl border border-[#1A2540] bg-[#131C31] p-5 hover:border-purple-600/30 md:p-6">
      <CardHeader className="p-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Filter className="h-4 w-4 text-purple-400" />
          Funil — {clientName}
        </CardTitle>
        {anyAuto && (
          <p className="flex items-center gap-1 pt-1 text-xs text-muted-foreground">
            <RefreshCw className="h-3 w-3" />
            Métricas medidas pelo app se atualizam sozinhas (mês corrente, de hora em hora).
          </p>
        )}
      </CardHeader>
      <CardContent className="divide-y divide-[#1A2540] p-0 pt-2">
        {rows.map(({ goal, percent }) => {
          const metric = goal.metric_type ?? ''
          const current = goal.current_value ?? 0
          const target = goal.target_value ?? 0
          return (
            <div key={goal.id} className="space-y-1.5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex flex-wrap items-center gap-2 text-sm text-foreground">
                  {smartGoalMetricLabels[metric] ?? goal.title}
                  {hasGap && goal.id === worst.goal.id && worst.percent < 100 && (
                    <Badge className="bg-amber-500/10 text-amber-400">Maior distância da meta</Badge>
                  )}
                  <Badge className={smartGoalStatusStyles[goal.status]}>
                    {smartGoalStatusLabels[goal.status] ?? goal.status}
                  </Badge>
                </span>
                <span className="flex items-center gap-2">
                  <UpdateGoalProgressDialog goal={goal} compact />
                  {deleteMode && (
                    <DeleteItemButton label={`a meta "${goal.title}"`} onDelete={() => deleteGoal.mutateAsync(goal.id)} />
                  )}
                </span>
              </div>
              <Progress value={percent} />
              <p className="text-xs text-muted-foreground">
                {isLowerBetterMetric(metric)
                  ? `${formatFunnelValue(metric, current)} · meta: até ${formatFunnelValue(metric, target)}`
                  : `${formatFunnelValue(metric, current)} de ${formatFunnelValue(metric, target)}`}{' '}
                ({percent}%)
                {goal.target_date ? ` · Prazo: ${formatDate(goal.target_date)}` : ''}
                {isAutoGoalMetric(metric) ? '' : ' · atualização manual'}
              </p>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
