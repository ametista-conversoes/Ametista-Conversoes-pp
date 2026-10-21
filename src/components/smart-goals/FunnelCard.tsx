import { Filter } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { ManagerSmartGoalRecord } from '@/hooks/useManagerPortalData'
import { formatFunnelValue } from '@/lib/funnel'
import { smartGoalMetricLabels } from '@/lib/status-styles'

const STAGES = ['impressoes', 'cliques', 'leads', 'leads_qualificados', 'vendas'] as const

interface FunnelCardProps {
  clientName: string
  goals: ManagerSmartGoalRecord[]
}

/** Fase 53 — funil do cliente a partir das metas SMART de cada etapa: meta
 * (valor-alvo) × atual (progresso que o gestor atualiza). Destaca a etapa
 * mais distante da meta — ponto de partida da Análise do Gestor. Só aparece
 * com pelo menos 2 etapas cadastradas. */
export function FunnelCard({ clientName, goals }: FunnelCardProps) {
  const stages = STAGES.map((metric) => {
    const goal = goals
      .filter((g) => g.metric_type === metric && g.status !== 'completed')
      .sort((a, b) => (b.target_date ?? '').localeCompare(a.target_date ?? ''))[0]
    const target = goal?.target_value ?? null
    const current = goal?.current_value ?? 0
    const percent = target && target > 0 ? Math.round((current / target) * 100) : null
    return { metric, target, current, percent }
  }).filter((stage) => stage.target != null)

  if (stages.length < 2) return null

  const worst = stages.reduce((min, stage) => ((stage.percent ?? 100) < (min.percent ?? 100) ? stage : min), stages[0])
  // Todas no mesmo % (ex: tudo em 0% logo depois de montar o funil) — não há
  // "pior etapa" pra destacar.
  const hasGap = stages.some((stage) => (stage.percent ?? 100) !== (worst.percent ?? 100))

  return (
    <Card className="rounded-xl border border-[#1A2540] bg-[#131C31] p-5 hover:border-purple-600/30 md:p-6">
      <CardHeader className="p-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Filter className="h-4 w-4 text-purple-400" />
          Funil — {clientName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-0 pt-4">
        {stages.map((stage) => (
          <div key={stage.metric}>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2 text-foreground">
                {smartGoalMetricLabels[stage.metric]}
                {hasGap && stage.metric === worst.metric && (worst.percent ?? 100) < 100 && (
                  <Badge className="bg-amber-500/10 text-amber-400">Maior distância da meta</Badge>
                )}
              </span>
              <span className="text-muted-foreground">
                {formatFunnelValue(stage.metric, stage.current)} de {formatFunnelValue(stage.metric, stage.target)}
                {stage.percent != null ? ` (${stage.percent}%)` : ''}
              </span>
            </div>
            <Progress value={Math.min(100, stage.percent ?? 0)} />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
