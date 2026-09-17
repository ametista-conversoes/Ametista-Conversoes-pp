import { useState, type ReactNode } from 'react'
import { Repeat, RotateCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { formatDate } from '@/lib/format'

export interface RecurringTaskItem {
  id: string
  title: string
  clientName: string | null
  recurrenceLabel: string
  /** Já calculado por quem chama (`daysUntilRecurrenceDue`) — não
   * recalcula aqui pra não duplicar a mesma conta em 2 lugares. */
  daysUntilDue: number
  dueAt: string
}

interface RecurringTasksDialogProps {
  trigger: ReactNode
  tasks: RecurringTaskItem[]
  onReopenNow: (id: string) => Promise<void>
}

function dueLabel(days: number): string {
  if (days <= 0) return 'Vence hoje'
  if (days === 1) return 'Vence amanhã'
  return `Vence em ${days} dias`
}

/** Fase 36.2 — item recorrente concluído (ver `isCompletionStale`/
 * `Activities.tsx`/`ManagerClientTasks.tsx`) some da lista principal
 * assim que é marcado, direto pra cá, em vez de ficar ocupando espaço
 * riscado até vencer sozinho — pedido do usuário depois de notar que
 * Atividades acumula tanto ou mais que o Kanban e que o badge de
 * recorrência não mostrava quando ia vencer de novo. Nunca é um
 * "arquivamento" de verdade (não mexe em nenhuma coluna nova no banco,
 * não precisa restaurar) — a mesma linha já vai voltar sozinha pra lista
 * principal no instante em que a recorrência vencer (Fase 35); "Reabrir
 * agora" só adianta isso manualmente, reaproveitando a troca de
 * status/checkbox normal. Ordenado do que vence mais cedo pro que vence
 * mais tarde. */
export function RecurringTasksDialog({ trigger, tasks, onReopenNow }: RecurringTasksDialogProps) {
  const [pendingId, setPendingId] = useState<string | null>(null)

  const sorted = [...tasks].sort((a, b) => a.daysUntilDue - b.daysUntilDue)

  async function handleReopen(id: string) {
    setPendingId(id)
    try {
      await onReopenNow(id)
    } finally {
      setPendingId(null)
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tarefas recorrentes concluídas</DialogTitle>
          <DialogDescription>
            Saem da lista principal assim que concluídas — voltam sozinhas quando vencer de novo, sem precisar de
            nenhuma ação aqui. "Reabrir agora" só adianta isso.
          </DialogDescription>
        </DialogHeader>

        {sorted.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma tarefa recorrente concluída agora.</p>}

        <div className="space-y-2">
          {sorted.map((task) => (
            <div key={task.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-secondary/50 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  {task.clientName ?? 'Sem cliente'}
                  <Badge className="gap-1 border-purple-600/20 bg-purple-600/10 text-[10px] text-purple-300">
                    <Repeat className="h-2.5 w-2.5" />
                    {task.recurrenceLabel}
                  </Badge>
                  <span className="text-muted-foreground/70">
                    {dueLabel(task.daysUntilDue)} ({formatDate(task.dueAt)})
                  </span>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                aria-label={`Reabrir "${task.title}" agora`}
                disabled={pendingId === task.id}
                onClick={() => handleReopen(task.id)}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
