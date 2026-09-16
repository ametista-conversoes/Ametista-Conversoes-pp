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
import { useClientAdConversions, useClientLeadStatusCounts, useUpdateSmartGoalProgress } from '@/hooks/useManagerPortalData'
import { adConversionsLabel, isLeadCountMetric, leadCountForMetric, leadCountLabel } from '@/lib/lead-metrics'
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
}

export function UpdateGoalProgressDialog({ goal }: UpdateGoalProgressDialogProps) {
  const [open, setOpen] = useState(false)
  const updateProgress = useUpdateSmartGoalProgress()
  const isLeadMetric = isLeadCountMetric(goal.metric_type)
  const leadCounts = useClientLeadStatusCounts(isLeadMetric && open ? goal.client_id : null)
  const realCount = leadCountForMetric(goal.metric_type, leadCounts.data)

  const adConversionsMetric = adConversionsLabel(goal.metric_type)
  const adConversions = useClientAdConversions(adConversionsMetric && open ? goal.client_id : null)

  const form = useForm<UpdateProgressValues>({
    resolver: zodResolver(updateProgressSchema),
    defaultValues: {
      currentValue: String(goal.current_value ?? 0),
      status: (goal.status as UpdateProgressValues['status']) ?? 'on_track',
    },
  })

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      form.reset({
        currentValue: String(goal.current_value ?? 0),
        status: (goal.status as UpdateProgressValues['status']) ?? 'on_track',
      })
    }
  }

  async function onSubmit(values: UpdateProgressValues) {
    try {
      await updateProgress.mutateAsync({
        goalId: goal.id,
        currentValue: Number(values.currentValue),
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
        <Button variant="secondary" className="w-full">
          Atualizar progresso
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Atualizar "{goal.title}"</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="currentValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor atual</FormLabel>
                  <FormControl>
                    <Input type="number" step="any" {...field} />
                  </FormControl>
                  {realCount != null && (
                    <button
                      type="button"
                      className="text-xs text-purple-300 underline decoration-dotted hover:text-purple-400"
                      onClick={() => form.setValue('currentValue', String(realCount), { shouldDirty: true })}
                    >
                      Usar {leadCountLabel(goal.metric_type).toLowerCase()}: {realCount}
                    </button>
                  )}
                  {adConversionsMetric && adConversions.data?.hasLinkedCampaigns && (
                    <button
                      type="button"
                      className="block text-xs text-purple-300 underline decoration-dotted hover:text-purple-400"
                      onClick={() =>
                        form.setValue('currentValue', String(adConversions.data!.conversions), { shouldDirty: true })
                      }
                    >
                      Usar {adConversionsMetric.toLowerCase()}: {adConversions.data.conversions}
                    </button>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

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
