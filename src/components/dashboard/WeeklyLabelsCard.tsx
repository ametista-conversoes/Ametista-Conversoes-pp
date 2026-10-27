import { useState } from 'react'
import { Tags } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useClientWeeklyLabels, useSaveWeeklyLabels } from '@/hooks/useWeeklyLabels'
import { formatDateTime, getTodayIsoDate } from '@/lib/format'
import { LABEL_KEYS, labelNames, recentWeekStarts, weekRangeLabel, type LabelCounts, type LabelKey } from '@/lib/label-funnel'

type Draft = Record<LabelKey, string>

const EMPTY_DRAFT: Draft = { novo: '', qualificado: '', agendado: '', venda: '', perdido: '' }

interface WeeklyLabelsCardProps {
  clientId: string
}

/** Fase 59 — Portal do Cliente: toda sexta o cliente conta as conversas por
 * etiqueta no WhatsApp Business e digita os números aqui. A soma de "Venda"
 * das semanas vira as "Vendas do mês". */
export function WeeklyLabelsCard({ clientId }: WeeklyLabelsCardProps) {
  const weeks = recentWeekStarts(getTodayIsoDate(), 4)
  const [week, setWeek] = useState(weeks[0])
  const [draft, setDraft] = useState<Draft | null>(null)
  const { data: records } = useClientWeeklyLabels(clientId)
  const save = useSaveWeeklyLabels()

  const saved = records?.find((r) => r.week_start === week)
  const values: Draft =
    draft ?? (saved ? (Object.fromEntries(LABEL_KEYS.map((k) => [k, String(saved[k])])) as Draft) : EMPTY_DRAFT)
  // Campo vazio conta como 0; precisa de pelo menos um número digitado.
  const parsed = Object.fromEntries(LABEL_KEYS.map((k) => [k, values[k].trim() === '' ? 0 : Number(values[k])])) as LabelCounts
  const valid =
    LABEL_KEYS.some((k) => values[k].trim() !== '') && LABEL_KEYS.every((k) => Number.isInteger(parsed[k]) && parsed[k] >= 0)
  const unchanged = !!saved && LABEL_KEYS.every((k) => parsed[k] === saved[k])

  async function handleSave() {
    if (!valid) return
    try {
      await save.mutateAsync({ clientId, weekStart: week, counts: parsed })
      setDraft(null)
    } catch {
      // erro já avisado pelo onError do hook
    }
  }

  return (
    <Card className="rounded-xl border border-[#1A2540] bg-[#131C31] p-5 hover:border-purple-600/30 md:p-6">
      <CardHeader className="p-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Tags className="h-4 w-4 text-purple-400" />
          Etiquetas da semana
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-0 pt-4">
        <p className="text-xs text-muted-foreground">
          Toda sexta, filtre as conversas por etiqueta no WhatsApp Business e digite quantas há em cada uma. As vendas
          das semanas somam as vendas do mês.
        </p>
        <Select
          value={week}
          onValueChange={(next) => {
            setWeek(next)
            setDraft(null)
          }}
        >
          <SelectTrigger aria-label="Semana">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {weeks.map((w, i) => (
              <SelectItem key={w} value={w}>
                {weekRangeLabel(w)}
                {i === 0 ? ' (atual)' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {LABEL_KEYS.map((key) => (
            <div key={key} className="grid gap-1">
              <Label htmlFor={`label-${key}`} className="text-xs text-muted-foreground">
                {labelNames[key]}
              </Label>
              <Input
                id={`label-${key}`}
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                placeholder="0"
                value={values[key]}
                onChange={(e) => setDraft({ ...values, [key]: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              />
            </div>
          ))}
        </div>
        <Button type="button" className="w-full" onClick={handleSave} disabled={!valid || save.isPending || unchanged}>
          {save.isPending ? 'Salvando...' : 'Salvar'}
        </Button>
        <p className="text-xs text-muted-foreground">
          {saved ? `Registrada · atualizado em ${formatDateTime(saved.updated_at)}` : 'Semana ainda não registrada.'}
        </p>
      </CardContent>
    </Card>
  )
}
