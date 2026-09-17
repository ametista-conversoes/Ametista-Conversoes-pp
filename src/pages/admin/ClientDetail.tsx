import { useState, type ChangeEvent } from 'react'
import { useParams } from 'react-router-dom'
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  FolderKanban,
  ListChecks,
  Mail,
  Phone,
  RefreshCw,
  Repeat,
  Target,
  Trash2,
  Upload,
  UsersRound,
} from 'lucide-react'
import { toast } from 'sonner'
import { CatalogCard } from '@/components/admin/CatalogCard'
import { ClientAccessCard } from '@/components/admin/ClientAccessCard'
import { ClientPerformanceMetricsCard } from '@/components/admin/ClientPerformanceMetricsCard'
import { ClientPlatformCard } from '@/components/admin/ClientPlatformCard'
import { MetricAlertThresholdsCard } from '@/components/admin/MetricAlertThresholdsCard'
import { NewProjectDialog } from '@/components/admin/NewProjectDialog'
import { CassieChatThread } from '@/components/cassie/CassieChatThread'
import { CassieHeader } from '@/components/cassie/CassieHeader'
import { CassieMessageForm } from '@/components/cassie/CassieMessageForm'
import { OptionBreakdownBarChart } from '@/components/charts/OptionBreakdownBarChart'
import { ProjectDetailDialog } from '@/components/project/ProjectDetailDialog'
import { ApplyWorkflowDialog } from '@/components/workflows/ApplyWorkflowDialog'
import type { ManagerProjectRecord } from '@/hooks/useManagerPortalData'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { DatePicker } from '@/components/ui/date-picker'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCassieDraft } from '@/hooks/useCassieDraft'
import { useCassieMessages, useCassieSending, useClearCassieHistory, useSendCassieMessage } from '@/hooks/useCassieMessages'
import {
  useActivityChecklistItems,
  useAllAlerts,
  useAllIncidents,
  useAllMeetings,
  useAllProjects,
  useAllSmartGoals,
  useAllTasks,
  useAudienceInsights,
  useDeleteProject,
  useManagerClient,
  useRecomputeClientHealthScore,
  useToggleActivityChecklistItem,
  useUpdateClientDetails,
  useUpdateClientStatus,
  useUpdateProject,
} from '@/hooks/useManagerPortalData'
import { CASSIE_MODES, type CassieMode } from '@/lib/cassie-modes'
import { formatDate, formatDateTime } from '@/lib/format'
import { getClientRiskDetails } from '@/lib/client-risk'
import { effectiveActivityCompleted, isCompletionStale, recurrenceShortLabels, type RecurrenceInterval } from '@/lib/recurrence'
import { uploadClientLogo } from '@/lib/storage'
import {
  clientStatusLabels,
  clientStatusStyles,
  connectionProviderLabels,
  getHealthScoreColor,
  meetingStatusLabels,
  meetingStatusStyles,
  planLabels,
  projectStatusLabels,
  projectStatusStyles,
  smartGoalStatusLabels,
  smartGoalStatusStyles,
  taskPriorityLabels,
  taskStatusLabels,
  taskStatusStyles,
} from '@/lib/status-styles'
import { cn } from '@/lib/utils'

