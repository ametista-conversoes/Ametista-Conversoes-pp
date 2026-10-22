import { useState } from 'react'
import { Info } from 'lucide-react'
import { FunnelBuilderDialog } from '@/components/smart-goals/FunnelBuilderDialog'
import { FunnelGoalsList } from '@/components/smart-goals/FunnelGoalsList'
import { NewSmartGoalDialog } from '@/components/smart-goals/NewSmartGoalDialog'
import { SmartGoalCard } from '@/components/smart-goals/SmartGoalCard'
import { DeleteModeToggle } from '@/components/shared/DeleteModeToggle'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAllClients, useAllSmartGoals } from '@/hooks/useManagerPortalData'
import { useMarkNavSeen } from '@/hooks/useNavSeen'
import { goalDeadlineStatusLabels, goalDeadlineStatusStyles } from '@/lib/status-styles'

const ALL_CLIENTS = 'all'

const DEADLINE_STATUS_ORDER = ['overdue', 'urgent', 'upcoming'] as const

const deadlineStatusDescriptions: Record<(typeof DEADLINE_STATUS_ORDER)[number], string> = {
  overdue: 'O prazo já passou.',
  urgent: 'Faltam até 30 dias para o prazo.',
  upcoming: 'Faltam até 3 meses (90 dias) para o prazo.',
}

export default function SmartGoals() {
  useMarkNavSeen('/smart-goals')
  const { data: clients } = useAllClients()
  const { data: goals, isLoading } = useAllSmartGoals()
  const [clientFilter, setClientFilter] = useState(ALL_CLIENTS)
  const [deleteMode, setDeleteMode] = useState(false)

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando...</p>
  }

  const filteredGoals = (goals ?? []).filter(
    (goal) => clientFilter === ALL_CLIENTS || goal.client_id === clientFilter,
  )
  // Fase 54 — metas do funil: uma lista por cliente; as demais, um card cada.
  const funnelByClient = new Map<string, typeof filteredGoals>()
  for (const goal of filteredGoals.filter((g) => g.funnel)) {
    funnelByClient.set(goal.client_id, [...(funnelByClient.get(goal.client_id) ?? []), goal])
  }
  const cardGoals = filteredGoals.filter((goal) => !goal.funnel)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div>
            <p className="text-sm text-muted-foreground">Portal Gestor</p>
            <h1 className="text-2xl font-semibold text-foreground">Metas SMART</h1>
          </div>
          <DeleteModeToggle active={deleteMode} onToggle={() => setDeleteMode((v) => !v)} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
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

          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon" aria-label="Sobre os status de prazo">
                <Info className="h-4 w-4 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="start" className="w-80 text-sm">
              <p className="mb-3 font-medium text-foreground">Status de prazo</p>
              <div className="space-y-2">
                {DEADLINE_STATUS_ORDER.map((key) => (
                  <div key={key} className="flex items-start gap-2">
                    <span
                      className={`mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-xs ${goalDeadlineStatusStyles[key]}`}
                    >
                      {goalDeadlineStatusLabels[key]}
                    </span>
                    <span className="text-xs text-muted-foreground">{deadlineStatusDescriptions[key]}</span>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <FunnelBuilderDialog goals={goals ?? []} defaultClientId={clientFilter === ALL_CLIENTS ? null : clientFilter} />
          <NewSmartGoalDialog />
        </div>
      </div>

      {Array.from(funnelByClient.entries()).map(([clientId, clientGoals]) => (
        <FunnelGoalsList
          key={clientId}
          clientName={clientGoals[0].client?.name ?? 'Cliente'}
          goals={clientGoals}
          deleteMode={deleteMode}
        />
      ))}

      {filteredGoals.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma meta cadastrada ainda.</p>}

      <div className="content-grid-container">
        <div className="content-grid gap-4">
          {cardGoals.map((goal) => (
            <SmartGoalCard key={goal.id} goal={goal} deleteMode={deleteMode} />
          ))}
        </div>
      </div>
    </div>
  )
}
