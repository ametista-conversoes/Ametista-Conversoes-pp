import { ListChecks, Pencil, Repeat, Star, StarOff, Workflow as WorkflowIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DeleteItemButton } from '@/components/shared/DeleteItemButton'
import type {
  ActivityPlanScope,
  ActivityPlatformScope,
  ActivityTemplateItem,
  ActivityTemplateRecord,
} from '@/hooks/useManagerPortalData'
import {
  useDeleteActivityTemplate,
  useSetDefaultActivityTemplate,
  useUnsetDefaultActivityTemplate,
} from '@/hooks/useManagerPortalData'
import { recurrenceShortLabels } from '@/lib/recurrence'
import { planLabels } from '@/lib/status-styles'
import { ActivityTemplateFormDialog } from './ActivityTemplateFormDialog'

const ALL_PLANS: ActivityPlanScope[] = ['validacao', 'escala', 'dominacao']

/** Fase 29 — resumo tipo "8 itens · 2 exclusivos de Dominação", pra
 * auditoria rápida sem precisar abrir cada item do checklist. Item sem
 * plan_scope (dado antigo) ou com os 3 planos marcados conta como
 * universal. */
function summarizePlanScope(items: ActivityTemplateItem[]): string {
  const groups = new Map<string, number>()
  for (const item of items) {
    const scope = item.plan_scope && item.plan_scope.length > 0 ? item.plan_scope : ALL_PLANS
    if (scope.length >= 3) continue
    const label = ALL_PLANS.filter((plan) => scope.includes(plan))
      .map((plan) => planLabels[plan])
      .join(' + ')
    groups.set(label, (groups.get(label) ?? 0) + 1)
  }
  const total = items.length
  const parts = [`${total} ${total === 1 ? 'item' : 'itens'}`]
  for (const [label, count] of groups) {
    parts.push(`${count} exclusivo${count > 1 ? 's' : ''} de ${label}`)
  }
  return parts.join(' · ')
}

/** Cor da bolinha de cada item — roxo normal quando vale pra todos os
 * planos, uma cor por plano quando é exclusivo de um só, e um cinza
 * neutro pra combinações de 2 planos (caso raro, sem cor própria
 * pedida). */
const PLAN_DOT_COLORS: Record<ActivityPlanScope, string> = {
  validacao: 'bg-sky-400',
  escala: 'bg-amber-400',
  dominacao: 'bg-purple-700',
}

function dotColorForScope(planScope: ActivityPlanScope[] | null | undefined): string {
  const scope = planScope && planScope.length > 0 ? planScope : ALL_PLANS
  if (scope.length >= 3) return 'bg-purple-400'
  if (scope.length === 1) return PLAN_DOT_COLORS[scope[0]]
  return 'bg-slate-400'
}

function dotTitleForScope(planScope: ActivityPlanScope[] | null | undefined): string {
  const scope = planScope && planScope.length > 0 ? planScope : ALL_PLANS
  if (scope.length >= 3) return 'Aplicado em todos os planos'
  return 'Exclusivo de ' + scope.map((plan) => planLabels[plan]).join(' + ')
}

/** Fase 31/31b — item exclusivo de Meta OU Google (só faz diferença pra
 * clientes Validação, ver `Activities.tsx`) ganha uma tag discreta ao
 * lado do título — separado da bolinha, que já indica o plano. Os 2
 * marcados (ou ausente) não ganha tag nenhuma (universal). */
const PLATFORM_TAG_LABELS: Record<ActivityPlatformScope, string> = {
  meta: 'Meta',
  google: 'Google',
}

function platformTagFor(platformScope: ActivityPlatformScope[] | null | undefined): string | null {
  if (!platformScope || platformScope.length !== 1) return null
  return PLATFORM_TAG_LABELS[platformScope[0]]
}

interface ActivityTemplateCardProps {
  template: ActivityTemplateRecord
  deleteMode?: boolean
  canEdit?: boolean
  /** Nomes dos Workflows Operacionais que disparam esse Workflow de
   * Atividades ao serem aplicados (ver `activity_template_ids` em
   * `WorkflowTemplateRecord`) — só pra visibilidade, não é salvo aqui. */
  linkedWorkflowNames?: string[]
}

export function ActivityTemplateCard({ template, deleteMode, canEdit, linkedWorkflowNames }: ActivityTemplateCardProps) {
  const deleteTemplate = useDeleteActivityTemplate()
  const setDefault = useSetDefaultActivityTemplate()
  const unsetDefault = useUnsetDefaultActivityTemplate()

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
              <ActivityTemplateFormDialog
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
        {template.is_default && (
          <Badge className="w-fit border-purple-600/20 bg-purple-600/15 text-purple-400">Padrão no cadastro</Badge>
        )}
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <WorkflowIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {linkedWorkflowNames && linkedWorkflowNames.length > 0
            ? `Vinculado a: ${linkedWorkflowNames.join(', ')}`
            : 'Nenhum Workflow Operacional vinculado ainda'}
        </p>
        <p className="text-xs text-muted-foreground">{summarizePlanScope(template.items)}</p>
        <ul className="space-y-1.5">
          {template.items.map((item) => {
            const platformTag = platformTagFor(item.platform_scope)
            return (
              <li key={item.title} className="flex items-center gap-2 text-sm text-foreground">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotColorForScope(item.plan_scope)}`}
                  title={dotTitleForScope(item.plan_scope)}
                />
                <span className="min-w-0">{item.title}</span>
                {platformTag && (
                  <Badge className="shrink-0 border-[#1A2540] bg-secondary/50 text-[10px] text-muted-foreground">
                    {platformTag}
                  </Badge>
                )}
                {item.recurrence && (
                  <Badge className="shrink-0 gap-1 border-purple-600/20 bg-purple-600/10 text-[10px] text-purple-300">
                    <Repeat className="h-2.5 w-2.5" />
                    {recurrenceShortLabels[item.recurrence]}
                  </Badge>
                )}
              </li>
            )
          })}
        </ul>
        {canEdit && (
          <div className="mt-auto pt-2">
            {template.is_default ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={unsetDefault.isPending}
                onClick={() => unsetDefault.mutate(template.id)}
              >
                <StarOff className="h-4 w-4" />
                Remover como padrão
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                disabled={setDefault.isPending}
                onClick={() => setDefault.mutate(template.id)}
              >
                <Star className="h-4 w-4" />
                Marcar como padrão
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
