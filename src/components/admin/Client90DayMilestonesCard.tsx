import { CalendarCheck, Pencil, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DeleteItemButton } from '@/components/shared/DeleteItemButton'
import { useClient90DayMilestones, useDeleteClient90DayMilestone } from '@/hooks/useManagerPortalData'
import { formatDate } from '@/lib/format'
import { milestone90dStatusLabels, milestone90dStatusStyles } from '@/lib/status-styles'
import { Client90DayMilestoneFormDialog } from './Client90DayMilestoneFormDialog'

interface Client90DayMilestonesCardProps {
  clientId: string
}

/** Fase 48.5 — registro leve de progresso do Plano de 90 dias (marcos
 * datados, não o documento completo de 10 seções, que continua
 * manual/externo — ver Obsidian do usuário). Cliente vê o mesmo
 * histórico, só leitura, na aba Relatórios. */
export function Client90DayMilestonesCard({ clientId }: Client90DayMilestonesCardProps) {
  const { data: milestones, isLoading } = useClient90DayMilestones(clientId)
  const deleteMilestone = useDeleteClient90DayMilestone()

  return (
    <Card className="rounded-xl border border-[#1A2540] bg-[#131C31] p-5 hover:border-purple-600/30 md:p-6">
      <CardHeader className="flex flex-row items-center justify-between gap-2 p-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarCheck className="h-4 w-4 text-purple-400" />
          Plano de 90 dias
        </CardTitle>
        <Client90DayMilestoneFormDialog
          clientId={clientId}
          trigger={
            <Button type="button" size="sm" variant="secondary">
              <Plus className="h-4 w-4" />
              Novo marco
            </Button>
          }
        />
      </CardHeader>
      <CardContent className="space-y-3 p-0 pt-4">
        <p className="text-xs text-muted-foreground">
          Registro leve de progresso (não o documento completo do Plano de 90 dias, que continua sendo feito à parte e
          subido na aba Arquivos). O cliente vê esse mesmo histórico, só leitura, em Relatórios.
        </p>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : !milestones || milestones.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum marco registrado ainda.</p>
        ) : (
          <ul className="space-y-2">
            {milestones.map((milestone) => (
              <li key={milestone.id} className="flex items-start justify-between gap-3 rounded-lg bg-secondary/50 p-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">{formatDate(milestone.entry_date)}</span>
                    <Badge className={`border ${milestone90dStatusStyles[milestone.status]}`}>
                      {milestone90dStatusLabels[milestone.status]}
                    </Badge>
                  </div>
                  <p className="text-sm text-foreground">{milestone.title}</p>
                  {milestone.note && <p className="text-xs text-muted-foreground">{milestone.note}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Client90DayMilestoneFormDialog
                    clientId={clientId}
                    milestone={milestone}
                    trigger={
                      <Button type="button" variant="ghost" size="icon" aria-label={`Editar marco ${milestone.title}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    }
                  />
                  <DeleteItemButton
                    label={`o marco "${milestone.title}"`}
                    onDelete={() => deleteMilestone.mutateAsync({ id: milestone.id, client_id: clientId })}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
