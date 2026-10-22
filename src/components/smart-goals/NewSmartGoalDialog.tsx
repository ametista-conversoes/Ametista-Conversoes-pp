import { useState } from 'react'
import { Plus } from 'lucide-react'
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
import { DatePicker } from '@/components/ui/date-picker'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAllClients, useCreateSmartGoal } from '@/hooks/useManagerPortalData'
import { getTodayIsoDate } from '@/lib/format'
import { isAutoGoalMetric, isLowerBetterMetric } from '@/lib/goal-progress'
import { smartGoalMetricLabels, smartGoalStatusLabels } from '@/lib/status-styles'

const METRIC_OTHER = 'other'
const TODAY = getTodayIsoDate()

const newGoalSchema = z
  .object({
    title: z.string().min(2, 'Digite um título'),
    clientId: z.string().min(1, 'Escolha um cliente'),
    metricType: z.string().optional(),
    metricTypeOther: z.string().optional(),
    targetValue: z
      .string()
      .min(1, 'Digite o valor alvo')
      .refine((value) => !Number.isNaN(Number(value)) && Number(value) >= 0, 'Digite um número válido'),
    currentValue: z
      .string()
      .optional()
      .refine((value) => !value || (!Number.isNaN(Number(value)) && Number(value) >= 0), 'Digite um número válido'),
    targetDate: z.string().optional(),
    status: z.enum(['on_track', 'at_risk', 'off_track', 'completed']),
  })
  .refine(
    (values) => {
      const target = Number(values.targetValue)
      const current = values.currentValue?.trim() ? Number(values.currentValue) : 0
      return Number.isNaN(target) || target !== current
    },
    { message: 'meta com valor alvo igual a atual, meta inválida', path: ['currentValue'] },
  )
  .refine((values) => !values.targetDate?.trim() || values.targetDate >= TODAY, {
    message: 'O prazo não pode ser no passado',
    path: ['targetDate'],
  })

type NewGoalValues = z.infer<typeof newGoalSchema>

export function NewSmartGoalDialog() {
  const [open, setOpen] = useState(false)
  const { data: clients } = useAllClients()
  const createGoal = useCreateSmartGoal()

  const form = useForm<NewGoalValues>({
    resolver: zodResolver(newGoalSchema),
    defaultValues: {
      title: '',
      clientId: '',
      metricType: '',
      metricTypeOther: '',
      targetValue: '',
      currentValue: '',
      targetDate: '',
      status: 'on_track',
    },
  })

  const selectedMetric = form.watch('metricType')

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) form.reset()
  }

  async function onSubmit(values: NewGoalValues) {
    try {
      const metricType =
        values.metricType === METRIC_OTHER
          ? values.metricTypeOther?.trim() || null
          : values.metricType?.trim() || null

      await createGoal.mutateAsync({
        title: values.title,
        client_id: values.clientId,
        metric_type: metricType,
        target_value: Number(values.targetValue),
        current_value: !isAutoGoalMetric(metricType) && values.currentValue?.trim() ? Number(values.currentValue) : 0,
        target_date: values.targetDate?.trim() ? values.targetDate : null,
        status: values.status,
      })
      form.reset()
      setOpen(false)
    } catch {
      // erro já avisado pelo onError do hook
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          Nova meta
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova meta SMART</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Aumentar ROAS para 4x" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cliente</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um cliente" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(clients ?? []).map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="metricType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Métrica (opcional)</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma métrica" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(smartGoalMetricLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                      <SelectItem value={METRIC_OTHER}>Outro</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedMetric === METRIC_OTHER && (
              <FormField
                control={form.control}
                name="metricTypeOther"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Qual métrica?</FormLabel>
                    <FormControl>
                      <Input placeholder="Digite o nome da métrica" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="targetValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{isLowerBetterMetric(selectedMetric) ? 'Valor alvo (até)' : 'Valor alvo'}</FormLabel>
                    <FormControl>
                      <Input type="number" step="any" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isAutoGoalMetric(selectedMetric) ? (
                <p className="self-end text-xs text-muted-foreground">
                  Valor atual calculado automaticamente pelo app (mês corrente, de hora em hora).
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
            </div>

            <FormField
              control={form.control}
              name="targetDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prazo (opcional)</FormLabel>
                  <FormControl>
                    <DatePicker value={field.value} onChange={field.onChange} minDate={TODAY} />
                  </FormControl>
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
                {form.formState.isSubmitting ? 'Criando...' : 'Criar meta'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
