import { Pencil, Repeat } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DeleteItemButton } from '@/components/shared/DeleteItemButton'
import { ClientTaskFormDialog } from './ClientTaskFormDialog'
import type { ManagerClientTaskRecord } from '@/hooks/useManagerPortalData'
import { useDeleteManagerClientTask, useUpdateClientTaskStatusAsManager } from '@/hooks/useManagerPortalData'
import { formatDate, getTodayIsoDate } from '@/lib/format'
import { effectiveTaskStatus, recurrenceShortLabels, type RecurrenceInterval } from '@/lib/recurrence'
import { taskPriorityLabels, taskStatusLabels, taskStatusStyles } from '@/lib/status-styles'
import { cn } from '@/lib/utils'

const CHANGEABLE_STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'done'] as const

interface ManagerClientTaskRowProps {
  task: ManagerClientTaskRecord
  showClientName?: boolean
  deleteMode?: boolean
}

/** Linha de tarefa pra "Tarefas do Cliente" (`/client-tasks`, Fase
 * 35.1) — mesmo visual de `ManagerTaskRow.tsx` (Kanban), mas lendo
 * `client_tasks`: é isso que o cliente vê/cria/completa em `/tasks`
 * (Portal Cliente) e o que "Workflows do Cliente" aplica, nunca o
 * Kanban interno. Status "efetivo" já considera recorrência (Fase 35) —
 * uma tarefa recorrente concluída volta a aparecer como "A Fazer"
 * sozinha quando o intervalo vence. */
export function ManagerClientTaskRow({ task, showClientName, deleteMode }: ManagerClientTaskRowProps) {
  const updateStatus = useUpdateClientTaskStatusAsManager()
  const deleteTask = useDeleteManagerClientTask()

  const status = effectiveTaskStatus(task.status, task.recurrence_interval, task.completed_at, task.client?.plan ?? null)
  const isOverdue = status !== 'done' && !!task.due_date && task.due_date < getTodayIsoDate()

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-lg bg-secondary/50 px-3 py-2',
        isOverdue && 'opacity-60 grayscale-[0.5] border border-red-500/40',
      )}
    >
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm font-medium', status === 'done' ? 'text-muted-foreground line-through' : 'text-foreground')}>
          {task.title}
        </p>
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {showClientName && (task.client?.name ?? 'Sem cliente')}
          {task.category ? ` · ${task.category}` : ''}
          {task.due_date ? ` · Prazo: ${formatDate(task.due_date)}` : ''}
          {task.recurrence_interval && (
            <Badge className="gap-1 border-purple-600/20 bg-purple-600/10 text-[10px] text-purple-300">
              <Repeat className="h-2.5 w-2.5" />
              {recurrenceShortLabels[task.recurrence_interval as RecurrenceInterval]}
            </Badge>
          )}
        </p>
      </div>

      <Badge className="border-[#1A2540] bg-secondary/50 text-muted-foreground">
        {taskPriorityLabels[task.priority] ?? task.priority}
      </Badge>

      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={updateStatus.isPending}>
          <Badge className={`cursor-pointer ${taskStatusStyles[status]}`}>{taskStatusLabels[status] ?? status}</Badge>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {CHANGEABLE_STATUSES.map((s) => (
            <DropdownMenuItem key={s} onSelect={() => updateStatus.mutate({ taskId: task.id, status: s })}>
              {taskStatusLabels[s]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <ClientTaskFormDialog
        task={task}
        trigger={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            aria-label={`Editar ${task.title}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        }
      />

      {deleteMode && (
        <DeleteItemButton label={`a tarefa "${task.title}"`} onDelete={() => deleteTask.mutateAsync(task.id)} />
      )}
    </div>
  )
}
