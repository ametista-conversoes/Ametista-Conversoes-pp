import { useState } from 'react'
import { Archive, ChevronDown, ChevronUp, ListChecks, Repeat, Trash2 } from 'lucide-react'
import { NewActivityChecklistItemDialog } from '@/components/onboarding/NewActivityChecklistItemDialog'
import { BulkDeleteToggle } from '@/components/shared/BulkDeleteToggle'
import { ArchivedTasksDialog } from '@/components/tasks/ArchivedTasksDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ActivityChecklistItemRecord, ManagerClientRecord } from '@/hooks/useManagerPortalData'
import {
  useAllClients,
  useActivityChecklistItems,
  useArchivedActivityChecklistItems,
  useAutoArchiveOldTasks,
  useDeleteActivityChecklistItems,
  useRestoreActivityChecklistItem,
  useToggleActivityChecklistItem,
} from '@/hooks/useManagerPortalData'
import { useMarkNavSeen } from '@/hooks/useNavSeen'
import { effectiveActivityCompleted, isCompletionStale, recurrenceShortLabels, type RecurrenceInterval } from '@/lib/recurrence'
import { cn } from '@/lib/utils'

const ALL_CLIENTS = 'all'
const AVULSAS_LABEL = 'Avulsas'

// Fase 31/31b — Validação escolhe 1 plataforma (Meta ou Google); item com
// as 2 marcadas (ou sem chosen_platform ainda) aparece sempre, item
// exclusivo de uma plataforma só aparece pra quem escolheu ela — nem
// chega a renderizar fora do modo de seleção (ver `visibleItemsFor`).
function platformVisible(item: ActivityChecklistItemRecord, client: ManagerClientRecord): boolean {
  if (client.plan !== 'validacao') return true
  return item.platform_scope.length !== 1 || (client.chosen_platform != null && item.platform_scope.includes(client.chosen_platform))
}

