import { useEffect, useState } from 'react'
import { AlertTriangle, Check, Pencil, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { DeleteModeToggle } from '@/components/shared/DeleteModeToggle'
import { KanbanTaskFormDialog } from '@/components/kanban/KanbanTaskFormDialog'
import { AdGroupsTab } from '@/components/project/AdGroupsTab'
import { CampaignTestsTab } from '@/components/project/CampaignTestsTab'
import { ProjectCampaignLinksField } from '@/components/project/ProjectCampaignLinksField'
import { ManagerTaskRow } from '@/components/tasks/ManagerTaskRow'
import type { ManagerProjectRecord, ManagerTaskRecord } from '@/hooks/useManagerPortalData'
import {
  useCampaignPerformance,
  useDigitalAssetConnections,
  useManagerClient,
  useProblemCampaignLinks,
  useProjectCampaignLinks,
  useUpdateProject,
} from '@/hooks/useManagerPortalData'
import { formatCurrency, formatDate, formatMultiplier, formatPercent } from '@/lib/format'
import { computeRoas } from '@/lib/metrics'
import { segmentationOptionGroups } from '@/lib/segmentation-options'
import {
  campaignStateLabels,
  campaignTypeLabels,
  connectionProviderLabels,
  projectStatusLabels,
  projectStatusStyles,
} from '@/lib/status-styles'
import { useForm } from 'react-hook-form'

interface ProjectDetailDialogProps {
  project: ManagerProjectRecord | null
  tasks: ManagerTaskRecord[]
  onOpenChange: (open: boolean) => void
}

interface CampaignFormValues {
  icp: string
  keywords: string
  segmentations: string[]
  objective: string
  systems: string
  description: string
  conversion_type: 'vendas' | 'leads'
  test_type: 'nenhum' | 'segmentacao' | 'anuncio' | 'campanha'
  platform: 'google_ads' | 'meta_ads'
}

const conversionTypeLabels: Record<'vendas' | 'leads', string> = {
  vendas: 'Vendas',
  leads: 'Leads',
}

const testTypeLabels: Record<'nenhum' | 'segmentacao' | 'anuncio' | 'campanha', string> = {
  nenhum: 'Nenhum',
  segmentacao: 'Segmentação',
  anuncio: 'Anúncio',
  campanha: 'Campanha',
}

export function ProjectDetailDialog({ project, tasks, onOpenChange }: ProjectDetailDialogProps) {
  const updateProject = useUpdateProject()
  const [deleteMode, setDeleteMode] = useState(false)
  const [editingRevenue, setEditingRevenue] = useState(false)
  const [revenueDraft, setRevenueDraft] = useState('')

  const form = useForm<CampaignFormValues>({
    defaultValues: {
      icp: '',
      keywords: '',
      segmentations: [],
      objective: '',
      systems: '',
      description: '',
      conversion_type: 'leads',
      test_type: 'nenhum',
      platform: 'google_ads',
    },
  })

  useEffect(() => {
    if (!project) return
    form.reset({
      icp: project.icp ?? '',
      keywords: project.keywords ?? '',
      segmentations: project.segmentations,
      objective: project.objective ?? '',
      systems: project.systems ?? '',
      description: project.description ?? '',
      conversion_type: project.conversion_type,
      test_type: project.test_type,
      // Projeto criado antes da Fase 34d não tem plataforma salva —
      // cai em "google_ads" só pra sempre ter uma seleção válida no
      // Select; salvar de novo já grava a plataforma de verdade.
      platform: project.platform ?? 'google_ads',
    })
    setEditingRevenue(false)
  }, [project, form])

  async function handleSaveRevenue() {
    if (!project) return
    const parsed = revenueDraft.trim() === '' ? null : Number(revenueDraft.replace(',', '.'))
    if (parsed !== null && Number.isNaN(parsed)) {
      toast.error('Digite um número válido.')
      return
    }
    try {
      await updateProject.mutateAsync({ id: project.id, revenue: parsed })
      toast.success('Receita atualizada.')
      setEditingRevenue(false)
    } catch {
      // erro já avisado pelo onError do hook
    }
  }

  async function onSubmit(values: CampaignFormValues) {
    if (!project) return
    try {
      await updateProject.mutateAsync({
        id: project.id,
        icp: values.icp.trim() ? values.icp.trim() : null,
        keywords: values.keywords.trim() ? values.keywords.trim() : null,
        segmentations: values.segmentations,
        objective: values.objective.trim() ? values.objective.trim() : null,
        systems: values.systems.trim() ? values.systems.trim() : null,
        description: values.description.trim() ? values.description.trim() : null,
        conversion_type: values.conversion_type,
        test_type: values.test_type,
        platform: values.platform,
      })
      toast.success('Campanha atualizada.')
    } catch {
      // erro já avisado pelo onError do hook
    }
  }

  const segmentations = form.watch('segmentations')
  const campaignLinksQuery = useProjectCampaignLinks(project?.id ?? null)
  const campaignLinks = campaignLinksQuery.data ?? []
  const hasLinkedCampaigns = campaignLinks.length > 0
  const campaignPerformance = useCampaignPerformance(
    campaignLinks.map((l) => ({ connectionId: l.connection_id, campaignId: l.external_campaign_id })),
  )
  const effectiveSpend = hasLinkedCampaigns ? (campaignPerformance.data?.spend ?? null) : (project?.spend ?? null)

  // Receita automática (só quando vinculado a pelo menos 1 campanha
  // real e o cliente tem Ticket Médio configurado): "Vendas" pula a
  // divisão por leads_to_close porque cada conversão já é uma venda;
  // "Leads" segue a mesma fórmula de computeRevenueFromLeads
  // (src/lib/metrics.ts), só que aplicada aqui por projeto em vez de
  // conta inteira, somando as conversões de TODAS as campanhas
  // vinculadas. Só entra em ação enquanto `project.revenue` nunca foi
  // digitado manualmente (fica null até o gestor editar pela primeira
  // vez) — depois disso o valor manual sempre vence, mesmo que volte a
  // ficar igual ao automático por coincidência.
  const client = useManagerClient(project?.client_id ?? null)
  const conversionType = project?.conversion_type ?? 'leads'
  const linkedConversions = hasLinkedCampaigns ? (campaignPerformance.data?.conversions ?? null) : null
  const averageTicket = client.data?.average_ticket ?? null
  const leadsToClose = client.data?.leads_to_close ?? null
  const autoRevenue = (() => {
    if (linkedConversions == null || averageTicket == null) return null
    if (conversionType === 'vendas') return linkedConversions * averageTicket
    if (leadsToClose == null || leadsToClose <= 0) return null
    return (linkedConversions / leadsToClose) * averageTicket
  })()
  const usingAutoRevenue = project?.revenue == null && autoRevenue != null
  const effectiveRevenue = usingAutoRevenue ? autoRevenue : (project?.revenue ?? null)

  const digitalAssetConnections = useDigitalAssetConnections()
  const problemCampaignLinksQuery = useProblemCampaignLinks()
  const projectProblems = (problemCampaignLinksQuery.data ?? []).filter((link) => link.project_id === project?.id)

  return (
    <Dialog open={!!project} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        {project && (
          <>
            <DialogHeader>
              <DialogTitle>{project.title}</DialogTitle>
            </DialogHeader>

            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Visão Geral</TabsTrigger>
                <TabsTrigger value="tasks">Tarefas</TabsTrigger>
                <TabsTrigger value="campaign">Campanha</TabsTrigger>
                <TabsTrigger value="ad-groups">Grupos de Anúncios</TabsTrigger>
                {project.test_type !== 'nenhum' && <TabsTrigger value="tests">Testes</TabsTrigger>}
              </TabsList>

              <TabsContent value="overview" className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={projectStatusStyles[project.status]}>
                    {projectStatusLabels[project.status] ?? project.status}
                  </Badge>
                  {project.platform && (
                    <Badge className="border-[#1A2540] bg-secondary/50 text-muted-foreground">
                      {connectionProviderLabels[project.platform] ?? project.platform}
                    </Badge>
                  )}
                  {project.channel && (
                    <Badge className="border-[#1A2540] bg-secondary/50 text-muted-foreground">{project.channel}</Badge>
                  )}
                  <Badge className="border-[#1A2540] bg-secondary/50 text-muted-foreground">
                    {conversionTypeLabels[conversionType]}
                  </Badge>
                  {(campaignPerformance.data?.campaignTypes ?? []).map((type) => (
                    <Badge key={type} className="border-[#1A2540] bg-secondary/50 text-muted-foreground">
                      {campaignTypeLabels[type] ?? type}
                    </Badge>
                  ))}
                  {project.test_type !== 'nenhum' && (
                    <Badge className="border-purple-600/20 bg-purple-600/15 text-purple-400">
                      Teste A/B — {testTypeLabels[project.test_type]}
                    </Badge>
                  )}
                </div>

                {projectProblems.length > 0 && (
                  <div className="space-y-1 rounded-lg border border-orange-500/20 bg-orange-500/10 px-3 py-2">
                    {projectProblems.map((problem) => (
                      <p key={problem.id} className="flex items-center gap-1.5 text-xs text-orange-400">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        Campanha "{problem.external_campaign_name ?? problem.external_campaign_id}"{' '}
                        {campaignStateLabels[problem.last_known_status]?.toLowerCase() ?? problem.last_known_status} no{' '}
                        {connectionProviderLabels[problem.provider] ?? problem.provider}.
                      </p>
                    ))}
                  </div>
                )}

                {hasLinkedCampaigns && (
                  <p className="text-xs text-muted-foreground">
                    CPA, CTR e gasto abaixo vêm d{campaignLinks.length > 1 ? 'as campanhas vinculadas' : 'a campanha vinculada'} (
                    {campaignLinks.map((l) => l.external_campaign_name ?? l.external_campaign_id).join(', ')}), últimos 30 dias.{' '}
                    {usingAutoRevenue
                      ? 'Receita calculada automaticamente a partir das conversões e do Ticket Médio do cliente.'
                      : 'Os provedores de anúncio não reportam faturamento — configure o Ticket Médio do cliente pra calcular a Receita automaticamente, ou digite manualmente.'}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">CPA</p>
                    <p className="text-foreground">
                      {formatCurrency(hasLinkedCampaigns ? (campaignPerformance.data?.cpa ?? null) : project.cpa)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">ROAS</p>
                    <p className="text-foreground">{formatMultiplier(computeRoas(effectiveRevenue ?? 0, effectiveSpend ?? 0))}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">CTR</p>
                    <p className="text-foreground">
                      {formatPercent(hasLinkedCampaigns ? (campaignPerformance.data?.ctr ?? null) : project.ctr)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Gasto</p>
                    <p className="text-foreground">{formatCurrency(effectiveSpend)}</p>
                  </div>
                  {hasLinkedCampaigns && (
                    <div>
                      <p className="text-xs text-muted-foreground">CPC médio</p>
                      <p className="text-foreground">{formatCurrency(campaignPerformance.data?.cpc ?? null)}</p>
                    </div>
                  )}
                  {hasLinkedCampaigns && !!campaignPerformance.data?.conversionValue && (
                    <div>
                      <p className="text-xs text-muted-foreground">Valor de conversão (plataforma)</p>
                      <p className="text-foreground">{formatCurrency(campaignPerformance.data.conversionValue)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground">Receita</p>
                    {editingRevenue ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="0.01"
                          autoFocus
                          value={revenueDraft}
                          onChange={(e) => setRevenueDraft(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveRevenue()}
                          className="h-7 text-sm"
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 shrink-0"
                          disabled={updateProject.isPending}
                          onClick={handleSaveRevenue}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 shrink-0"
                          disabled={updateProject.isPending}
                          onClick={() => setEditingRevenue(false)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : usingAutoRevenue ? (
                      <div>
                        <p className="text-foreground">{formatCurrency(autoRevenue)}</p>
                        <button
                          type="button"
                          className="text-[11px] text-muted-foreground underline hover:text-purple-400"
                          onClick={() => {
                            setRevenueDraft(autoRevenue != null ? String(autoRevenue) : '')
                            setEditingRevenue(true)
                          }}
                        >
                          calculado automaticamente ({conversionTypeLabels[conversionType].toLowerCase()}) — editar manualmente
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="group flex items-center gap-1.5 text-foreground"
                        onClick={() => {
                          setRevenueDraft(project.revenue != null ? String(project.revenue) : '')
                          setEditingRevenue(true)
                        }}
                      >
                        {formatCurrency(project.revenue)}
                        <Pencil className="h-3 w-3 text-muted-foreground/50 group-hover:text-purple-400" />
                      </button>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Período</p>
                    <p className="text-foreground">
                      {formatDate(project.start_date)} — {project.end_date ? formatDate(project.end_date) : 'sem data final'}
                    </p>
                  </div>
                </div>

                {project.objective && (
                  <div>
                    <p className="text-xs text-muted-foreground">Objetivo</p>
                    <p className="text-sm text-foreground">{project.objective}</p>
                  </div>
                )}
                {project.description && (
                  <div>
                    <p className="text-xs text-muted-foreground">Outras informações</p>
                    <p className="text-sm text-foreground">{project.description}</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="tasks" className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <DeleteModeToggle active={deleteMode} onToggle={() => setDeleteMode((v) => !v)} />
                  <KanbanTaskFormDialog
                    defaultClientId={project.client_id}
                    defaultProjectId={project.id}
                    trigger={
                      <Button size="sm">
                        <Plus className="h-4 w-4" />
                        Nova tarefa
                      </Button>
                    }
                  />
                </div>
                {tasks.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma tarefa neste projeto.</p>}
                {tasks.map((task) => (
                  <ManagerTaskRow key={task.id} task={task} deleteMode={deleteMode} />
                ))}
              </TabsContent>

              <TabsContent value="campaign" className="space-y-4">
                <div>
                  <label className="text-sm text-foreground">Plataforma</label>
                  <Select
                    value={form.watch('platform')}
                    onValueChange={(v) => form.setValue('platform', v as CampaignFormValues['platform'], { shouldDirty: true })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="google_ads">Google Ads</SelectItem>
                      <SelectItem value="meta_ads">Meta Ads</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm text-foreground">Tipo de conversão</label>
                  <Select value={form.watch('conversion_type')} onValueChange={(v) => form.setValue('conversion_type', v as 'vendas' | 'leads', { shouldDirty: true })}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vendas">Vendas (e-commerce, produto direto)</SelectItem>
                      <SelectItem value="leads">Leads (com processo de fechamento)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm text-foreground">Tipo de teste A/B</label>
                  <Select
                    value={form.watch('test_type')}
                    onValueChange={(v) => form.setValue('test_type', v as CampaignFormValues['test_type'], { shouldDirty: true })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhum">Nenhum</SelectItem>
                      <SelectItem value="segmentacao">Segmentação</SelectItem>
                      <SelectItem value="anuncio">Anúncio</SelectItem>
                      <SelectItem value="campanha">Campanha</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Diferente de "Nenhum" ganha uma aba "Testes" comparando as campanhas vinculadas abaixo como
                    variantes.
                  </p>
                </div>

                <div>
                  <p className="mb-2 text-sm text-foreground">Campanhas vinculadas (opcional)</p>
                  <ProjectCampaignLinksField projectId={project.id} clientId={project.client_id} links={campaignLinks} />
                </div>

                <div>
                  <label className="text-sm text-foreground">Público-alvo</label>
                  <Textarea
                    placeholder="Quem essa campanha busca atingir..."
                    {...form.register('icp')}
                    className="mt-1"
                  />
                </div>

                {(campaignPerformance.data?.campaignTypes ?? []).includes('SEARCH') && (
                  <div>
                    <label className="text-sm text-foreground">Palavras-chave</label>
                    <Textarea
                      placeholder="Palavras-chave dessa campanha de Pesquisa (uma por linha, ou como preferir documentar)..."
                      {...form.register('keywords')}
                      className="mt-1"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Só aparece porque essa campanha é do tipo Pesquisa (Search) — documentação manual, não
                      sincronizada. Termos de pesquisa e keywords de verdade já aparecem sincronizados na aba
                      "Grupos de Anúncios".
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-sm text-foreground">Segmentações</p>
                  <p className="mb-2 text-xs text-muted-foreground">
                    Referência de categorias comuns do Meta Ads e do Google Ads, pra padronizar como a segmentação é documentada.
                  </p>
                  <div className="max-h-52 space-y-3 overflow-y-auto rounded-lg bg-secondary/30 p-3">
                    {segmentationOptionGroups.map((group) => (
                      <div key={group.platform}>
                        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                          {group.platform}
                        </p>
                        <div className="space-y-1.5">
                          {group.options.map((option) => (
                            <label key={option} className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={segmentations.includes(option)}
                                onCheckedChange={(checked) =>
                                  form.setValue(
                                    'segmentations',
                                    checked === true
                                      ? [...segmentations, option]
                                      : segmentations.filter((s) => s !== option),
                                    { shouldDirty: true },
                                  )
                                }
                              />
                              <span className="text-foreground">{option}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm text-foreground">Objetivo</label>
                  <Textarea placeholder="Objetivo da campanha..." {...form.register('objective')} className="mt-1" />
                </div>

                <div>
                  <label className="text-sm text-foreground">Sistemas</label>
                  <Textarea
                    placeholder="Ex: HubSpot, RD Station, Google Analytics, WordPress..."
                    {...form.register('systems')}
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="text-sm text-foreground">Outras informações</label>
                  <Textarea
                    placeholder="Detalhes adicionais relevantes pra essa campanha..."
                    {...form.register('description')}
                    className="mt-1"
                  />
                </div>

                <Button onClick={form.handleSubmit(onSubmit)} disabled={updateProject.isPending}>
                  {updateProject.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
              </TabsContent>

              <TabsContent value="ad-groups">
                <AdGroupsTab links={campaignLinks} connections={digitalAssetConnections.data ?? []} />
              </TabsContent>

              {project.test_type !== 'nenhum' && (
                <TabsContent value="tests">
                  <CampaignTestsTab
                    projectId={project.id}
                    testType={project.test_type}
                    testMinSpend={project.test_min_spend}
                    links={campaignLinks}
                    connections={digitalAssetConnections.data ?? []}
                  />
                </TabsContent>
              )}
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
