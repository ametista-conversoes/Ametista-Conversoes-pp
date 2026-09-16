import { Target } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { DeleteItemButton } from '@/components/shared/DeleteItemButton'
import type { ManagerSmartGoalRecord } from '@/hooks/useManagerPortalData'
import { useClientAdConversions, useClientLeadStatusCounts, useDeleteSmartGoal } from '@/hooks/useManagerPortalData'
import { formatDate, getGoalDeadlineStatus } from '@/lib/format'
import { adConversionsLabel, isLeadCountMetric, leadCountForMetric, leadCountLabel } from '@/lib/lead-metrics'
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

export function SmartGoalCard({ goal, deleteMode }: SmartGoalCardProps) {
  const target = goal.target_value ?? 0
  const current = goal.current_value ?? 0
  const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0
  const deadlineStatus = getGoalDeadlineStatus(goal.target_date, goal.status)
  const deleteGoal = useDeleteSmartGoal()

  // Fase 35/36.2 — "Leads"/"Leads Qualificados"/"Vendas" são alimentados
  // de verdade pelo status marcado em cada resposta de formulário (Parte
  // 2 do Fechamento do Loop de Venda); mostra a contagem real ao lado do
  // valor atual (que continua editável manualmente, igual às outras
  // métricas) pra confirmar de relance se está desatualizado. "Leads"
  // (bruto) conta QUALQUER resposta, sem validação — o rótulo deixa
  // isso explícito (ver leadCountLabel) pra não ser confundido com um
  // lead de verdade.
  const isLeadMetric = isLeadCountMetric(goal.metric_type)
  const leadCounts = useClientLeadStatusCounts(isLeadMetric ? goal.client_id : null)
  const realCount = leadCountForMetric(goal.metric_type, leadCounts.data)

  // Fase 37, Bloco 2 — "Leads" (bruto) ganha uma 2ª fonte de contagem
  // real: conversão que o próprio Google/Meta Ads já rastreia (pixel/tag
  // das campanhas vinculadas), ao lado da contagem de respostas de
  // formulário — são números diferentes por natureza, mostrados
  // separados, nunca somados um no outro.
  const adConversionsMetric = adConversionsLabel(goal.metric_type)
  const adConversions = useClientAdConversions(adConversionsMetric ? goal.client_id : null)

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
            {current} de {target} ({percent}%)
            {goal.target_date ? ` · Prazo: ${formatDate(goal.target_date)}` : ''}
          </p>
          {realCount != null && realCount !== current && (
            <p className="mt-1 text-xs text-purple-300">
              {leadCountLabel(goal.metric_type)}: {realCount} (Ativos Digitais → Integrações → Ver respostas, ou o
              cliente na aba Leads)
            </p>
          )}
          {adConversionsMetric && adConversions.data?.hasLinkedCampaigns && (
            <p className="mt-1 text-xs text-purple-300">
              {adConversionsMetric}: {adConversions.data.conversions}
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
