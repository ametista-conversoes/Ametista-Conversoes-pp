import { useState, type ReactNode } from 'react'
import { RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { formatDateTime } from '@/lib/format'

export interface ArchivedTaskItem {
  id: string
  title: string
  clientName: string | null
}

interface ArchivedTasksDialogProps {
  trigger: ReactNode
  tasks: ArchivedTaskItem[]
  archivedAtById: Record<string, string | null>
  onRestore: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

/** Fase 36 — lista as tarefas que `archive_stale_completed_tasks` (ou o
 * próprio gestor, arquivando à mão — não incluído ainda) tirou da lista
 * padrão. Arquivar nunca é apagar: aqui dá pra "Restaurar" (volta pra
 * lista normal) ou "Apagar definitivamente" (com confirmação, igual
 * `DeleteItemButton`). Reaproveitado pelo Kanban e por "Tarefas do
 * Cliente" — as duas telas só passam listas/tabelas diferentes. */
export function ArchivedTasksDialog({ trigger, tasks, archivedAtById, onRestore, onDelete }: ArchivedTasksDialogProps) {
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  async function handleRestore(id: string) {
    setPendingId(id)
    try {
      await onRestore(id)
    } finally {
      setPendingId(null)
    }
  }

  async function handleDelete(id: string) {
    setPendingId(id)
    try {
      await onDelete(id)
      setConfirmDeleteId(null)
    } finally {
      setPendingId(null)
    }
  }

  return (
    <Dialog onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tarefas arquivadas</DialogTitle>
          <DialogDescription>
            Concluídas há mais de 30 dias são arquivadas automaticamente pra não acumular na lista principal.
            Restaure ou apague em definitivo quando quiser.
          </DialogDescription>
        </DialogHeader>

        {tasks.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma tarefa arquivada.</p>}

        <div className="space-y-2">
          {tasks.map((task) => (
            <div key={task.id} className="rounded-lg bg-secondary/50 px-3 py-2">
              {confirmDeleteId === task.id ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-foreground">Apagar "{task.title}" pra sempre?</p>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)}>
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={pendingId === task.id}
                      onClick={() => handleDelete(task.id)}
                    >
                      {pendingId === task.id ? 'Apagando...' : 'Apagar'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {task.clientName ?? 'Sem cliente'} · Arquivada em {formatDateTime(archivedAtById[task.id] ?? null)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      aria-label={`Restaurar ${task.title}`}
                      disabled={pendingId === task.id}
                      onClick={() => handleRestore(task.id)}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={`Apagar ${task.title} pra sempre`}
                      onClick={() => setConfirmDeleteId(task.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
