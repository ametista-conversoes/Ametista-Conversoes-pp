import { useState } from 'react'
import { Tags } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useClientWeeklyLabels } from '@/hooks/useWeeklyLabels'
import { formatNumber, formatPercent } from '@/lib/format'
import { buildLabelFunnel, LABEL_KEYS, labelNames, weekMonthIso, weekRangeLabel } from '@/lib/label-funnel'

const MONTH_NAMES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

function monthLabel(monthIso: string): string {
  const [year, month] = monthIso.split('-').map(Number)
  return `${MONTH_NAMES[month - 1]} de ${year}`
}

interface ClientWeeklyLabelsCardProps {
  clientId: string
}

/** Fase 59 — Portal do Gestor: funil do mês a partir das etiquetas semanais
 * que o cliente registra (leads → qualificados → agendados → vendas) e as
 * semanas registradas. */
export function ClientWeeklyLabelsCard({ clientId }: ClientWeeklyLabelsCardProps) {
  const { data: records } = useClientWeeklyLabels(clientId)
  const months = [...new Set((records ?? []).map((r) => weekMonthIso(r.week_start)))]
  const [selected, setSelected] = useState<string | null>(null)
  const month = selected ?? months[0]
  const monthWeeks = (records ?? []).filter((r) => weekMonthIso(r.week_start) === month)
  const funnel = buildLabelFunnel(monthWeeks)

  const stages = [
    { label: 'Leads', value: funnel.leads, rate: null, rateLabel: '' },
    { label: 'Qualificados', value: funnel.qualificados, rate: funnel.qualificacaoRate, rateLabel: 'dos leads' },
    { label: 'Agendados', value: funnel.agendados, rate: funnel.agendamentoRate, rateLabel: 'dos qualificados' },
    { label: 'Vendas', value: funnel.vendas, rate: funnel.fechamentoRate, rateLabel: 'dos agendados' },
  ]

  return (
    <Card className="rounded-xl border border-[#1A2540] bg-[#131C31] p-5 hover:border-purple-600/30 md:p-6">
      <CardHeader className="flex flex-col gap-3 p-0 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Tags className="h-4 w-4 text-purple-400" />
          Etiquetas do WhatsApp
        </CardTitle>
        {months.length > 0 && (
          <Select value={month} onValueChange={setSelected}>
            <SelectTrigger aria-label="Mês das etiquetas" className="sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m} value={m}>
                  {monthLabel(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </CardHeader>
      <CardContent className="p-0 pt-4">
        {months.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            O cliente ainda não registrou nenhuma semana de etiquetas (card "Etiquetas da semana" no Dashboard dele).
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {stages.map((stage) => (
                <div key={stage.label} className="rounded-lg bg-[#1A2540] p-3">
                  <p className="text-xs text-muted-foreground">{stage.label}</p>
                  <p className="text-xl font-semibold">{formatNumber(stage.value)}</p>
                  {stage.rateLabel && (
                    <p className="text-xs text-muted-foreground">
                      {formatPercent(stage.rate)} {stage.rateLabel}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Semana</th>
                    {LABEL_KEYS.map((key) => (
                      <th key={key} className="px-2 py-2 text-right font-medium">
                        {labelNames[key]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthWeeks.map((w) => (
                    <tr key={w.id} className="border-t border-[#1A2540]">
                      <td className="whitespace-nowrap py-2 pr-3">{weekRangeLabel(w.week_start)}</td>
                      {LABEL_KEYS.map((key) => (
                        <td key={key} className="px-2 py-2 text-right">
                          {w[key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              Etapas acumuladas: Agendado e Venda também contam como qualificados. A semana entra no mês da sua sexta.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