const CHANGEABLE_STATUSES = ['active', 'onboarding', 'paused', 'at_risk', 'churned']
const PROJECT_CHANGEABLE_STATUSES = ['planning', 'active', 'paused', 'completed', 'cancelled']

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const { data: client, isLoading, isError: clientIsError } = useManagerClient(id ?? null)
  const { data: projects } = useAllProjects()
  const { data: tasks } = useAllTasks()
  const { data: goals } = useAllSmartGoals()
  const { data: meetings } = useAllMeetings()
  const { data: alerts } = useAllAlerts()
  const { data: incidents } = useAllIncidents()
  const { data: audienceInsights } = useAudienceInsights(id ?? null)
  const { data: activityItems } = useActivityChecklistItems()
  const toggleActivityItem = useToggleActivityChecklistItem()
  const updateStatus = useUpdateClientStatus()
  const updateDetails = useUpdateClientDetails()
  const recomputeHealthScore = useRecomputeClientHealthScore()
  const { data: cassieMessages } = useCassieMessages(id ?? '')
  const sendCassieMessage = useSendCassieMessage(id ?? '')
  const clearCassieHistory = useClearCassieHistory(id ?? '')
  const isCassieSending = useCassieSending(id ?? '')
  const [cassieDraft, setCassieDraft] = useCassieDraft(id ?? '')

  // Fase 36.1 — mesma ideia de Activities.tsx: concluída (recorrente ou
  // não) some daqui depois de 1 dia, sem apagar nada; esse toggle só
  // decide se mostra de novo, igual o "mostrar concluídas antigas" da
  // aba Atividades.
  const [showStaleActivities, setShowStaleActivities] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [selectedProject, setSelectedProject] = useState<ManagerProjectRecord | null>(null)
  const [projectToDelete, setProjectToDelete] = useState<ManagerProjectRecord | null>(null)
  const updateProject = useUpdateProject()
  const deleteProject = useDeleteProject()
  const [cassieMode, setCassieMode] = useState<CassieMode>(CASSIE_MODES[0])
  const [name, setName] = useState<string | null>(null)
  const [company, setCompany] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [plan, setPlan] = useState<string | null>(null)
  const [monthlyFee, setMonthlyFee] = useState<string | null>(null)
  const [phone, setPhone] = useState<string | null>(null)
  const [renewalDate, setRenewalDate] = useState<string | null>(null)
  const [notes, setNotes] = useState<string | null>(null)
  const [leadsToClose, setLeadsToClose] = useState<string | null>(null)
  const [averageTicket, setAverageTicket] = useState<string | null>(null)
  const [savingDetails, setSavingDetails] = useState(false)

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando...</p>
  }

  if (clientIsError) {
    return <p className="text-sm text-destructive">Erro ao carregar os dados. Tente novamente.</p>
  }

  if (!client) {
    return (
      <div className="rounded-xl border border-[#1A2540] bg-[#131C31] p-6 text-sm text-muted-foreground">
        Cliente não encontrado.
      </div>
    )
  }

  const nameValue = name ?? client.name
  const companyValue = company ?? client.company ?? ''
  const emailValue = email ?? client.email ?? ''
  const planValue = plan ?? client.plan ?? ''
  const monthlyFeeValue = monthlyFee ?? (client.monthly_fee != null ? String(client.monthly_fee) : '')
  const phoneValue = phone ?? client.phone ?? ''
  const renewalDateValue = renewalDate ?? client.renewal_date ?? ''
  const notesValue = notes ?? client.internal_notes ?? ''
  const leadsToCloseValue = leadsToClose ?? (client.leads_to_close != null ? String(client.leads_to_close) : '')
  const averageTicketValue = averageTicket ?? (client.average_ticket != null ? String(client.average_ticket) : '')

  async function handleLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !client) return
    setUploadingLogo(true)
    try {
      const url = await uploadClientLogo(file, client.id)
      await updateDetails.mutateAsync({
        id: client.id,
        name: client.name,
        company: client.company,
        email: client.email,
        plan: client.plan,
        monthly_fee: client.monthly_fee,
        phone: client.phone,
        logo_url: url,
        renewal_date: client.renewal_date,
        internal_notes: client.internal_notes,
        leads_to_close: client.leads_to_close,
        average_ticket: client.average_ticket,
      })
      toast.success('Logo atualizada.')
    } catch {
      toast.error('Não foi possível enviar a logo.')
    } finally {
      setUploadingLogo(false)
    }
  }

  async function handleSaveDetails() {
    if (!client) return
    setSavingDetails(true)
    try {
      await updateDetails.mutateAsync({
        id: client.id,
        name: nameValue.trim() ? nameValue.trim() : client.name,
        company: companyValue.trim() ? companyValue.trim() : null,
        email: emailValue.trim() ? emailValue.trim() : null,
        plan: planValue.trim() ? planValue.trim() : null,
        monthly_fee: monthlyFeeValue.trim() ? Number(monthlyFeeValue) : null,
        phone: phoneValue.trim() ? phoneValue.trim() : null,
        logo_url: client.logo_url,
        renewal_date: renewalDateValue.trim() ? renewalDateValue : null,
        internal_notes: notesValue.trim() ? notesValue.trim() : null,
        leads_to_close: leadsToCloseValue.trim() ? Number(leadsToCloseValue) : null,
        average_ticket: averageTicketValue.trim() ? Number(averageTicketValue) : null,
      })
      toast.success('Dados do cliente atualizados.')
    } catch {
      // erro já avisado pelo onError do hook
    } finally {
      setSavingDetails(false)
    }
  }

  const clientProjects = (projects ?? []).filter((p) => p.client_id === client.id)
  const clientTasks = (tasks ?? []).filter((t) => t.client_id === client.id)
  const clientGoals = (goals ?? []).filter((g) => g.client_id === client.id)
  const clientMeetings = (meetings ?? []).filter((m) => m.client_id === client.id)
  const clientActivityItems = (activityItems ?? []).filter((i) => i.client_id === client.id)
  const isStaleActivity = (item: (typeof clientActivityItems)[number]) =>
    effectiveActivityCompleted(item.completed, item.recurrence_interval, item.completed_at, client.plan) &&
    isCompletionStale(item.completed_at)
  const staleActivityCount = clientActivityItems.filter(isStaleActivity).length
  const visibleClientActivityItems = showStaleActivities
    ? clientActivityItems
    : clientActivityItems.filter((item) => !isStaleActivity(item))
  const riskDetails = getClientRiskDetails(client.id, {
    incidents: incidents ?? [],
    alerts: alerts ?? [],
    tasks: tasks ?? [],
    goals: goals ?? [],
  })

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Portal Gestor</p>
        <h1 className="text-2xl font-semibold text-foreground">Central de Informações</h1>
      </div>

      {/* Cabeçalho */}
      <Card className="rounded-xl border border-[#1A2540] bg-[#131C31] p-5 hover:border-purple-600/30 md:p-6">
        <CardContent className="flex flex-wrap items-center gap-4 p-0">
          <label className="relative flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-secondary/50 text-muted-foreground hover:opacity-80">
            {client.logo_url ? (
              <img src={client.logo_url} alt={client.name} className="h-full w-full object-cover" />
            ) : (
              <Building2 className="h-6 w-6" />
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100">
              <Upload className="h-4 w-4 text-white" />
            </span>
            <input type="file" accept="image/*" className="hidden" disabled={uploadingLogo} onChange={handleLogoChange} />
          </label>

          <div className="min-w-0 flex-1 space-y-1.5">
            <Input
              value={nameValue}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do cliente"
              className="h-9 text-base font-semibold"
            />
            <Input
              value={companyValue}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Nome do negócio (ex: Loja Aurora)"
              className="h-8 text-sm text-muted-foreground"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={updateStatus.isPending}>
              <Badge className={`cursor-pointer ${clientStatusStyles[client.status]}`}>
                {clientStatusLabels[client.status] ?? client.status}
              </Badge>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {CHANGEABLE_STATUSES.map((status) => (
                <DropdownMenuItem key={status} onSelect={() => updateStatus.mutate({ clientId: client.id, status })}>
                  {clientStatusLabels[status]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </CardContent>
      </Card>

      {/* Contato + dados do plano */}
      <div className="content-grid-container">
        <div className="content-grid gap-4">
          <Card className="rounded-xl border border-[#1A2540] bg-[#131C31] p-5 hover:border-purple-600/30 md:p-6">
            <CardHeader className="p-0">
              <CardTitle className="text-base">Contato</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-0 pt-4 text-sm">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="contato@empresa.com"
                  value={emailValue}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-8"
                />
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Input
                  placeholder="(00) 00000-0000"
                  value={phoneValue}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-8"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-[#1A2540] bg-[#131C31] p-5 hover:border-purple-600/30 md:p-6">
            <CardHeader className="p-0">
              <CardTitle className="text-base">Plano</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-0 pt-4 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="shrink-0 text-muted-foreground">Plano</span>
                <Select value={planValue} onValueChange={setPlan}>
                  <SelectTrigger className="h-8 w-40">
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(planLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="shrink-0 text-muted-foreground">Mensalidade</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={monthlyFeeValue}
                  onChange={(e) => setMonthlyFee(e.target.value)}
                  className="h-8 w-32"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="shrink-0 text-muted-foreground">Leads p/ fechar 1 venda</span>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="Ex: 10"
                  value={leadsToCloseValue}
                  onChange={(e) => setLeadsToClose(e.target.value)}
                  className="h-8 w-32"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="shrink-0 text-muted-foreground">Ticket médio</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={averageTicketValue}
                  onChange={(e) => setAverageTicket(e.target.value)}
                  className="h-8 w-32"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="shrink-0 text-muted-foreground">Health Score</span>
                <div className="flex items-center gap-2">
                  <span className={cn('font-medium', getHealthScoreColor(client.health_score))}>
                    {client.health_score ?? '—'}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={recomputeHealthScore.isPending}
                    onClick={() => recomputeHealthScore.mutate(client.id)}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${recomputeHealthScore.isPending ? 'animate-spin' : ''}`} />
                    Recalcular agora
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-[#1A2540] bg-[#131C31] p-5 hover:border-purple-600/30 md:p-6">
            <CardHeader className="p-0">
              <CardTitle className="text-base">Renovação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-0 pt-4">
              <Label className="text-xs text-muted-foreground">Data de renovação</Label>
              <DatePicker value={renewalDateValue} onChange={setRenewalDate} />
            </CardContent>
          </Card>
        </div>
      </div>

      <ClientPlatformCard clientId={client.id} />

      {/* Tarefas, Metas, Reuniões, Atividades */}
      <div className="content-grid-container">
        <div className="content-grid gap-4">
          <Card className="rounded-xl border border-[#1A2540] bg-[#131C31] p-5 hover:border-purple-600/30 md:p-6">
            <CardHeader className="p-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckSquare className="h-4 w-4 text-purple-400" />
                Tarefas
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-[560px] space-y-2 overflow-y-auto p-0 pt-4 pr-1">
              {clientTasks.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma tarefa.</p>}
              {clientTasks.map((task) => (
                <div key={task.id} className="rounded-lg bg-secondary/50 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="truncate text-sm text-foreground">{task.title}</p>
                    <Badge className={taskStatusStyles[task.status]}>{taskStatusLabels[task.status] ?? task.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {taskPriorityLabels[task.priority] ?? task.priority}
                    {task.due_date ? ` · Prazo: ${formatDate(task.due_date)}` : ''}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-[#1A2540] bg-[#131C31] p-5 hover:border-purple-600/30 md:p-6">
            <CardHeader className="p-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-4 w-4 text-purple-400" />
                Metas SMART
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-[560px] space-y-3 overflow-y-auto p-0 pt-4 pr-1">
              {clientGoals.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma meta.</p>}
              {clientGoals.map((goal) => {
                const target = goal.target_value ?? 0
                const current = goal.current_value ?? 0
                const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0
                return (
                  <div key={goal.id} className="rounded-lg bg-secondary/50 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="truncate text-sm text-foreground">{goal.title}</p>
                      <Badge className={smartGoalStatusStyles[goal.status]}>
                        {smartGoalStatusLabels[goal.status] ?? goal.status}
                      </Badge>
                    </div>
                    <Progress value={percent} className="mt-1" />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {current} de {target} ({percent}%)
                      {goal.target_date ? ` · Prazo: ${formatDate(goal.target_date)}` : ''}
                    </p>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-[#1A2540] bg-[#131C31] p-5 hover:border-purple-600/30 md:p-6">
            <CardHeader className="p-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4 text-purple-400" />
                Reuniões
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-[560px] space-y-2 overflow-y-auto p-0 pt-4 pr-1">
              {clientMeetings.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma reunião.</p>}
              {clientMeetings.map((meeting) => (
                <div key={meeting.id} className="rounded-lg bg-secondary/50 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="truncate text-sm text-foreground">{meeting.title}</p>
                    <Badge className={meetingStatusStyles[meeting.status]}>
                      {meetingStatusLabels[meeting.status] ?? meeting.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{formatDateTime(meeting.date)}</p>
                  {meeting.status === 'cancelled' && meeting.cancellation_reason && (
                    <p className="mt-1 text-xs text-muted-foreground">Motivo: {meeting.cancellation_reason}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-[#1A2540] bg-[#131C31] p-5 hover:border-purple-600/30 md:p-6">
            <CardHeader className="flex-row items-center justify-between p-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <ListChecks className="h-4 w-4 text-purple-400" />
                Atividades
              </CardTitle>
              {staleActivityCount > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setShowStaleActivities((v) => !v)}
                >
                  {showStaleActivities ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {showStaleActivities ? 'Ocultar' : 'Mostrar'} concluídas ({staleActivityCount})
                </Button>
              )}
            </CardHeader>
            <CardContent className="max-h-[560px] space-y-2 overflow-y-auto p-0 pt-4 pr-1">
              {visibleClientActivityItems.length === 0 && <p className="text-sm text-muted-foreground">Nenhum item.</p>}
              {visibleClientActivityItems.map((item) => {
                const isDone = effectiveActivityCompleted(item.completed, item.recurrence_interval, item.completed_at, client.plan)
                return (
                  <label
                    key={item.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg bg-secondary/50 px-3 py-2"
                  >
                    <Checkbox
                      checked={isDone}
                      disabled={toggleActivityItem.isPending}
                      onCheckedChange={(checked) =>
                        toggleActivityItem.mutate({ itemId: item.id, completed: checked === true })
                      }
                    />
                    <div className="min-w-0">
                      <p className={`truncate text-sm ${isDone ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                        {item.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        {item.source_template_name ?? 'Avulsa'}
                        {item.category ? ` · ${item.category}` : ''}
                        {item.recurrence_interval && (
                          <Badge className="gap-1 border-purple-600/20 bg-purple-600/10 text-[10px] text-purple-300">
                            <Repeat className="h-2.5 w-2.5" />
                            {recurrenceShortLabels[item.recurrence_interval as RecurrenceInterval]}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </label>
                )
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      <ClientPerformanceMetricsCard client={client} />

      {/* Cliente em risco — só aparece se houver algum problema de verdade */}
      {riskDetails.hasProblems && (
        <Card className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 md:p-6">
          <CardHeader className="p-0">
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Cliente em risco
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 p-0 pt-4 text-sm sm:grid-cols-4">
            <div>
              <p className="text-lg font-semibold text-foreground">{riskDetails.overdueTasks}</p>
              <p className="text-xs text-muted-foreground">Tarefas atrasadas</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">{riskDetails.overdueGoals}</p>
              <p className="text-xs text-muted-foreground">Metas não concluídas no prazo</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">{riskDetails.activeAlerts}</p>
              <p className="text-xs text-muted-foreground">Alertas não resolvidos</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">{riskDetails.activeIncidents}</p>
              <p className="text-xs text-muted-foreground">Incidentes abertos</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Projetos */}
      <Card className="rounded-xl border border-[#1A2540] bg-[#131C31] p-5 hover:border-purple-600/30 md:p-6">
        <CardHeader className="flex flex-wrap items-center justify-between gap-2 p-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <FolderKanban className="h-4 w-4 text-purple-400" />
            Projetos
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <ApplyWorkflowDialog lockedClientId={client.id} />
            <NewProjectDialog clientId={client.id} />
          </div>
        </CardHeader>
        <CardContent className="space-y-2 p-0 pt-4">
          {clientProjects.length === 0 && <p className="text-sm text-muted-foreground">Nenhum projeto ainda.</p>}
          {clientProjects.map((project) => (
            <div key={project.id} className="rounded-lg bg-secondary/50 px-3 py-2 hover:bg-secondary">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p
                  className="cursor-pointer text-sm font-medium text-foreground"
                  onClick={() => setSelectedProject(project)}
                >
                  {project.title}
                </p>
                <div className="flex items-center gap-1">
                  {project.platform && (
                    <Badge className="border-[#1A2540] bg-secondary/50 text-muted-foreground">
                      {connectionProviderLabels[project.platform] ?? project.platform}
                    </Badge>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild disabled={updateProject.isPending}>
                      <Badge className={cn('cursor-pointer', projectStatusStyles[project.status])}>
                        {projectStatusLabels[project.status] ?? project.status}
                      </Badge>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {PROJECT_CHANGEABLE_STATUSES.map((status) => (
                        <DropdownMenuItem
                          key={status}
                          onSelect={() => updateProject.mutate({ id: project.id, status })}
                        >
                          {projectStatusLabels[status]}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => setProjectToDelete(project)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="cursor-pointer" onClick={() => setSelectedProject(project)}>
                {project.objective && <p className="mt-1 text-xs text-muted-foreground">Objetivo: {project.objective}</p>}
                {project.description && (
                  <p className="mt-1 text-xs text-muted-foreground/70">{project.description}</p>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <CatalogCard clientId={client.id} catalogType="criativo" />

      <CatalogCard clientId={client.id} catalogType="segmentacao" />

      {/* Público-Alvo (Fase 8.5) — síntese em % das perguntas fechadas
          dos Google Forms conectados (mesmo cálculo/gráfico da aba
          dedicada "Públicos-Alvo", Fase 8.3). Visão simples, sem
          seletor de formulário/busca/agrupamento — só aparece se o
          cliente já tiver alguma pergunta fechada sincronizada. */}
      {(audienceInsights ?? []).length > 0 && (
        <Card className="rounded-xl border border-[#1A2540] bg-[#131C31] p-5 hover:border-purple-600/30 md:p-6">
          <CardHeader className="p-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <UsersRound className="h-4 w-4 text-purple-400" />
              Público-Alvo
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[560px] space-y-4 overflow-y-auto p-0 pt-4 pr-1">
            {(audienceInsights ?? []).map((question) => (
              <div key={question.questionId} className="rounded-lg bg-secondary/50 px-3 py-3">
                <p className="text-sm font-medium text-foreground">{question.title}</p>
                <p className="mb-2 text-xs text-muted-foreground">
                  {question.totalRespondents} resposta{question.totalRespondents === 1 ? '' : 's'}
                </p>
                {question.totalRespondents === 0 ? (
                  <p className="text-sm text-muted-foreground">Ainda sem respostas.</p>
                ) : (
                  <OptionBreakdownBarChart data={question.options} />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Observações internas */}
      <Card className="rounded-xl border border-[#1A2540] bg-[#131C31] p-5 hover:border-purple-600/30 md:p-6">
        <CardHeader className="p-0">
          <CardTitle className="text-base">Observações internas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-0 pt-4">
          <p className="text-xs text-muted-foreground">Só a agência vê isso — o cliente nunca tem acesso.</p>
          <Textarea
            placeholder="Anotações internas sobre esse cliente..."
            value={notesValue}
            onChange={(e) => setNotes(e.target.value)}
          />
          <Button onClick={handleSaveDetails} disabled={savingDetails}>
            {savingDetails ? 'Salvando...' : 'Salvar'}
          </Button>
        </CardContent>
      </Card>

      <ClientAccessCard clientId={client.id} />

      <MetricAlertThresholdsCard clientId={client.id} />

      {/* Cassie IA — conversa própria do gestor sobre esse cliente,
          separada da conversa que o próprio cliente tem com a Cassie.
          Admin/gestor sempre veem os 4 modos, independente do plano. */}
      <Card className="rounded-xl border border-[#1A2540] bg-[#131C31] p-5 hover:border-purple-600/30 md:p-6">
        <CardContent className="space-y-4 p-0">
          <CassieHeader
            plan={client.plan}
            allowedModes={CASSIE_MODES}
            mode={cassieMode}
            onModeChange={setCassieMode}
            onClearHistory={() => clearCassieHistory.mutate()}
            clearing={clearCassieHistory.isPending}
            hasMessages={(cassieMessages ?? []).length > 0}
          />
          <CassieChatThread messages={cassieMessages ?? []} sending={isCassieSending} />
          <CassieMessageForm
            value={cassieDraft}
            onChange={setCassieDraft}
            onSend={(text) => sendCassieMessage.mutate({ message: text, mode: cassieMode })}
            sending={isCassieSending}
          />
        </CardContent>
      </Card>

      <ProjectDetailDialog
        project={selectedProject}
        tasks={clientTasks.filter((task) => task.project_id === selectedProject?.id)}
        onOpenChange={(open) => !open && setSelectedProject(null)}
      />

      <Dialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apagar projeto</DialogTitle>
            <DialogDescription>
              Tem certeza que quer apagar "{projectToDelete?.title}"? As tarefas ligadas a ele deixam de ter
              projeto, mas não são apagadas. Essa ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProjectToDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={deleteProject.isPending}
              onClick={() => {
                if (!projectToDelete) return
                deleteProject.mutate(projectToDelete.id, {
                  onSuccess: () => {
                    setProjectToDelete(null)
                    if (selectedProject?.id === projectToDelete.id) setSelectedProject(null)
                  },
                })
              }}
            >
              Apagar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
