import { useState } from 'react'
import { IncidentAlertList } from '@/components/incidents/IncidentAlertList'
import { NewIncidentDialog } from '@/components/incidents/NewIncidentDialog'
import { SeverityCounts } from '@/components/incidents/SeverityCounts'
import { DeleteModeToggle } from '@/components/shared/DeleteModeToggle'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAllAlerts, useAllClients, useAllIncidents } from '@/hooks/useManagerPortalData'
import { useMarkNavSeen } from '@/hooks/useNavSeen'

const ALL_CLIENTS = 'all'

export default function Incidents() {
  useMarkNavSeen('/incidents')
  const { data: incidents, isLoading: isLoadingIncidents } = useAllIncidents()
  const { data: alerts, isLoading: isLoadingAlerts } = useAllAlerts()
  const { data: clients } = useAllClients()
  const [deleteMode, setDeleteMode] = useState(false)
  const [clientFilter, setClientFilter] = useState(ALL_CLIENTS)

  if (isLoadingIncidents || isLoadingAlerts) {
    return <p className="text-sm text-muted-foreground">Carregando...</p>
  }

  const filteredIncidents = (incidents ?? []).filter(
    (incident) => clientFilter === ALL_CLIENTS || incident.client_id === clientFilter,
  )
  const filteredAlerts = (alerts ?? []).filter((alert) => clientFilter === ALL_CLIENTS || alert.client_id === clientFilter)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div>
            <p className="text-sm text-muted-foreground">Portal Gestor</p>
            <h1 className="text-2xl font-semibold text-foreground">Incidentes e Alertas</h1>
          </div>
          <DeleteModeToggle active={deleteMode} onToggle={() => setDeleteMode((v) => !v)} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <NewIncidentDialog />
        </div>
      </div>

      <SeverityCounts incidents={filteredIncidents} alerts={filteredAlerts} />
      <IncidentAlertList incidents={filteredIncidents} alerts={filteredAlerts} deleteMode={deleteMode} />
    </div>
  )
}
