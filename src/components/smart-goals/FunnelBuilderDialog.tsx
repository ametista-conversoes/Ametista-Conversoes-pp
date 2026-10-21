import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Filter } from 'lucide-react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ManagerSmartGoalRecord } from '@/hooks/useManagerPortalData'
import {
  useAllClients,
  useClientAdTotals,
  useClientLeadStatusCounts,
  useSaveFunnelGoals,
} from '@/hooks/useManagerPortalData'
import { adMetricValue } from '@/lib/ad-goal-metrics'
import { getTodayIsoDate } from '@/lib/format'
import {
  computeFunnel,
  endOfMonthIso,
  FUNNEL_GOAL_METRICS,
  formatFunnelValue,
  funnelGoalTargets,
  requiredConversionRate,
  type FunnelGoalMetric,
  type FunnelMode,
} from '@/lib/funnel'
import { computeRateMetrics } from '@/lib/metrics'
import { smartGoalMetricLabels } from '@/lib/status-styles'

const optionalNumber = z
  .string()
  .refine((value) => !value.trim() || (!Number.isNaN(Number(value)) && Number(value) >= 0), 'Número inválido')

const funnelSchema = z.object({
  budget: optionalNumber,
  salesGoal: optionalNumber,
  cpa: optionalNumber,
  ctr: optionalNumber,
  conversionRate: optionalNumber,
  qualificationRate: optionalNumber,
  leadsToClose: optionalNumber,
  averageTicket: optionalNumber,
})

type FunnelValues = z.infer<typeof funnelSchema>
type FunnelField = keyof FunnelValues

const EMPTY: FunnelValues = {
  budget: '',
  salesGoal: '',
  cpa: '',
  ctr: '',
  conversionRate: '',
  qualificationRate: '',
  leadsToClose: '',
  averageTicket: '',
}

const FIELD_LABELS: Record<FunnelField, string> = {
  budget: 'Verba mensal (R$)',
  salesGoal: 'Meta de vendas no mês',
  cpa: 'CPA-alvo (R$)',
  ctr: 'CTR esperado (%)',
  conversionRate: 'Taxa de conversão — clique → lead (%)',
  qualificationRate: 'Taxa de qualificação — lead → qualificado (%)',
  leadsToClose: 'Leads p/ fechar 1 venda',
  averageTicket: 'Ticket médio (R$)',
}

const toNumber = (value: string) => (value.trim() ? Number(value) : null)
const toField = (value: number | null | undefined) => (value == null ? '' : String(Math.round(value * 100) / 100))

/** Meta já existente de um tipo pro cliente: a não concluída de prazo mais
 * distante (a "do momento"); senão a mais recente da lista. */
function findExistingGoal(goals: ManagerSmartGoalRecord[], metric: string) {
  const sameType = goals.filter((g) => g.metric_type === metric)
  const open = sameType.filter((g) => g.status !== 'completed')
  return (open.length ? open : sameType).sort((a, b) => (b.target_date ?? '').localeCompare(a.target_date ?? ''))[0] ?? null
}

interface FunnelBuilderDialogProps {
  goals: ManagerSmartGoalRecord[]
  defaultClientId: string | null
}

/** Fase 53 — funil reverso: a partir da verba OU da meta de vendas, calcula
 * leads → cliques → impressões pelas taxas e salva cada etapa como meta
 * SMART (cria as que faltam, atualiza o valor-alvo das existentes). As
 * entradas vêm, nessa ordem: das próprias metas SMART do cliente, do real
 * dos últimos 30 dias, da ficha do cliente — e podem ser editadas. */