export default function Activities() {
  useMarkNavSeen('/activities')
  useAutoArchiveOldTasks()
  const { data: clients } = useAllClients()
  const { data: items, isLoading } = useActivityChecklistItems()
  const { data: archivedItems } = useArchivedActivityChecklistItems()
  const toggleItem = useToggleActivityChecklistItem()
  const deleteItems = useDeleteActivityChecklistItems()
  const restoreItem = useRestoreActivityChecklistItem()
  const [clientFilter, setClientFilter] = useState(ALL_CLIENTS)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  // Fase 36.1 — concluídas (recorrentes ou não) só ficam junto dos
  // pendentes por 1 dia (`isCompletionStale`); depois disso somem da
  // lista principal e só voltam se o gestor abrir esse toggle por
  // cliente. Item recorrente sai do colapso sozinho quando a recorrência
  // vence de novo (nada aqui precisa de "restaurar").
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set())

  function toggleExpandedClient(clientId: string) {
    setExpandedClients((prev) => {
      const next = new Set(prev)
      if (next.has(clientId)) next.delete(clientId)
      else next.add(clientId)
      return next
    })
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando...</p>
  }

  function toggleSelected(itemId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  async function handleConfirmDelete() {
    await deleteItems.mutateAsync(Array.from(selectedIds))
    exitSelectMode()
  }

  const visibleClients = (clients ?? []).filter(
    (client) => clientFilter === ALL_CLIENTS || client.id === clientFilter,
  )
  const itemsByClient = new Map<string, ActivityChecklistItemRecord[]>()
  for (const item of items ?? []) {
    const list = itemsByClient.get(item.client_id) ?? []
    list.push(item)
    itemsByClient.set(item.client_id, list)
  }
  // No modo de seleção mostra todo mundo com item no banco (mesmo os
  // ocultos pelo filtro de plataforma), senão eles ficam presos — sem
  // aparecer pra selecionar e apagar. Fora do modo de seleção, só mostra
  // quem tem pelo menos 1 item realmente visível (evita o card fantasma
  // "0 de 0" de um cliente cujos itens são todos de outra plataforma).
  const clientsWithItems = visibleClients.filter((client) => {
    const allItems = itemsByClient.get(client.id) ?? []
    if (allItems.length === 0) return false
    return selectMode || allItems.some((item) => platformVisible(item, client))
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div>
            <p className="text-sm text-muted-foreground">Portal Gestor</p>
            <h1 className="text-2xl font-semibold text-foreground">Atividades</h1>
          </div>
          <BulkDeleteToggle
            active={selectMode}
            selectedCount={selectedIds.size}
            isDeleting={deleteItems.isPending}
            nounSingular="item"
            nounPlural="itens"
            selectedAdjective="selecionado"
            onActivate={() => setSelectMode(true)}
            onRequestExit={exitSelectMode}
            onConfirmDelete={handleConfirmDelete}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ArchivedTasksDialog
            tasks={(archivedItems ?? []).map((item) => ({ id: item.id, title: item.title, clientName: item.client?.name ?? null }))}
            archivedAtById={Object.fromEntries((archivedItems ?? []).map((item) => [item.id, item.archived_at]))}
            onRestore={(id) => restoreItem.mutateAsync(id)}
            onDelete={(id) => deleteItems.mutateAsync([id])}
            trigger={
              <Button type="button" variant="outline" size="sm">
                <Archive className="h-4 w-4" />
                Arquivadas{(archivedItems?.length ?? 0) > 0 ? ` (${archivedItems!.length})` : ''}
              </Button>
            }
          />
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
          <NewActivityChecklistItemDialog />
        </div>
      </div>

      {clientsWithItems.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum item de Atividades cadastrado ainda.</p>
      )}

      <div className="content-grid-container">
        <div className="content-grid gap-4">
          {clientsWithItems.map((client) => {
            const allClientItems = itemsByClient.get(client.id) ?? []
            const isValidacao = client.plan === 'validacao'
            // No modo de seleção, ignora o filtro de plataforma — senão
            // um item oculto nunca aparece pra ser selecionado e apagado.
            const clientItems = selectMode ? allClientItems : allClientItems.filter((item) => platformVisible(item, client))
            const hiddenCount = allClientItems.length - allClientItems.filter((item) => platformVisible(item, client)).length
            const total = clientItems.length
            const done = clientItems.filter((item) =>
              effectiveActivityCompleted(item.completed, item.recurrence_interval, item.completed_at, client.plan),
            ).length
            const percent = total > 0 ? Math.round((done / total) * 100) : 0

            // Fase 36.1 — concluída (recorrente ou não) há mais de 1 dia
            // some da lista principal, sem apagar nada; recorrente volta
            // sozinha quando a recorrência vencer de novo, porque
            // `isStale` recalcula tudo a cada render, não é um estado
            // salvo em lugar nenhum. Modo de seleção sempre mostra tudo,
            // mesmo padrão do filtro de plataforma acima.
            const isStale = (item: ActivityChecklistItemRecord) =>
              effectiveActivityCompleted(item.completed, item.recurrence_interval, item.completed_at, client.plan) &&
              isCompletionStale(item.completed_at)
            const staleCount = clientItems.filter(isStale).length
            const isExpanded = expandedClients.has(client.id)
            const visibleClientItems = selectMode || isExpanded ? clientItems : clientItems.filter((item) => !isStale(item))

            const itemsByGroup = new Map<string, ActivityChecklistItemRecord[]>()
            for (const item of visibleClientItems) {
              const group = item.source_template_name ?? AVULSAS_LABEL
              const list = itemsByGroup.get(group) ?? []
              list.push(item)
              itemsByGroup.set(group, list)
            }

            return (
              <Card
                key={client.id}
                className="flex flex-col rounded-xl border border-[#1A2540] bg-[#131C31] p-5 hover:border-purple-600/30 md:p-6"
              >
                <CardHeader className="p-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ListChecks className="h-4 w-4 text-purple-400" />
                    {client.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-0 pt-4">
                  <div>
                    <Progress value={percent} />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {done} de {total} itens concluídos ({percent}%)
                    </p>
                  </div>
                  {isValidacao && !client.chosen_platform && (
                    <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                      Plataforma (Meta ou Google) ainda não definida na Central de Informações — só as tarefas comuns
                      aparecem até lá.
                    </p>
                  )}
                  {selectMode && hiddenCount > 0 && (
                    <p className="rounded-lg border border-purple-500/20 bg-purple-500/10 px-3 py-2 text-xs text-purple-300">
                      Mostrando {hiddenCount} item{hiddenCount > 1 ? 'ns' : ''} da outra plataforma, normalmente
                      ocultos, pra você poder apagar se precisar.
                    </p>
                  )}
                  {!selectMode && staleCount > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 -mx-1 justify-start text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => toggleExpandedClient(client.id)}
                    >
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      {isExpanded ? 'Ocultar' : 'Mostrar'} concluídas há mais de 1 dia ({staleCount})
                    </Button>
                  )}
                  {Array.from(itemsByGroup.entries()).map(([groupName, groupItems]) => (
                    <div key={groupName} className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">{groupName}</p>
                      {groupItems.map((item) => {
                        const selected = selectedIds.has(item.id)
                        const isDone = effectiveActivityCompleted(
                          item.completed,
                          item.recurrence_interval,
                          item.completed_at,
                          client.plan,
                        )
                        return (
                          <div
                            key={item.id}
                            className={cn(
                              'flex items-start gap-2 rounded-lg bg-secondary/50 px-3 py-2',
                              selectMode && selected && 'bg-red-500/10 ring-1 ring-red-500/60',
                            )}
                          >
                            <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                              <Checkbox
                                checked={isDone}
                                disabled={toggleItem.isPending}
                                onCheckedChange={(checked) =>
                                  toggleItem.mutate({ itemId: item.id, completed: checked === true })
                                }
                              />
                              <div className="min-w-0">
                                <p className={`break-words text-sm ${isDone ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                                  {item.title}
                                </p>
                                {(item.category || item.recurrence_interval) && (
                                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                    {item.category}
                                    {item.recurrence_interval && (
                                      <Badge className="gap-1 border-purple-600/20 bg-purple-600/10 text-[10px] text-purple-300">
                                        <Repeat className="h-2.5 w-2.5" />
                                        {recurrenceShortLabels[item.recurrence_interval as RecurrenceInterval]}
                                      </Badge>
                                    )}
                                  </p>
                                )}
                              </div>
                            </label>
                            {selectMode && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className={cn(
                                  'h-8 w-8 shrink-0',
                                  selected ? 'text-red-500' : 'text-muted-foreground hover:text-destructive',
                                )}
                                aria-label={selected ? `Remover "${item.title}" da seleção` : `Selecionar "${item.title}" para apagar`}
                                aria-pressed={selected}
                                onClick={() => toggleSelected(item.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
