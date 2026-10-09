import { FileText, Pencil, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ManagerClientRecord, ManagerSmartGoalRecord } from '@/hooks/useManagerPortalData'
import { useManagerAnalyses } from '@/hooks/useManagerPortalData'
import { formatDate } from '@/lib/format'
import { type AnalysisPlan, resolveAnalysisPeriod } from '@/lib/manager-analysis'
import { ManagerAnalysisFormDialog } from './ManagerAnalysisFormDialog'
import { ManagerAnalysisHistoryDialog } from './ManagerAnalysisHistoryDialog'

interface ClientAnalysesCardProps {
  client: ManagerClientRecord
  clientGoals: ManagerSmartGoalRecord[]
}

/** Fase 48.6/48.13 — card "Análises" na Central de Informações do
 * Cliente: mostra a análise publicada mais recente + atalhos pra criar
 * nova e ver o histórico completo.
 *
 * Fase 48.13 (achado ao vivo): `manager_analyses` tem
 * `unique(client_id, period_start, period_end, tipo)` — "Nova análise"
 * sempre resolve o período atual sozinho, então clicar nela quando já
 * existe uma análise (rascunho OU publicada) pro período corrente
 * derrubava o INSERT no fim do preenchimento inteiro, com um erro
 * genérico ("Não foi possível criar a análise") que não explicava o
 * motivo e perdia tudo que o gestor tinha digitado. Em vez de só
 * deixar a mensagem mais clara, evitamos o problema por completo:
 * quando já existe uma análise pro período atual (tipo "periodica" —
 * cobre Validação/Escala/Dominação semanal, os casos reais hoje), o
 * botão abre ELA em modo de edição em vez de um formulário em branco. */
export function ClientAnalysesCard({ client, clientGoals }: ClientAnalysesCardProps) {
  const { data: analyses, isLoading } = useManagerAnalyses(client.id)
  const latestPublished = analyses?.find((a) => a.status === 'publicada')

  const plan: AnalysisPlan = (client.plan as AnalysisPlan | null) ?? 'validacao'
  const currentPeriod = resolveAnalysisPeriod(plan, 'periodica')
  const analysisForCurrentPeriod = analyses?.find(
    (a) => a.tipo === 'periodica' && a.period_start === currentPeriod.periodStart && a.period_end === currentPeriod.periodEnd,
  )

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
          analysis={analysisForCurrentPeriod}
          trigger={
            <Button type="button" size="sm" variant="secondary">
              {analysisForCurrentPeriod ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {analysisForCurrentPeriod ? 'Editar análise do período' : 'Nova análise'}
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
