import { RefreshCw, Target } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { DeleteItemButton } from '@/components/shared/DeleteItemButton'
import type { ManagerSmartGoalRecord } from '@/hooks/useManagerPortalData'
import { useDeleteSmartGoal } from '@/hooks/useManagerPortalData'
import { formatDate, getGoalDeadlineStatus } from '@/lib/format'
import { formatFunnelValue } from '@/lib/funnel'
import { goalProgressPercent, isAutoGoalMetric, isLowerBetterMetric } from '@/lib/goal-progress'
import {
  goalDeadlineStatusLabels,
  goalDeadlineStatusStyles,
  smartGoalMetricLabels,
  smartGoalStatusLabels,
  smartGoalStatusStyles,
} from '@/lib/status-styles'
import { UpdateGoalProgressDialog } from './UpdateGoalProgressDialog'

interface SmartGoalCardProps {
  goal: ManagerSmartGoalRecord
  deleteMode?: boolean
}

/** Fase 54 — métricas que o app mede se atualizam sozinhas (mês corrente,
 * de hora em hora — `refresh_smart_goals_from_ads`); CPA/CPC/CPM usam a
 * barra invertida (meta ÷ atual). */
export function SmartGoalCard({ goal, deleteMode }: SmartGoalCardProps) {
  const target = goal.target_value ?? 0
  const current = goal.current_value ?? 0
  const metric = goal.metric_type ?? ''
  const percent = goalProgressPercent(goal.metric_type, current, target)
  const deadlineStatus = getGoalDeadlineStatus(goal.target_date, goal.status)
  const deleteGoal = useDeleteSmartGoal()

  return (
    <Card className="flex flex-col rounded-xl border border-[#1A2540] bg-[#131C31] p-5 hover:border-purple-600/30 md:p-6">
      <CardHeader className="p-0">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex min-w-0 items-center gap-2">
            <Target className="h-4 w-4 shrink-0 text-purple-400" />
            <span className="truncate">{goal.title}</span>
          </span>
          {deleteMode && (
            <DeleteItemButton label={`a meta "${goal.title}"`} onDelete={() => deleteGoal.mutateAsync(goal.id)} />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 p-0 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground/70">
            {goal.client?.name ?? 'Cliente'}
            {goal.metric_type ? ` · ${smartGoalMetricLabels[goal.metric_type] ?? goal.metric_type}` : ''}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {deadlineStatus && (
              <Badge className={goalDeadlineStatusStyles[deadlineStatus]}>
                {goalDeadlineStatusLabels[deadlineStatus]}
              </Badge>
            )}
            <Badge className={smartGoalStatusStyles[goal.status]}>
              {smartGoalStatusLabels[goal.status] ?? goal.status}
            </Badge>
          </div>
        </div>

        <div>
          <Progress value={percent} />
          <p className="mt-1 text-xs text-muted-foreground">
            {isLowerBetterMetric(goal.metric_type)
              ? `${formatFunnelValue(metric, current)} · meta: até ${formatFunnelValue(metric, target)}`
              : `${formatFunnelValue(metric, current)} de ${formatFunnelValue(metric, target)}`}{' '}
            ({percent}%)
            {goal.target_date ? ` · Prazo: ${formatDate(goal.target_date)}` : ''}
          </p>
          {isAutoGoalMetric(goal.metric_type) && (
            <p className="mt-1 flex items-center gap-1 text-xs text-purple-300">
              <RefreshCw className="h-3 w-3" />
              Atualizada automaticamente (mês corrente, de hora em hora)
            </p>
          )}
        </div>

        <div className="mt-auto pt-2">
          <UpdateGoalProgressDialog goal={goal} />
        </div>
      </CardContent>
    </Card>
  )
}