export function FunnelBuilderDialog({ goals, defaultClientId }: FunnelBuilderDialogProps) {
  const [open, setOpen] = useState(false)
  const [clientId, setClientId] = useState<string | null>(defaultClientId)
  const [mode, setMode] = useState<FunnelMode>('verba')
  const [sources, setSources] = useState<Partial<Record<FunnelField, string>>>({})
  const [prefilledFor, setPrefilledFor] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<FunnelGoalMetric>>(new Set(FUNNEL_GOAL_METRICS))

  const { data: clients } = useAllClients()
  const adTotals = useClientAdTotals(open ? clientId : null)
  const leadCounts = useClientLeadStatusCounts(open ? clientId : null)
  const saveGoals = useSaveFunnelGoals()

  const form = useForm<FunnelValues>({ resolver: zodResolver(funnelSchema), defaultValues: EMPTY })
  const values = form.watch()

  const clientGoals = useMemo(() => goals.filter((g) => g.client_id === clientId), [goals, clientId])
  const realRates = adTotals.data?.hasLinkedCampaigns
    ? computeRateMetrics(adTotals.data.spend, adTotals.data.clicks, adTotals.data.impressions, adTotals.data.conversions)
    : null

  // Pré-preenche uma vez por cliente, quando os dados terminam de carregar.
  useEffect(() => {
    if (!open || !clientId || prefilledFor === clientId || !adTotals.data || !leadCounts.data) return
    const target = (metric: string) => findExistingGoal(clientGoals, metric)?.target_value ?? null
    const next: FunnelValues = { ...EMPTY }
    const src: Partial<Record<FunnelField, string>> = {}
    const pick = (field: FunnelField, options: [number | null | undefined, string][]) => {
      const hit = options.find(([value]) => value != null && value > 0)
      if (hit) {
        next[field] = toField(hit[0])
        src[field] = hit[1]
      }
    }
    const totals = adTotals.data
    const counts = leadCounts.data
    pick('budget', [[target('orcamento'), 'meta SMART'], [totals.hasLinkedCampaigns ? totals.spend : null, 'gasto real (30 dias)']])
    pick('salesGoal', [[target('vendas'), 'meta SMART']])
    pick('cpa', [[target('cpa'), 'meta SMART'], [realRates?.cpa, 'real (30 dias)']])
    pick('ctr', [[target('ctr'), 'meta SMART'], [realRates?.ctr, 'real (30 dias)']])
    pick('conversionRate', [[target('taxa_conversao'), 'meta SMART'], [realRates?.conversionRate, 'real (30 dias)']])
    pick('qualificationRate', [[counts.total > 0 ? Math.min(100, (counts.qualificados / counts.total) * 100) : null, 'histórico de leads']])
    pick('leadsToClose', [[totals.leadsToClose, 'ficha do cliente']])
    pick('averageTicket', [[totals.averageTicket, 'ficha do cliente']])
    form.reset(next)
    setSources(src)
    setPrefilledFor(clientId)
  }, [open, clientId, prefilledFor, adTotals.data, leadCounts.data, clientGoals, realRates, form])

  const inputs = {
    mode,
    budget: toNumber(values.budget),
    salesGoal: toNumber(values.salesGoal),
    cpa: toNumber(values.cpa) ?? 0,
    ctr: toNumber(values.ctr) ?? 0,
    conversionRate: toNumber(values.conversionRate) ?? 0,
    qualificationRate: toNumber(values.qualificationRate),
    leadsToClose: toNumber(values.leadsToClose),
    averageTicket: toNumber(values.averageTicket),
  }
  const result = computeFunnel(inputs)
  const targets = result ? funnelGoalTargets(inputs, result) : null
  const requiredRate = requiredConversionRate(inputs.cpa, realRates?.cpc ?? null)

  const realValue = (metric: FunnelGoalMetric): number | null => {
    if (!adTotals.data?.hasLinkedCampaigns) return null
    if (metric === 'orcamento') return Math.round(adTotals.data.spend * 100) / 100
    return adMetricValue(metric, adTotals.data)
  }

  const writes = targets
    ? FUNNEL_GOAL_METRICS.filter((metric) => selected.has(metric) && targets[metric] != null).map((metric) => ({
        metric_type: metric,
        title: `Funil — ${smartGoalMetricLabels[metric]}`,
        target_value: targets[metric] as number,
        existingId: findExistingGoal(clientGoals, metric)?.id ?? null,
      }))
    : []
  const updateCount = writes.filter((w) => w.existingId).length

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      setClientId(defaultClientId)
      setPrefilledFor(null)
      setSelected(new Set(FUNNEL_GOAL_METRICS))
    }
  }

  function handleClientChange(id: string) {
    setClientId(id)
    setPrefilledFor(null)
    setSources({})
    form.reset(EMPTY)
  }

  function toggle(metric: FunnelGoalMetric) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(metric)) next.delete(metric)
      else next.add(metric)
      return next
    })
  }

  async function handleSave() {
    if (!clientId || writes.length === 0) return
    try {
      await saveGoals.mutateAsync({ clientId, targetDate: endOfMonthIso(getTodayIsoDate()), goals: writes })
      setOpen(false)
    } catch {
      // erro já avisado pelo onError do hook
    }
  }

  const visibleFields: FunnelField[] = [
    mode === 'verba' ? 'budget' : 'salesGoal',
    'cpa',
    'ctr',
    'conversionRate',
    'qualificationRate',
    'leadsToClose',
    'averageTicket',
  ]

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <Filter className="h-4 w-4" />
          Montar funil
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Montar funil</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <Select value={clientId ?? ''} onValueChange={handleClientChange}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha o cliente" />
            </SelectTrigger>
            <SelectContent>
              {(clients ?? []).map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {clientId && (
            <>
              <div className="flex flex-wrap gap-2">
                {(['verba', 'vendas'] as const).map((option) => (
                  <Button
                    key={option}
                    type="button"
                    variant="ghost"
                    onClick={() => setMode(option)}
                    className={
                      mode === option
                        ? 'border border-purple-600/20 bg-purple-600/15 text-purple-400 hover:bg-purple-600/20'
                        : 'border border-[#1A2540] text-muted-foreground'
                    }
                  >
                    {option === 'verba' ? 'A partir da verba' : 'A partir da meta de vendas'}
                  </Button>
                ))}
              </div>

              <Form {...form}>
                <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => e.preventDefault()}>
                  {visibleFields.map((name) => (
                    <FormField
                      key={name}
                      control={form.control}
                      name={name}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{FIELD_LABELS[name]}</FormLabel>
                          <FormControl>
                            <Input type="number" step="any" min="0" {...field} />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">
                            {sources[name] ? `Origem: ${sources[name]}` : 'Digite um valor'}
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </form>
              </Form>

              {requiredRate != null && inputs.conversionRate > 0 && requiredRate > inputs.conversionRate && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Com o CPC real dos últimos 30 dias ({formatFunnelValue('cpa', realRates?.cpc)}), esse CPA-alvo exige
                    taxa de conversão de {formatFunnelValue('taxa_conversao', requiredRate)} — o funil considera{' '}
                    {formatFunnelValue('taxa_conversao', inputs.conversionRate)}. Ou o CPC precisa cair para até{' '}
                    {formatFunnelValue('cpa', result?.impliedCpc)}.
                  </span>
                </div>
              )}

              {targets ? (
                <div className="overflow-x-auto rounded-xl border border-[#1A2540]">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr className="border-b border-[#1A2540]">
                        <th className="p-3 text-left font-medium">Salvar</th>
                        <th className="p-3 text-left font-medium">Meta</th>
                        <th className="p-3 text-right font-medium">Calculado</th>
                        <th className="p-3 text-right font-medium">Real (30 dias)</th>
                        <th className="p-3 text-right font-medium">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {FUNNEL_GOAL_METRICS.map((metric) => {
                        const value = targets[metric]
                        const existing = findExistingGoal(clientGoals, metric)
                        return (
                          <tr key={metric} className="border-b border-[#1A2540] last:border-0">
                            <td className="p-3">
                              <Checkbox
                                checked={selected.has(metric) && value != null}
                                disabled={value == null}
                                onCheckedChange={() => toggle(metric)}
                                aria-label={`Salvar ${smartGoalMetricLabels[metric]}`}
                              />
                            </td>
                            <td className="p-3 text-foreground">{smartGoalMetricLabels[metric]}</td>
                            <td className="p-3 text-right font-medium text-foreground">{formatFunnelValue(metric, value)}</td>
                            <td className="p-3 text-right text-muted-foreground">{formatFunnelValue(metric, realValue(metric))}</td>
                            <td className="p-3 text-right text-xs text-muted-foreground">
                              {value == null ? 'falta dado' : existing ? 'atualiza' : 'cria'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Preencha {mode === 'verba' ? 'a verba' : 'a meta de vendas e os leads p/ fechar 1 venda'}, o CPA-alvo, o CTR
                  e a taxa de conversão para calcular o funil.
                </p>
              )}
            </>
          )}
        </div>

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {writes.length > 0
              ? `${writes.length - updateCount} nova(s), ${updateCount} atualizada(s) só no valor-alvo. Novas com prazo no fim do mês.`
              : ''}
          </p>
          <Button type="button" onClick={handleSave} disabled={writes.length === 0 || saveGoals.isPending}>
            {saveGoals.isPending ? 'Salvando...' : `Salvar ${writes.length} meta(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
