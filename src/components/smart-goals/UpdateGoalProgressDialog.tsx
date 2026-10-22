import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ManagerSmartGoalRecord } from '@/hooks/useManagerPortalData'
import { useUpdateSmartGoalProgress } from '@/hooks/useManagerPortalData'
import { isAutoGoalMetric } from '@/lib/goal-progress'
import { smartGoalStatusLabels } from '@/lib/status-styles'

const updateProgressSchema = z.object({
  currentValue: z
    .string()
    .min(1, 'Digite o valor atual')
    .refine((value) => !Number.isNaN(Number(value)) && Number(value) >= 0, 'Digite um número válido'),
  status: z.enum(['on_track', 'at_risk', 'off_track', 'completed']),
})

type UpdateProgressValues = z.infer<typeof updateProgressSchema>

interface UpdateGoalProgressDialogProps {
  goal: ManagerSmartGoalRecord
  /** Botão menor, pra caber numa linha da lista do funil. */
  compact?: boolean
}

/** Fase 54 — métrica automática (o app mede): o valor atual é recalculado
 * pelo banco de hora em hora, então aqui só o status é editável. Métrica
 * manual (Ticket Médio, "Outro"...): valor atual + status, como antes. */
export function UpdateGoalProgressDialog({ goal, compact }: UpdateGoalProgressDialogProps) {
  const [open, setOpen] = useState(false)
  const updateProgress = useUpdateSmartGoalProgress()
  const auto = isAutoGoalMetric(goal.metric_type)

  const defaults = (): UpdateProgressValues => ({
    currentValue: String(goal.current_value ?? 0),
    status: (goal.status as UpdateProgressValues['status']) ?? 'on_track',
  })
  const form = useForm<UpdateProgressValues>({
    resolver: zodResolver(updateProgressSchema),
    defaultValues: defaults(),
  })

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) form.reset(defaults())
  }

  async function onSubmit(values: UpdateProgressValues) {
    try {
      await updateProgress.mutateAsync({
        goalId: goal.id,
        // Automática: mantém o valor calculado pelo banco.
        currentValue: auto ? (goal.current_value ?? 0) : Number(values.currentValue),
        status: values.status,
      })
      setOpen(false)
    } catch {
      // erro já avisado pelo onError do hook
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="secondary" size={compact ? 'sm' : 'default'} className={compact ? '' : 'w-full'}>
          {auto ? 'Atualizar status' : 'Atualizar progresso'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Atualizar "{goal.title}"</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {auto ? (
              <p className="text-sm text-muted-foreground">
                O valor atual desta meta é calculado automaticamente pelo app (mês corrente, atualizado de hora em
                hora). Aqui você só ajusta o status.
              </p>
            ) : (
              <FormField
                control={form.control}
                name="currentValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor atual</FormLabel>
                    <FormControl>
                      <Input type="number" step="any" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(smartGoalStatusLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
