import { FileText, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ManagerClientRecord, ManagerSmartGoalRecord } from '@/hooks/useManagerPortalData'
import { useManagerAnalyses } from '@/hooks/useManagerPortalData'
import { formatDate } from '@/lib/format'
import { ManagerAnalysisFormDialog } from './ManagerAnalysisFormDialog'
import { ManagerAnalysisHistoryDialog } from './ManagerAnalysisHistoryDialog'

interface ClientAnalysesCardProps {
  client: ManagerClientRecord
  clientGoals: ManagerSmartGoalRecord[]
}

/** Fase 48.6 — card "Análises" na Central de Informações do Cliente:
 * mostra a análise publicada mais recente + atalhos pra criar nova e
 * ver o histórico completo. */
export function ClientAnalysesCard({ client, clientGoals }: ClientAnalysesCardProps) {
  const { data: analyses, isLoading } = useManagerAnalyses(client.id)
  const latestPublished = analyses?.find((a) => a.status === 'publicada')

  return (
    <Card className="rounded-xl border border-[#1A2540] bg-[#131C31] p-5 hover:border-purple-600/30 md:p-6">
      <CardHeader className="flex flex-row items-center justify-between gap-2 p-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-purple-400" />
          Análises
        </CardTitle>
        <ManagerAnalysisFormDialog
          client={client}
          clientGoals={clientGoals}
          trigger={
            <Button type="button" size="sm" variant="secondary">
              <Plus className="h-4 w-4" />
              Nova análise
            </Button>
          }
        />
      </CardHeader>
      <CardContent className="space-y-3 p-0 pt-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : !latestPublished ? (
          <p className="text-sm text-muted-foreground">Nenhuma análise publicada ainda.</p>
        ) : (
          <div className="rounded-lg bg-secondary/50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {formatDate(latestPublished.period_start)} a {formatDate(latestPublished.period_end)}
              </span>
              {latestPublished.status_geral && (
                <Badge className="border-sky-500/20 bg-sky-500/10 text-sky-400">{latestPublished.status_geral}</Badge>
              )}
            </div>
            {latestPublished.resumo && <p className="mt-1 text-sm text-foreground">{latestPublished.resumo}</p>}
          </div>
        )}
        <ManagerAnalysisHistoryDialog
          client={client}
          clientGoals={clientGoals}
          trigger={
            <Button type="button" variant="ghost" size="sm">
              Ver histórico
            </Button>
          }
        />
      </CardContent>
    </Card>
  )
}
