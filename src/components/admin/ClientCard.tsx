import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ManagerClientRecord } from '@/hooks/useManagerPortalData'
import { useUpdateClientStatus } from '@/hooks/useManagerPortalData'
import { formatCurrency } from '@/lib/format'
import {
  clientProblemStatusLabel,
  clientProblemStatusStyle,
  clientStatusLabels,
  clientStatusStyles,
  demoClientLabel,
  demoClientStyle,
  getHealthScoreColor,
  planLabels,
} from '@/lib/status-styles'
import { cn } from '@/lib/utils'

interface ClientCardProps {
  client: ManagerClientRecord
  hasProblems?: boolean
}

// Cor da borda lateral acompanha o status (mesma paleta semântica já usada
// nos badges de clientStatusStyles em src/lib/status-styles.ts).
const statusBorderColor: Record<string, string> = {
  active: 'border-l-emerald-500',
  onboarding: 'border-l-sky-500',
  paused: 'border-l-amber-500',
  churned: 'border-l-destructive',
  at_risk: 'border-l-destructive',
}

const CHANGEABLE_STATUSES = ['active', 'onboarding', 'paused', 'at_risk', 'churned']

export function ClientCard({ client, hasProblems }: ClientCardProps) {
  const updateStatus = useUpdateClientStatus()
  const navigate = useNavigate()

  return (
    <Card
      onClick={() => navigate(`/clients/${client.id}`)}
      className={cn(
        'cursor-pointer rounded-xl border border-l-4 border-[#1A2540] bg-[#131C31] p-5 hover:border-purple-600/30 md:p-6',
        statusBorderColor[client.status] ?? 'border-l-slate-500',
      )}
    >
      <CardHeader className="p-0">
        <CardTitle className="flex items-start justify-between gap-2 text-base">
          <span className="flex min-w-0 items-center gap-2">
            {client.logo_url && (
              <img src={client.logo_url} alt="" className="h-6 w-6 shrink-0 rounded-md object-cover" />
            )}
            <span className="truncate">{client.name}</span>
          </span>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {client.is_demo && <Badge className={demoClientStyle}>{demoClientLabel}</Badge>}
            {hasProblems && <Badge className={clientProblemStatusStyle}>{clientProblemStatusLabel}</Badge>}
            <DropdownMenu>
              <DropdownMenuTrigger asChild disabled={updateStatus.isPending} onClick={(e) => e.stopPropagation()}>
                <Badge className={`cursor-pointer ${clientStatusStyles[client.status]}`}>
                  {clientStatusLabels[client.status] ?? client.status}
                </Badge>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                {CHANGEABLE_STATUSES.map((status) => (
                  <DropdownMenuItem
                    key={status}
                    onSelect={() => updateStatus.mutate({ clientId: client.id, status })}
                  >
                    {clientStatusLabels[status]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 p-0 pt-4 text-sm">
        <p className="truncate text-muted-foreground">{client.company ?? 'Sem empresa'}</p>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Plano</span>
          <span className="font-medium text-foreground">{client.plan ? (planLabels[client.plan] ?? client.plan) : '—'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Mensalidade</span>
          <span className="font-medium text-foreground">{formatCurrency(client.monthly_fee)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Health Score</span>
          <span className={cn('font-medium', getHealthScoreColor(client.health_score))}>
            {client.health_score ?? '—'}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
