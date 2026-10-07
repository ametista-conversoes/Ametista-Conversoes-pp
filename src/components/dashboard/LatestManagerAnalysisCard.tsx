import { FileText } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ManagerAnalysisRecord } from '@/hooks/useClientPortalData'
import { formatDate } from '@/lib/format'

interface LatestManagerAnalysisCardProps {
  analyses: ManagerAnalysisRecord[]
}

const STATUS_GERAL_LABELS: Record<string, string> = { no_alvo: 'No alvo', atencao: 'Atenção', fora_do_alvo: 'Fora do alvo' }

/** Fase 48.8 — última Análise do Gestor publicada, no Dashboard do
 * Portal Cliente (histórico completo fica em Relatórios). */
export function LatestManagerAnalysisCard({ analyses }: LatestManagerAnalysisCardProps) {
  const latest = analyses[0]

  return (
    <Card className="rounded-xl border border-[#1A2540] bg-[#131C31] p-5 hover:border-purple-600/30 md:p-6">
      <CardHeader className="p-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-purple-400" />
          Análise do gestor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-0 pt-4">
        {!latest ? (
          <p className="text-sm text-muted-foreground">Nenhuma análise publicada ainda.</p>
        ) : (
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {formatDate(latest.period_start)} a {formatDate(latest.period_end)}
              </span>
              {latest.status_geral && (
                <Badge className="border-sky-500/20 bg-sky-500/10 text-sky-400">{STATUS_GERAL_LABELS[latest.status_geral]}</Badge>
              )}
            </div>
            {latest.resumo && <p className="text-sm text-foreground">{latest.resumo}</p>}
          </div>
        )}
        <Button asChild variant="ghost" size="sm">
          <Link to="/reports">Ver histórico completo</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
