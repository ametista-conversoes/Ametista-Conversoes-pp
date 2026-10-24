import { useState } from 'react'
import { CheckSquare } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DeleteItemButton } from '@/components/shared/DeleteItemButton'
import { ItemDetailsButton } from '@/components/workflows/ItemDetailsButton'
import type { TaskRecord } from '@/hooks/useClientPortalData'
import { formatDate, getTodayIsoDate } from '@/lib/format'
import { taskPriorityLabels, taskStatusLabels, taskStatusStyles } from '@/lib/status-styles'
import { cn } from '@/lib/utils'
import { TaskDetailDialog } from './TaskDetailDialog'

const CHANGEABLE_STATUSES = ['backlog', 'todo', 'in_progress', 'review'] as const

interface TaskListProps {
  tasks: TaskRecord[]
  title?: string
  /** Quando true, mostra o checkbox de conclusão e o menu de status. */
  interactive?: boolean
  onToggleDone?: (taskId: string, done: boolean) => void
  onChangeStatus?: (taskId: string, status: string) => void
  updatingTaskId?: string | null
  deleteMode?: boolean
  onDelete?: (taskId: string) => Promise<void>
}

export function TaskList({
  tasks,
  title = 'Tarefas do projeto',
  interactive = false,
  onToggleDone,
  onChangeStatus,
  updatingTaskId = null,
  deleteMode = false,
  onDelete,
}: TaskListProps) {
  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null)

  return (
    <Card className="rounded-xl border border-[#1A2540] bg-[#131C31] p-5 hover:border-purple-600/30 md:p-6">
      <CardHeader className="p-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckSquare className="h-4 w-4 text-purple-400" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-0 pt-4">
        {tasks.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma tarefa cadastrada.</p>}
        {tasks.map((task) => {
          const isDone = task.status === 'done'
          const isUpdating = updatingTaskId === task.id
          const isOverdue = task.status !== 'done' && !!task.due_date && task.due_date < getTodayIsoDate()
          return (
            <div
              key={task.id}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-lg bg-secondary/50 px-3 py-2',
                isOverdue && 'opacity-60 grayscale-[0.5] border border-red-500/40',
              )}
              onClick={() => setSelectedTask(task)}
            >
              {interactive && (
                <span onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={isDone}
                    disabled={isUpdating}
                    onCheckedChange={(checked) => onToggleDone?.(task.id, checked === true)}
                  />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className={`flex items-center gap-1 text-sm font-medium ${isDone ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                  <span className="truncate">{task.title}</span>
                  <ItemDetailsButton title={task.title} details={task.details} />
                </p>
                <p className="text-xs text-muted-foreground">
                  {taskPriorityLabels[task.priority] ?? task.priority} · Prazo: {formatDate(task.due_date)}
                  {task.category ? ` · ${task.category}` : ''}
                </p>
              </div>
              {interactive ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild disabled={isUpdating} onClick={(e) => e.stopPropagation()}>
                    <Badge className={`cursor-pointer ${taskStatusStyles[task.status]}`}>
                      {taskStatusLabels[task.status] ?? task.status}
                    </Badge>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    {CHANGEABLE_STATUSES.map((status) => (
                      <DropdownMenuItem key={status} onSelect={() => onChangeStatus?.(task.id, status)}>
                        {taskStatusLabels[status]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Badge className={taskStatusStyles[task.status]}>{taskStatusLabels[task.status] ?? task.status}</Badge>
              )}
              {deleteMode && onDelete && (
                <DeleteItemButton label={`a tarefa "${task.title}"`} onDelete={() => onDelete(task.id)} />
              )}
            </div>
          )
        })}
      </CardContent>

      <TaskDetailDialog task={selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)} />
    </Card>
  )
}
