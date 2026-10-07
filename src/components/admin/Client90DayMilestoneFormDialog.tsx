import { useState, type ReactNode } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { Client90DayMilestoneRecord } from '@/hooks/useManagerPortalData'
import { useCreateClient90DayMilestone, useUpdateClient90DayMilestone } from '@/hooks/useManagerPortalData'
import { milestone90dStatusLabels } from '@/lib/status-styles'

const formSchema = z.object({
  title: z.string().min(2, 'Digite um título'),
  entry_date: z.string().min(1, 'Escolha uma data'),
  start_date: z.string().optional(),
  status: z.enum(['pendente', 'em_andamento', 'concluido', 'atrasado']),
  note: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

const EMPTY_VALUES: FormValues = { title: '', entry_date: '', start_date: '', status: 'pendente', note: '' }

interface Client90DayMilestoneFormDialogProps {
  trigger: ReactNode
  clientId: string
  milestone?: Client90DayMilestoneRecord
}

/** Diálogo de criar OU editar 1 marco do Plano de 90 dias (Fase 48.5) —
 * registro leve de progresso (data + título + status + nota), não o
 * documento completo de 10 seções (que continua manual/externo). */
export function Client90DayMilestoneFormDialog({ trigger, clientId, milestone }: Client90DayMilestoneFormDialogProps) {
  const [open, setOpen] = useState(false)
  const createMilestone = useCreateClient90DayMilestone()
  const updateMilestone = useUpdateClient90DayMilestone()
  const isEdit = !!milestone

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: EMPTY_VALUES })

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      form.reset(
        milestone
          ? {
              title: milestone.title,
              entry_date: milestone.entry_date,
              start_date: milestone.start_date ?? '',
              status: milestone.status,
              note: milestone.note ?? '',
            }
          : EMPTY_VALUES,
      )
    }
  }

  async function onSubmit(values: FormValues) {
    const input = {
      client_id: clientId,
      title: values.title,
      entry_date: values.entry_date,
      start_date: values.start_date?.trim() ? values.start_date : null,
      status: values.status,
      note: values.note?.trim() ? values.note.trim() : null,
    }
    try {
      if (milestone) {
        await updateMilestone.mutateAsync({ id: milestone.id, ...input })
        toast.success('Marco atualizado.')
      } else {
        await createMilestone.mutateAsync(input)
        toast.success('Marco criado.')
      }
      setOpen(false)
    } catch {
      // erro já avisado pelo onError do hook
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar marco' : 'Novo marco do Plano de 90 dias'}</DialogTitle>
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
                    <Input placeholder="Ex: Campanhas no ar" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="entry_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data do marco</FormLabel>
                    <FormControl>
                      <DatePicker value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dia 0 do plano (opcional)</FormLabel>
                    <FormControl>
                      <DatePicker value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
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
                      {Object.entries(milestone90dStatusLabels).map(([value, label]) => (
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
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nota (opcional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Detalhe curto, se precisar..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar marco'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
