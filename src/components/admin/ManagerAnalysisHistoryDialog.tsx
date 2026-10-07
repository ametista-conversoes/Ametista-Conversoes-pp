import { useState, type ReactNode } from 'react'
import { Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import type { ManagerClientRecord, ManagerSmartGoalRecord } from '@/hooks/useManagerPortalData'
import { useManagerAnalyses } from '@/hooks/useManagerPortalData'
import { formatDate } from '@/lib/format'
import { ManagerAnalysisFormDialog } from './ManagerAnalysisFormDialog'

interface ManagerAnalysisHistoryDialogProps {
  trigger: ReactNode
  client: ManagerClientRecord
  clientGoals: ManagerSmartGoalRecord[]
}

const STATUS_LABELS: Record<string, string> = { rascunho: 'Rascunho', publicada: 'Publicada' }
const STATUS_STYLES: Record<string, string> = {
  rascunho: 'border-slate-500/20 bg-slate-500/10 text-slate-400',
  publicada: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
}

/** Histórico completo (rascunhos + publicadas) das Análises do Gestor
 * de um cliente (Fase 48.6). */
export function ManagerAnalysisHistoryDialog({ trigger, client, clientGoals }: ManagerAnalysisHistoryDialogProps) {
  const [open, setOpen] = useState(false)
  const { data: analyses, isLoading } = useManagerAnalyses(open ? client.id : null)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[80vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico de análises — {client.name}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : !analyses || analyses.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma análise registrada ainda.</p>
        ) : (
          <ul className="space-y-2">
            {analyses.map((analysis) => (
              <li key={analysis.id} className="flex items-start justify-between gap-3 rounded-lg bg-secondary/50 p-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {formatDate(analysis.period_start)} a {formatDate(analysis.period_end)}
                    </span>
                    <Badge className={STATUS_STYLES[analysis.status]}>{STATUS_LABELS[analysis.status]}</Badge>
                  </div>
                  {analysis.resumo && <p className="mt-1 text-sm text-foreground">{analysis.resumo}</p>}
                </div>
                <ManagerAnalysisFormDialog
                  client={client}
                  analysis={analysis}
                  clientGoals={clientGoals}
                  trigger={
                    <Button type="button" variant="ghost" size="icon" aria-label="Editar análise">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
