import { useState } from 'react'
import { Archive, Plus, Search } from 'lucide-react'
import { KanbanBoard } from '@/components/kanban/KanbanBoard'
import { KanbanTaskFormDialog } from '@/components/kanban/KanbanTaskFormDialog'
import { BulkDeleteToggle } from '@/components/shared/BulkDeleteToggle'
import { ArchivedTasksDialog } from '@/components/tasks/ArchivedTasksDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  useAllClients,
  useAllTasks,
  useArchivedTasks,
  useAutoArchiveOldTasks,
  useDeleteManagerTask,
  useDeleteManagerTasks,
  useRestoreManagerTask,
} from '@/hooks/useManagerPortalData'
import { useMarkNavSeen } from '@/hooks/useNavSeen'

const ALL_CLIENTS = 'all'

export default function Kanban() {
  useMarkNavSeen('/kanban')
  useAutoArchiveOldTasks()
  const { data: clients } = useAllClients()
  const { data: tasks, isLoading } = useAllTasks()
  const { data: archivedTasks } = useArchivedTasks()
  const deleteTasks = useDeleteManagerTasks()
  const deleteTask = useDeleteManagerTask()
  const restoreTask = useRestoreManagerTask()
  const [clientFilter, setClientFilter] = useState(ALL_CLIENTS)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando...</p>
  }

  const term = search.trim().toLowerCase()
  const filteredTasks = (tasks ?? [])
    .filter((task) => clientFilter === ALL_CLIENTS || task.client_id === clientFilter)
    .filter((task) => !term || task.title.toLowerCase().includes(term))

  function toggleSelected(taskId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  async function handleConfirmDelete() {
    await deleteTasks.mutateAsync(Array.from(selectedIds))
    exitSelectMode()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div>
            <p className="text-sm text-muted-foreground">Portal Gestor</p>
            <h1 className="text-2xl font-semibold text-foreground">Kanban</h1>
          </div>
          <BulkDeleteToggle
            active={selectMode}
            selectedCount={selectedIds.size}
            isDeleting={deleteTasks.isPending}
            nounSingular="tarefa"
            nounPlural="tarefas"
            selectedAdjective="selecionada"
            onActivate={() => setSelectMode(true)}
            onRequestExit={exitSelectMode}
            onConfirmDelete={handleConfirmDelete}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
          <KanbanTaskFormDialog
            trigger={
              <Button>
                <Plus className="h-4 w-4" />
                Nova tarefa
              </Button>
            }
          />
        </div>
      </div>

      <KanbanBoard
        tasks={filteredTasks}
        selectMode={selectMode}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelected}
      />
    </div>
  )
}
