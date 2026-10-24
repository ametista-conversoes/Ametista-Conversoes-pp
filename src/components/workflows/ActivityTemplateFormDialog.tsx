import { useState, type ReactNode } from 'react'
import { closestCenter, DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import { zodResolver } from '@hookform/resolvers/zod'
import { type Control, useFieldArray, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { ActivityPlanScope, ActivityPlatformScope, ActivityTemplateRecord } from '@/hooks/useManagerPortalData'
import { useCreateActivityTemplate, useUpdateActivityTemplate } from '@/hooks/useManagerPortalData'
import { RECURRENCE_NONE_VALUE, RECURRENCE_OPTIONS, recurrenceLabels, type RecurrenceInterval } from '@/lib/recurrence'
import { planLabels } from '@/lib/status-styles'
import { DetailsToggleField } from './DetailsToggleField'

const PLAN_SCOPE_OPTIONS: ActivityPlanScope[] = ['validacao', 'escala', 'dominacao']
const ALL_PLANS: ActivityPlanScope[] = [...PLAN_SCOPE_OPTIONS]

const PLATFORM_SCOPE_OPTIONS: ActivityPlatformScope[] = ['meta', 'google']
const ALL_PLATFORMS: ActivityPlatformScope[] = [...PLATFORM_SCOPE_OPTIONS]

const PLATFORM_SCOPE_LABELS: Record<ActivityPlatformScope, string> = {
  meta: 'Meta Ads',
  google: 'Google Ads',
}

const templateFormSchema = z.object({
  name: z.string().min(2, 'Digite um nome'),
  description: z.string().optional(),
  items: z
    .array(
      z.object({
        title: z.string().min(1, 'Digite o título do item'),
        category: z.string().optional(),
        planScope: z.array(z.enum(['validacao', 'escala', 'dominacao'])).min(1, 'Marque pelo menos um plano'),
        platformScope: z.array(z.enum(['meta', 'google'])).min(1, 'Marque pelo menos uma plataforma'),
        recurrence: z.string(),
        details: z.string().optional(),
      }),
    )
    .min(1, 'Adicione pelo menos um item'),
})

type TemplateFormValues = z.infer<typeof templateFormSchema>

const EMPTY_VALUES: TemplateFormValues = {
  name: '',
  description: '',
  items: [
    { title: '', category: '', planScope: ALL_PLANS, platformScope: ALL_PLATFORMS, recurrence: RECURRENCE_NONE_VALUE, details: '' },
  ],
}

interface SortableActivityItemRowProps {
  id: string
  index: number
  control: Control<TemplateFormValues>
  onRemove: () => void
  disableRemove: boolean
}

function SortableActivityItemRow({ id, index, control, onRemove, disableRemove }: SortableActivityItemRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }

  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-2 rounded-lg bg-secondary/50 p-3">
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="mt-2 shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        aria-label="Arrastar para reordenar"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 space-y-2">
        <FormField
          control={control}
          name={`items.${index}.title`}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input placeholder="Título do item" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`items.${index}.category`}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input placeholder="Categoria (opcional)" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`items.${index}.details`}
          render={({ field }) => <DetailsToggleField value={field.value} onChange={field.onChange} />}
        />
        <FormField
          control={control}
          name={`items.${index}.planScope`}
          render={({ field }) => (
            <FormItem>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Plano</p>
              <div className="flex flex-wrap gap-3">
                {PLAN_SCOPE_OPTIONS.map((plan) => (
                  <label key={plan} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Checkbox
                      checked={field.value?.includes(plan)}
                      onCheckedChange={(checked) => {
                        const current = field.value ?? []
                        field.onChange(checked === true ? [...current, plan] : current.filter((p) => p !== plan))
                      }}
                    />
                    {planLabels[plan]}
                  </label>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`items.${index}.platformScope`}
          render={({ field }) => (
            <FormItem className="border-t border-[#1A2540] pt-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Plataforma</p>
              <div className="flex flex-wrap gap-3">
                {PLATFORM_SCOPE_OPTIONS.map((platform) => (
                  <label key={platform} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Checkbox
                      checked={field.value?.includes(platform)}
                      onCheckedChange={(checked) => {
                        const current = field.value ?? []
                        field.onChange(
                          checked === true ? [...current, platform] : current.filter((p) => p !== platform),
                        )
                      }}
                    />
                    {PLATFORM_SCOPE_LABELS[platform]}
                  </label>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`items.${index}.recurrence`}
          render={({ field }) => (
            <FormItem className="border-t border-[#1A2540] pt-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Recorrência</p>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="h-8 w-full sm:w-64">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={RECURRENCE_NONE_VALUE}>Única (não repete)</SelectItem>
                  {RECURRENCE_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {recurrenceLabels[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="shrink-0 text-muted-foreground hover:text-destructive"
        disabled={disableRemove}
        onClick={onRemove}
        aria-label={`Remover item ${index + 1}`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}

interface ActivityTemplateFormDialogProps {
  trigger: ReactNode
  template?: ActivityTemplateRecord
}

/** Diálogo de criar OU editar um Workflow de Atividades (Fase 6.6.2) —
 * checklist reutilizável de itens de texto simples (sem prazo, sem
 * vínculo com integrações reais). */
export function ActivityTemplateFormDialog({ trigger, template }: ActivityTemplateFormDialogProps) {
  const [open, setOpen] = useState(false)
  const createTemplate = useCreateActivityTemplate()
  const updateTemplate = useUpdateActivityTemplate()
  const isEdit = !!template

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: EMPTY_VALUES,
  })

  const { fields, append, remove, move } = useFieldArray({ control: form.control, name: 'items' })

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = fields.findIndex((f) => f.id === active.id)
    const newIndex = fields.findIndex((f) => f.id === over.id)
    if (oldIndex !== -1 && newIndex !== -1) move(oldIndex, newIndex)
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      form.reset(
        template
          ? {
              name: template.name,
              description: template.description ?? '',
              items: template.items.map((item) => ({
                title: item.title,
                category: item.category ?? '',
                planScope: item.plan_scope && item.plan_scope.length > 0 ? item.plan_scope : ALL_PLANS,
                platformScope:
                  item.platform_scope && item.platform_scope.length > 0 ? item.platform_scope : ALL_PLATFORMS,
                recurrence: item.recurrence ?? RECURRENCE_NONE_VALUE,
                details: item.details ?? '',
              })),
            }
          : EMPTY_VALUES,
      )
    }
  }

  async function onSubmit(values: TemplateFormValues) {
    const input = {
      name: values.name,
      description: values.description?.trim() ? values.description.trim() : null,
      items: values.items.map((item) => ({
        title: item.title,
        category: item.category?.trim() ? item.category.trim() : null,
        plan_scope: item.planScope,
        platform_scope: item.platformScope,
        recurrence: item.recurrence === RECURRENCE_NONE_VALUE ? null : (item.recurrence as RecurrenceInterval),
        ...(item.details?.trim() ? { details: item.details.trim() } : {}),
      })),
    }
    try {
      if (template) {
        await updateTemplate.mutateAsync({ id: template.id, ...input })
        toast.success('Workflow de Atividades atualizado.')
      } else {
        await createTemplate.mutateAsync(input)
        toast.success('Workflow de Atividades criado.')
      }
      setOpen(false)
    } catch {
      // erro já avisado pelo onError do hook
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Workflow de Atividades' : 'Novo Workflow de Atividades'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Checklist de Criação de Ativos" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição (opcional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Quando usar este checklist..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <Label>Itens do checklist</Label>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-3">
                    {fields.map((fieldItem, index) => (
                      <SortableActivityItemRow
                        key={fieldItem.id}
                        id={fieldItem.id}
                        index={index}
                        control={form.control}
                        onRemove={() => remove(index)}
                        disableRemove={fields.length === 1}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() =>
                  append({
                    title: '',
                    category: '',
                    planScope: ALL_PLANS,
                    platformScope: ALL_PLATFORMS,
                    recurrence: RECURRENCE_NONE_VALUE,
                    details: '',
                  })
                }
              >
                <Plus className="h-4 w-4" />
                Adicionar item
              </Button>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar modelo'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
