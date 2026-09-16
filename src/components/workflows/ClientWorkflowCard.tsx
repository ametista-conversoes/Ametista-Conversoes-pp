import { ListChecks, Pencil, Repeat } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DeleteItemButton } from '@/components/shared/DeleteItemButton'
import type { ClientWorkflowTemplateRecord } from '@/hooks/useManagerPortalData'
import { useDeleteClientWorkflowTemplate } from '@/hooks/useManagerPortalData'
import { recurrenceShortLabels } from '@/lib/recurrence'
import { ApplyClientWorkflowDialog } from './ApplyClientWorkflowDialog'
import { ClientWorkflowTemplateFormDialog } from './ClientWorkflowTemplateFormDialog'

interface ClientWorkflowCardProps {
  template: ClientWorkflowTemplateRecord
  deleteMode?: boolean
  canEdit?: boolean
}

export function ClientWorkflowCard({ template, deleteMode, canEdit }: ClientWorkflowCardProps) {
  const deleteTemplate = useDeleteClientWorkflowTemplate()

  return (
    <Card className="flex flex-col rounded-xl border border-[#1A2540] bg-[#131C31] p-5 hover:border-purple-600/30 md:p-6">
      <CardHeader className="p-0">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-purple-400" />
            {template.name}
          </span>
          <span className="flex items-center gap-1">
            {canEdit && (
              <ClientWorkflowTemplateFormDialog
                template={template}
                trigger={
                  <Button type="button" variant="ghost" size="icon" aria-label={`Editar ${template.name}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                }
              />
            )}
            {deleteMode && (
              <DeleteItemButton
                label={`o modelo "${template.name}"`}
                onDelete={() => deleteTemplate.mutateAsync(template.id)}
              />
            )}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 p-0 pt-4">
        <p className="text-sm text-muted-foreground">{template.description}</p>
        <ul className="space-y-1.5">
          {template.steps.map((step) => (
            <li key={step.title} className="flex items-center gap-2 text-sm text-foreground">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400" />
              <span className="min-w-0">{step.title}</span>
              {step.due_days ? <span className="shrink-0 text-xs text-muted-foreground">· {step.due_days}d</span> : null}
              {step.recurrence && (
                <Badge className="shrink-0 gap-1 border-purple-600/20 bg-purple-600/10 text-[10px] text-purple-300">
                  <Repeat className="h-2.5 w-2.5" />
                  {recurrenceShortLabels[step.recurrence]}
                </Badge>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-auto pt-2">
          <ApplyClientWorkflowDialog template={template} />
        </div>
      </CardContent>
    </Card>
  )
}
