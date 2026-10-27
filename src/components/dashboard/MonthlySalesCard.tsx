import { useState } from 'react'
import { ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { monthStartIso, salesForMonth, useClientMonthlySales, useSaveMonthlySales } from '@/hooks/useMonthlySales'
import { useClientWeeklyLabels } from '@/hooks/useWeeklyLabels'
import { formatDateTime, getTodayIsoDate } from '@/lib/format'
import { weekMonthIso } from '@/lib/label-funnel'

const MONTH_NAMES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** Mês corrente e os 2 anteriores — o cliente informa ou corrige as vendas
 * de qualquer um deles. */
function recentMonths(): { value: string; label: string }[] {
  const [year, month] = getTodayIsoDate().split('-').map(Number)
  return [0, 1, 2].map((back) => {
    const d = new Date(year, month - 1 - back, 1)
    const value = monthStartIso(d.getFullYear(), d.getMonth() + 1)
    return { value, label: `${MONTH_NAMES[d.getMonth()]} de ${d.getFullYear()}${back === 0 ? ' (atual)' : ''}` }
  })
}

interface MonthlySalesCardProps {
  clientId: string
}

/** Fase 58 — Portal do Cliente: o cliente informa quantas vendas fez no mês.
 * Faturamento e ROAS do app inteiro vêm daqui (× ticket médio); sem isso
 * eles ficam em branco. Salvar recalcula metas e relatório na hora.
 * Fase 59: mês com etiquetas semanais registradas = soma das semanas
 * (calculada no banco), só leitura aqui. */
export function MonthlySalesCard({ clientId }: MonthlySalesCardProps) {
  const months = recentMonths()
  const [month, setMonth] = useState(months[0].value)
  const [draft, setDraft] = useState<string | null>(null)
  const { data: records } = useClientMonthlySales(clientId)
  const { data: weeks } = useClientWeeklyLabels(clientId)
  const save = useSaveMonthlySales()
  const monthWeeks = weeks?.filter((w) => weekMonthIso(w.week_start) === month) ?? []
  const fromWeeks = monthWeeks.length > 0

  const saved = salesForMonth(records, month)
  const savedRecord = records?.find((r) => r.month === month)
  const value = draft ?? (saved != null ? String(saved) : '')
  const parsed = value.trim() === '' ? null : Number(value)
  const valid = parsed != null && Number.isInteger(parsed) && parsed >= 0

  async function handleSave() {
    if (!valid) return
    try {
      await save.mutateAsync({ clientId, month, sales: parsed })
      setDraft(null)
    } catch {
      // erro já avisado pelo onError do hook
    }
  }

  return (
    <Card className="rounded-xl border border-[#1A2540] bg-[#131C31] p-5 hover:border-purple-600/30 md:p-6">
      <CardHeader className="p-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShoppingBag className="h-4 w-4 text-purple-400" />
          Vendas do mês
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-0 pt-4">
        <p className="text-xs text-muted-foreground">
          Quantas vendas você fechou no mês? É com esse número (× ticket médio) que calculamos seu faturamento e o ROAS.
        </p>
        <Select
          value={month}
          onValueChange={(next) => {
            setMonth(next)
            setDraft(null)
          }}
        >
          <SelectTrigger aria-label="Mês">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {fromWeeks ? (
          <p className="rounded-lg bg-[#1A2540] p-3 text-sm">
            <span className="font-semibold">{saved ?? 0} venda(s)</span>{' '}
            <span className="text-muted-foreground">
              — soma de {monthWeeks.length} semana(s) em "Etiquetas da semana". Para corrigir, edite a semana.
            </span>
          </p>
        ) : (
          <div className="flex gap-2">
            <Input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              aria-label="Número de vendas"
              placeholder="Ex: 12"
              value={value}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
            <Button type="button" onClick={handleSave} disabled={!valid || save.isPending || parsed === saved}>
              {save.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {savedRecord
            ? `Informado: ${savedRecord.sales} venda(s) · atualizado em ${formatDateTime(savedRecord.updated_at)}`
            : 'Ainda não informado — faturamento e ROAS deste mês ficam em branco até você informar.'}
        </p>
      </CardContent>
    </Card>
  )
}
