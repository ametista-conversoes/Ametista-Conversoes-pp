import { useState } from 'react'
import { Archive, CheckSquare, Plus, RotateCw, Search } from 'lucide-react'
import { ArchivedTasksDialog } from '@/components/tasks/ArchivedTasksDialog'
import { ClientTaskFormDialog } from '@/components/tasks/ClientTaskFormDialog'
import { ManagerClientTaskRow } from '@/components/tasks/ManagerClientTaskRow'
import { RecurringTasksDialog, type RecurringTaskItem } from '@/components/tasks/RecurringTasksDialog'
import { DeleteModeToggle } from '@/components/shared/DeleteModeToggle'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  useAllClients,
  useAllClientTasks,
  useArchivedClientTasks,
  useAutoArchiveOldTasks,
  useDeleteManagerClientTask,
  useRestoreManagerClientTask,
  useUpdateClientTaskStatusAsManager,
} from '@/hooks/useManagerPortalData'
import { daysUntilRecurrenceDue, effectiveTaskStatus, recurrenceDueAt, recurrenceLabels } from '@/lib/recurrence'

const ALL_CLIENTS = 'all'

/** "Tarefas do Cliente" (Fase 6.5.3, corrigida na Fase 35.1) — mostra o
 * que o CLIENTE cria/completa em `/tasks` (Portal Cliente) e o que
 * "Workflows do Cliente" aplica (`client_tasks`), nunca o Kanban
 * interno da agência — esse é o propósito original da página, que
 * durante a Fase 30 (separação client_tasks/tasks) acabou ficando presa
 * lendo `public.tasks` filtrado por cliente por engano. */
export default function ManagerClientTasks() {
  useAutoArchiveOldTasks()
  const { data: clients } = useAllClients()
  const { data: tasks, isLoading } = useAllClientTasks()
  const { data: archivedTasks } = useArchivedClientTasks()
  const deleteTask = useDeleteManagerClientTask()
  const restoreTask = useRestoreManagerClientTask()
  const updateStatus = useUpdateClientTaskStatusAsManager()
  const [clientFilter, setClientFilter] = useState(ALL_CLIENTS)
  const [deleteMode, setDeleteMode] = useState(false)
  const [search, setSearch] = useState('')

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando...</p>
  }

  async function handleReopenNow(taskId: string) {
    await updateStatus.mutateAsync({ taskId, status: 'todo' })
  }

  // Fase 36.2 — tarefa recorrente concluída sai da lista principal assim
  // que marcada (mesma ideia de Activities.tsx), com a contagem
  // regressiva até vencer de novo — não fica riscada ocupando espaço.
  // Junta de TODOS os clientes, sem respeitar o filtro/busca da página
  // (mesmo espírito de "Arquivadas").
  const recurringDormantTasks: RecurringTaskItem[] = (tasks ?? []).flatMap((task) => {
    if (!task.recurrence_interval) return []
    const plan = task.client?.plan ?? null
    if (effectiveTaskStatus(task.status, task.recurrence_interval, task.completed_at, plan) !== 'done') return []
    const dueAt = recurrenceDueAt(task.recurrence_interval, task.completed_at, plan)
    const daysUntilDue = daysUntilRecurrenceDue(task.recurrence_interval, task.completed_at, plan)
    if (!dueAt || daysUntilDue == null) return []
    return [
      {
        id: task.id,
        title: task.title,
        clientName: task.client?.name ?? null,
        recurrenceLabel: recurrenceLabels[task.recurrence_interval],
        daysUntilDue,
        dueAt: dueAt.toISOString(),
      },
    ]
  })

  const term = search.trim().toLowerCase()
  const filteredTasks = (tasks ?? [])
    .filter((task) => clientFilter === ALL_CLIENTS || task.client_id === clientFilter)
    .filter((task) => !term || task.title.toLowerCase().includes(term))
    .filter((task) => {
      if (!task.recurrence_interval) return true
      const plan = task.client?.plan ?? null
      return effectiveTaskStatus(task.status, task.recurrence_interval, task.completed_at, plan) !== 'done'
    })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div>
            <p className="text-sm text-muted-foreground">Portal Gestor</p>
            <h1 className="text-2xl font-semibold text-foreground">Tarefas do Cliente</h1>
          </div>
          <DeleteModeToggle active={deleteMode} onToggle={() => setDeleteMode((v) => !v)} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <RecurringTasksDialog
            tasks={recurringDormantTasks}
            onReopenNow={handleReopenNow}
            trigger={
              <Button type="button" variant="outline" size="sm">
                <RotateCw className="h-4 w-4" />
                Recorrentes{recurringDormantTasks.length > 0 ? ` (${recurringDormantTasks.length})` : ''}
              </Button>
            }
          />
          <ArchivedTasksDialog
            tasks={(archivedTasks ?? []).map((task) => ({ id: task.id, title: task.title, clientName: task.client?.name ?? null }))}
            archivedAtById={Object.fromEntries((archivedTasks ?? []).map((task) => [task.id, task.archived_at]))}
            onRestore={(id) => restoreTask.mutateAsync(id)}
            onDelete={(id) => deleteTask.mutateAsync(id)}
            trigger={
              <Button type="button" variant="outline" size="sm">
                <Archive className="h-4 w-4" />
                Arquivadas{(archivedTasks?.length ?? 0) > 0 ? ` (${archivedTasks!.length})` : ''}
              </Button>
            }
          />
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar tarefa..."
              className="w-48 pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CLIENTS}>Todos os clientes</SelectItem>
              {(clients ?? []).map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ClientTaskFormDialog
            defaultClientId={clientFilter !== ALL_CLIENTS ? clientFilter : undefined}
            trigger={
              <Button>
                <Plus className="h-4 w-4" />
                Nova tarefa
              </Button>
            }
          />
        </div>
      </div>

      <Card className="rounded-xl border border-[#1A2540] bg-[#131C31] p-5 hover:border-purple-600/30 md:p-6">
        <CardHeader className="p-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckSquare className="h-4 w-4 text-purple-400" />
            Tarefas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-0 pt-4">
          {filteredTasks.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma tarefa encontrada.</p>}
          {filteredTasks.map((task) => (
            <ManagerClientTaskRow key={task.id} task={task} showClientName={clientFilter === ALL_CLIENTS} deleteMode={deleteMode} />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
