import { useMemo, useState, type ReactNode } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, Plus, Trash2 } from 'lucide-react'
import { useFieldArray, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { Client90DayMilestoneRecord, ManagerAnalysisRecord, ManagerClientRecord, ManagerSmartGoalRecord } from '@/hooks/useManagerPortalData'
import {
  useAllClientTasks,
  useClient90DayMilestones,
  useClientLeadStatusCountsForMonth,
  useClientPerformanceSnapshots,
  useCreateManagerAnalysis,
  useCreateOptimizationLogEntry,
  useOptimizationUsageForPeriod,
  usePublishManagerAnalysis,
  useUpdateManagerAnalysis,
} from '@/hooks/useManagerPortalData'
import { formatCurrency, formatDate, formatMultiplier, formatNumber, formatPercent } from '@/lib/format'
import {
  type AnalysisPlan,
  type AnalysisTipo,
  analysisCadenceLabel,
  daysElapsedInPeriod,
  daysInPeriod,
  previousAnalysisPeriod,
  resolveAnalysisPeriod,
} from '@/lib/manager-analysis'
import { computeMediaBudgetModifier, projectMonthSpend } from '@/lib/media-budget-modifier'
import { aggregateSnapshotKpisForRange, computeRevenueFromLeads, computeRoas } from '@/lib/metrics'
import { pctChangeLabel } from '@/lib/pdf-report'
import { planLimitsFor } from '@/lib/plan-limits'
import { milestone90dStatusLabels } from '@/lib/status-styles'

const proximoPassoSchema = z.object({
  titulo: z.string().min(1, 'Digite o próximo passo'),
  data: z.string().optional(),
})

const formSchema = z.object({
  tipo: z.enum(['periodica', 'estrategica_mensal']),
  resumo: z.string().optional(),
  status_geral: z.enum(['no_alvo', 'atencao', 'fora_do_alvo', '']).optional(),
  diagnostico: z.string().optional(),
  otimizacoes_realizadas: z.string().optional(),
  proximos_passos: z.array(proximoPassoSchema).max(3, 'Máximo de 3 próximos passos'),
  pendencias_cliente_texto: z.string().optional(),
  // extra_fields por plano/tipo (ver migration-086) — todos opcionais,
  // só os relevantes pro plano/tipo escolhido são mostrados/salvos.
  teste_do_mes: z.string().optional(),
  resultado_teste: z.string().optional(),
  recomendacao: z.string().optional(),
  meta_vs_google: z.string().optional(),
  testes_ab_quinzena: z.string().optional(),
  alertas: z.string().optional(),
  concorrencia: z.string().optional(),
  parcela_impressoes_perdida: z.string().optional(),
  cenario_escala: z.string().optional(),
  riscos: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

const EMPTY_VALUES: FormValues = {
  tipo: 'periodica',
  resumo: '',
  status_geral: '',
  diagnostico: '',
  otimizacoes_realizadas: '',
  proximos_passos: [],
  pendencias_cliente_texto: '',
  teste_do_mes: '',
  resultado_teste: '',
  recomendacao: '',
  meta_vs_google: '',
  testes_ab_quinzena: '',
  alertas: '',
  concorrencia: '',
  parcela_impressoes_perdida: '',
  cenario_escala: '',
  riscos: '',
}

const STATUS_GERAL_LABELS: Record<string, string> = {
  no_alvo: 'No alvo',
  atencao: 'Atenção',
  fora_do_alvo: 'Fora do alvo',
}

interface ManagerAnalysisFormDialogProps {
  trigger: ReactNode
  client: ManagerClientRecord
  analysis?: ManagerAnalysisRecord
  clientGoals: ManagerSmartGoalRecord[]
}

function numberRow(label: string, value: string, change?: string) {
  return (
    <div key={label} className="flex items-center justify-between gap-2 border-b border-[#1A2540] py-1 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2">
        <span className="text-foreground">{value}</span>
        {change !== undefined && <span className="text-xs text-muted-foreground/70">{change}</span>}
      </span>
    </div>
  )
}

/** Diálogo de criar OU editar 1 Análise do Gestor (Fase 48.6) — texto
 * curto e estruturado que interpreta os números do período, com
 * bloco de números automático e campos específicos por plano/tipo. */
export function ManagerAnalysisFormDialog({ trigger, client, analysis, clientGoals }: ManagerAnalysisFormDialogProps) {
  const [open, setOpen] = useState(false)
  const plan: AnalysisPlan = (client.plan as AnalysisPlan | null) ?? 'validacao'
  const isEdit = !!analysis
  const isDraft = !analysis || analysis.status === 'rascunho'

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: EMPTY_VALUES })
  const tipo = form.watch('tipo')
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'proximos_passos' })

  const period = analysis
    ? { periodStart: analysis.period_start, periodEnd: analysis.period_end }
    : resolveAnalysisPeriod(plan, tipo)
  const previousPeriod = previousAnalysisPeriod(plan, tipo, period.periodStart)

  const { data: snapshots } = useClientPerformanceSnapshots(client.id)
  const { data: leadCounts } = useClientLeadStatusCountsForMonth(client.id, period.periodStart, period.periodEnd)
  const { data: prevLeadCounts } = useClientLeadStatusCountsForMonth(client.id, previousPeriod.periodStart, previousPeriod.periodEnd)
  const { data: usage } = useOptimizationUsageForPeriod(client.id, period.periodStart, period.periodEnd)
  const { data: milestones } = useClient90DayMilestones(plan === 'validacao' ? client.id : null)
  const { data: allClientTasks } = useAllClientTasks()
  const clientTasks = useMemo(() => (allClientTasks ?? []).filter((t) => t.client_id === client.id), [allClientTasks, client.id])

  const createAnalysis = useCreateManagerAnalysis()
  const updateAnalysis = useUpdateManagerAnalysis()
  const publishAnalysis = usePublishManagerAnalysis()
  const createOptimizationLog = useCreateOptimizationLogEntry()
  const [newOptimization, setNewOptimization] = useState('')
  const [saving, setSaving] = useState<'draft' | 'publish' | null>(null)

  const numbers = useMemo(() => {
    const kpis = aggregateSnapshotKpisForRange(snapshots ?? [], period.periodStart, period.periodEnd)
    const prevKpis = aggregateSnapshotKpisForRange(snapshots ?? [], previousPeriod.periodStart, previousPeriod.periodEnd)
    const revenue = computeRevenueFromLeads(kpis.conversions, client.leads_to_close, client.average_ticket)
    const prevRevenue = computeRevenueFromLeads(prevKpis.conversions, client.leads_to_close, client.average_ticket)
    const roas = revenue != null ? computeRoas(revenue, kpis.spend) : null
    const prevRoas = prevRevenue != null ? computeRoas(prevRevenue, prevKpis.spend) : null
    return { kpis, prevKpis, revenue, prevRevenue, roas, prevRoas }
  }, [snapshots, period.periodStart, period.periodEnd, previousPeriod.periodStart, previousPeriod.periodEnd, client.leads_to_close, client.average_ticket])

  const overdueTasks = clientTasks.filter((t) => t.status !== 'done' && t.due_date && t.due_date < new Date().toISOString().slice(0, 10))

  const planLimits = planLimitsFor(plan)
  const changesUsed = usage?.changesUsed ?? 0
  const creativesUsed = usage?.creativesUsed ?? 0
  const overLimit = planLimits && (changesUsed > planLimits.alteracoesPorMes || creativesUsed > planLimits.criativosPorMes)

  // Fase 48.7 -- modificador de verba (só Escala periódica).
  const budgetModifier = useMemo(() => {
    if (plan !== 'escala' || tipo !== 'periodica') return null
    const elapsed = daysElapsedInPeriod(period.periodStart)
    const total = daysInPeriod(period.periodStart, period.periodEnd)
    const projected = projectMonthSpend(numbers.kpis.spend, elapsed, total)
    return { projected, modifier: computeMediaBudgetModifier('escala', projected) }
  }, [plan, tipo, period.periodStart, period.periodEnd, numbers.kpis.spend])

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      form.reset(
        analysis
          ? {
              tipo: analysis.tipo,
              resumo: analysis.resumo ?? '',
              status_geral: analysis.status_geral ?? '',
              diagnostico: analysis.diagnostico ?? '',
              otimizacoes_realizadas: analysis.otimizacoes_realizadas ?? '',
              proximos_passos: (analysis.proximos_passos ?? []).map((p) => ({ titulo: p.titulo, data: p.data ?? '' })),
              pendencias_cliente_texto: analysis.pendencias_cliente_texto ?? '',
              teste_do_mes: (analysis.extra_fields.teste_do_mes as string) ?? '',
              resultado_teste: (analysis.extra_fields.resultado_teste as string) ?? '',
              recomendacao: (analysis.extra_fields.recomendacao as string) ?? '',
              meta_vs_google: (analysis.extra_fields.meta_vs_google as string) ?? '',
              testes_ab_quinzena: (analysis.extra_fields.testes_ab_quinzena as string) ?? '',
              alertas: (analysis.extra_fields.alertas as string) ?? '',
              concorrencia: (analysis.extra_fields.concorrencia as string) ?? '',
              parcela_impressoes_perdida: (analysis.extra_fields.parcela_impressoes_perdida as string) ?? '',
              cenario_escala: (analysis.extra_fields.cenario_escala as string) ?? '',
              riscos: (analysis.extra_fields.riscos as string) ?? '',
            }
          : EMPTY_VALUES,
      )
    }
  }

  function buildExtraFields(values: FormValues): Record<string, unknown> {
    if (plan === 'escala') {
      return {
        meta_vs_google: values.meta_vs_google?.trim() || null,
        testes_ab_quinzena: values.testes_ab_quinzena?.trim() || null,
        ritmo_verba_projecao: budgetModifier?.projected ?? null,
        ritmo_verba_modificador_estimado: budgetModifier?.modifier?.modifier ?? null,
        ritmo_verba_faixa_label: budgetModifier?.modifier?.bracketLabel ?? null,
      }
    }
    if (plan === 'dominacao' && values.tipo === 'periodica') {
      return { alertas: values.alertas?.trim() || null }
    }
    if (plan === 'dominacao' && values.tipo === 'estrategica_mensal') {
      return {
        concorrencia: values.concorrencia?.trim() || null,
        parcela_impressoes_perdida: values.parcela_impressoes_perdida?.trim() || null,
        cenario_escala: values.cenario_escala?.trim() || null,
        riscos: values.riscos?.trim() || null,
      }
    }
    // Validação
    return {
      teste_do_mes: values.teste_do_mes?.trim() || null,
      resultado_teste: values.resultado_teste?.trim() || null,
      recomendacao: values.recomendacao?.trim() || null,
    }
  }

  async function handleSave(publish: boolean) {
    const values = form.getValues()
    const valid = await form.trigger()
    if (!valid) return
    setSaving(publish ? 'publish' : 'draft')
    try {
      const input = {
        client_id: client.id,
        period_start: period.periodStart,
        period_end: period.periodEnd,
        tipo: values.tipo,
        resumo: values.resumo?.trim() || null,
        status_geral: values.status_geral || null,
        diagnostico: values.diagnostico?.trim() || null,
        otimizacoes_realizadas: values.otimizacoes_realizadas?.trim() || null,
        creatives_used_snapshot: creativesUsed,
        changes_used_snapshot: changesUsed,
        proximos_passos: values.proximos_passos.map((p) => ({ titulo: p.titulo, data: p.data?.trim() ? p.data : null })),
        pendencias_cliente_texto: values.pendencias_cliente_texto?.trim() || null,
        extra_fields: buildExtraFields(values),
      }
      let id = analysis?.id
      if (analysis) {
        await updateAnalysis.mutateAsync({ id: analysis.id, ...input })
      } else {
        const created = await createAnalysis.mutateAsync(input)
        id = created.id
      }
      if (publish && id) {
        await publishAnalysis.mutateAsync({ id, client_id: client.id })
      }
      toast.success(publish ? 'Análise publicada.' : 'Rascunho salvo.')
      setOpen(false)
    } catch {
      // erro já avisado pelo onError dos hooks
    } finally {
      setSaving(null)
    }
  }

  async function handleAddOptimization() {
    if (!newOptimization.trim()) return
    await createOptimizationLog.mutateAsync({ client_id: client.id, description: newOptimization.trim() })
    setNewOptimization('')
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Editar análise' : 'Nova análise'} — {client.name} ({formatDate(period.periodStart)} a{' '}
            {formatDate(period.periodEnd)})
          </DialogTitle>
        </DialogHeader>

        {plan === 'dominacao' && !isEdit && (
          <div className="flex items-center gap-3 rounded-lg bg-secondary/50 p-3">
            <span className="text-sm text-muted-foreground">Tipo</span>
            <Select value={tipo} onValueChange={(v) => form.setValue('tipo', v as AnalysisTipo)}>
              <SelectTrigger className="h-8 w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="periodica">Semanal (curta)</SelectItem>
                <SelectItem value="estrategica_mensal">Mensal estratégica</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Cadência: {analysisCadenceLabel(plan, tipo)} · período {formatDate(period.periodStart)} a {formatDate(period.periodEnd)}
        </p>

        <div className="rounded-lg bg-secondary/50 p-3">
          <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground/70">Números do período (automático)</p>
          {numberRow('Investimento', formatCurrency(numbers.kpis.spend), pctChangeLabel(numbers.kpis.spend, numbers.prevKpis.spend))}
          {numberRow('Receita estimada', formatCurrency(numbers.revenue), pctChangeLabel(numbers.revenue, numbers.prevRevenue))}
          {numberRow('ROAS', formatMultiplier(numbers.roas), pctChangeLabel(numbers.roas, numbers.prevRoas))}
          {numberRow('CPA', formatCurrency(numbers.kpis.cpa), pctChangeLabel(numbers.kpis.cpa, numbers.prevKpis.cpa))}
          {numberRow('CTR', formatPercent(numbers.kpis.ctr))}
          {numberRow('Conversões', formatNumber(numbers.kpis.conversions), pctChangeLabel(numbers.kpis.conversions, numbers.prevKpis.conversions))}
          {numberRow('Leads', formatNumber(leadCounts?.leads ?? null), pctChangeLabel(leadCounts?.leads ?? null, prevLeadCounts?.leads ?? null))}
          {numberRow('Vendas', formatNumber(leadCounts?.vendas ?? null), pctChangeLabel(leadCounts?.vendas ?? null, prevLeadCounts?.vendas ?? null))}
          {clientGoals.length > 0 && (
            <div className="mt-2 border-t border-[#1A2540] pt-2">
              <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground/70">Metas SMART atuais</p>
              {clientGoals.map((g) => (
                <p key={g.id} className="text-xs text-muted-foreground">
                  {g.title}: {g.current_value ?? 0} de {g.target_value ?? 0}
                </p>
              ))}
            </div>
          )}
        </div>

        {budgetModifier && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm">
            <p className="flex items-center gap-2 font-medium text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              Ritmo de verba
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Projeção do mês: {formatCurrency(budgetModifier.projected)}.
              {budgetModifier.modifier
                ? ` Passaria a verba incluída — modificador estimado: ${formatCurrency(budgetModifier.modifier.modifier)} (faixa ${budgetModifier.modifier.bracketLabel}).`
                : ' Dentro da verba incluída, sem modificador.'}
              {' '}Apuração e cobrança reais só acontecem no fechamento do mês, com aprovação prévia por escrito do cliente — isto é só um aviso antecipado.
            </p>
          </div>
        )}

        <Form {...form}>
          <form className="space-y-4">
            <FormField
              control={form.control}
              name="resumo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Resumo (até 3 linhas)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Como foi o período, em poucas linhas..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!(plan === 'dominacao' && tipo === 'periodica') && (
              <FormField
                control={form.control}
                name="status_geral"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status geral</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(STATUS_GERAL_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="diagnostico"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Diagnóstico</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Por que os números ficaram assim, em que etapa do funil houve queda..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {plan === 'validacao' && tipo === 'periodica' && (
              <>
                <FormField
                  control={form.control}
                  name="teste_do_mes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teste do mês e resultado</FormLabel>
                      <FormControl>
                        <Textarea placeholder="O que foi testado e qual variação venceu..." {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="rounded-lg bg-secondary/50 p-3 text-sm">
                  <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground/70">Saúde do atendimento (automático)</p>
                  <p className="text-muted-foreground">
                    Taxa lead → venda: {formatPercent(leadCounts?.leadToSaleRate ?? null)} · Leads parados em "Novo":{' '}
                    {leadCounts?.parados_em_novo ?? 0}
                  </p>
                </div>
                <div className="rounded-lg bg-secondary/50 p-3 text-sm">
                  <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground/70">
                    Progresso do Plano de 90 dias (automático)
                  </p>
                  {!milestones || milestones.length === 0 ? (
                    <p className="text-muted-foreground">Nenhum marco registrado ainda.</p>
                  ) : (
                    milestones.slice(0, 3).map((m: Client90DayMilestoneRecord) => (
                      <p key={m.id} className="text-muted-foreground">
                        {formatDate(m.entry_date)} — {m.title} ({milestone90dStatusLabels[m.status]})
                      </p>
                    ))
                  )}
                </div>
                <FormField
                  control={form.control}
                  name="recomendacao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recomendação</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Continuar validando, ou pronto para escalar..." {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </>
            )}

            {plan === 'escala' && (
              <>
                <FormField
                  control={form.control}
                  name="meta_vs_google"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Meta x Google</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Divisão da verba, CPA por canal, recomendação de redistribuição..." {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="testes_ab_quinzena"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Testes A/B da quinzena</FormLabel>
                      <FormControl>
                        <Textarea {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </>
            )}

            {plan === 'dominacao' && tipo === 'periodica' && (
              <FormField
                control={form.control}
                name="alertas"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Alertas</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Anúncios com fadiga, o que mudou..." {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}

            {plan === 'dominacao' && tipo === 'estrategica_mensal' && (
              <>
                <FormField
                  control={form.control}
                  name="concorrencia"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Concorrência</FormLabel>
                      <FormControl>
                        <Textarea placeholder="O que mudou nos concorrentes..." {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="parcela_impressoes_perdida"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parcela de impressões perdida (orçamento/classificação)</FormLabel>
                      <FormControl>
                        <Textarea {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cenario_escala"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cenário de escala</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Quanto investir a mais e o resultado esperado..." {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="riscos"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Riscos</FormLabel>
                      <FormControl>
                        <Textarea {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </>
            )}

            <div className="space-y-2">
              <FormField
                control={form.control}
                name="otimizacoes_realizadas"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Otimizações realizadas</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Lista do que foi feito no período..." {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              {planLimits && (
                <div className={`flex items-center gap-2 rounded-lg p-2 text-xs ${overLimit ? 'bg-amber-500/10 text-amber-400' : 'bg-secondary/50 text-muted-foreground'}`}>
                  {overLimit && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
                  <span>
                    {creativesUsed} de {planLimits.criativosPorMes} criativos usados · {changesUsed} de {planLimits.alteracoesPorMes}{' '}
                    alterações usadas (registre no botão abaixo pra contar aqui)
                  </span>
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="Descrever uma alteração aplicada agora..."
                  value={newOptimization}
                  onChange={(e) => setNewOptimization(e.target.value)}
                />
                <Button type="button" variant="secondary" onClick={handleAddOptimization} disabled={!newOptimization.trim()}>
                  Registrar
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Próximos passos (até 3)</Label>
              {fields.map((fieldItem, index) => (
                <div key={fieldItem.id} className="flex items-start gap-2">
                  <FormField
                    control={form.control}
                    name={`proximos_passos.${index}.titulo`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input placeholder="Próximo passo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`proximos_passos.${index}.data`}
                    render={({ field }) => (
                      <FormItem className="w-40 shrink-0">
                        <FormControl>
                          <DatePicker value={field.value} onChange={field.onChange} placeholder="Data" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} aria-label="Remover passo">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {fields.length < 3 && (
                <Button type="button" variant="secondary" size="sm" onClick={() => append({ titulo: '', data: '' })}>
                  <Plus className="h-4 w-4" />
                  Adicionar passo
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <Label>O que preciso de você</Label>
              {overdueTasks.length > 0 && (
                <div className="rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground">
                  <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground/70">Tarefas atrasadas (automático)</p>
                  {overdueTasks.map((t) => (
                    <div key={t.id} className="flex items-center gap-1">
                      <span>{t.title}</span>
                      <Badge className="border-destructive/20 bg-destructive/10 text-destructive">atrasada</Badge>
                    </div>
                  ))}
                </div>
              )}
              <FormField
                control={form.control}
                name="pendencias_cliente_texto"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea placeholder="Outras pendências, em texto livre..." {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>

        <DialogFooter className="gap-2">
          <Button type="button" variant="secondary" disabled={!!saving} onClick={() => handleSave(false)}>
            {saving === 'draft' ? 'Salvando...' : 'Salvar rascunho'}
          </Button>
          <Button type="button" disabled={!!saving || (!isDraft && isEdit)} onClick={() => handleSave(true)}>
            {saving === 'publish' ? 'Publicando...' : 'Publicar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
