import { Badge } from '@/components/ui/badge'
import type { Client90DayMilestoneRecord } from '@/hooks/useClientPortalData'
import { formatDate } from '@/lib/format'
import { milestone90dStatusLabels, milestone90dStatusStyles } from '@/lib/status-styles'

interface Plano90DaysTimelineProps {
  milestones: Client90DayMilestoneRecord[]
}

/** Fase 48.5 — histórico de marcos do Plano de 90 dias, só leitura
 * (quem registra é o gestor, na Central de Informações do Cliente). */
export function Plano90DaysTimeline({ milestones }: Plano90DaysTimelineProps) {
  if (milestones.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum marco registrado ainda pelo seu gestor.</p>
  }

  return (
    <ul className="space-y-2">
      {milestones.map((milestone) => (
        <li key={milestone.id} className="rounded-lg bg-secondary/50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">{formatDate(milestone.entry_date)}</span>
            <Badge className={`border ${milestone90dStatusStyles[milestone.status]}`}>
              {milestone90dStatusLabels[milestone.status]}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-foreground">{milestone.title}</p>
          {milestone.note && <p className="mt-1 text-xs text-muted-foreground">{milestone.note}</p>}
        </li>
      ))}
    </ul>
  )
}
