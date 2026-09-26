import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { fetchLatestUpdatedAt, latestOf } from '@/lib/nav-activity'
import { supabase } from '@/lib/supabase'

export interface ClientRecord {
  id: string
  name: string
  company: string | null
  email: string | null
  status: string
  plan: string | null
  monthly_fee: number | null
  health_score: number | null
  health_performance: number | null
  health_financial: number | null
  health_delivery: number | null
  health_relationship: number | null
  phone: string | null
  logo_url: string | null
  renewal_date: string | null
  leads_to_close: number | null
  average_ticket: number | null
}

// Colunas explícitas (sem "*"): "internal_notes" é uma observação
// interna da agência e nunca deve trafegar pra sessão do próprio
// cliente, mesmo que nada exiba isso na tela dele hoje.
const CLIENT_SAFE_COLUMNS =
  'id, name, company, email, status, plan, monthly_fee, health_score, health_performance, health_financial, health_delivery, health_relationship, phone, logo_url, renewal_date, leads_to_close, average_ticket'

export interface ProjectRecord {
  id: string
  title: string
  status: string
  health_score: number | null
  cpa: number | null
  roas: number | null
  ctr: number | null
  spend: number | null
  revenue: number | null
  channel: string | null
  start_date: string | null
  end_date: string | null
  objective: string | null
  icp: string | null
  segment: string | null
}

export interface TaskRecord {
  id: string
  title: string
  description: string | null
  project_id: string | null
  status: string
  priority: string
  due_date: string | null
  category: string | null
  /** Fase 35 — recorrência (ver `src/lib/recurrence.ts`); usados pra
   * calcular o status "efetivo" (uma tarefa "done" recorrente volta a
   * aparecer como "todo" sozinha depois do intervalo vencer). */
  recurrence_interval: string | null
  completed_at: string | null
}

export interface MeetingRecord {
  id: string
  title: string
  date: string | null
  meeting_link: string | null
  status: string
  cancellation_reason: string | null
  cancelled_by_role: string | null
  is_emergency: boolean
  created_at: string
}

export interface SmartGoalRecord {
  id: string
  title: string
  metric_type: string | null
  target_value: number | null
  current_value: number | null
  period: string | null
  status: string
}

export interface AlertRecord {
  id: string
  title: string
  message: string | null
  severity: string
  category: string | null
  resolved: boolean
  created_at: string
}

export interface CommentRecord {
  id: string
  title: string | null
  content: string
  author_id: string | null
  author_name: string | null
  author_role: string | null
  created_at: string
  audio_url: string | null
  audio_duration_seconds: number | null
}

export interface FileItemRecord {
  id: string
  name: string
  folder: string | null
  file_url: string | null
  file_type: string | null
  status: string
  created_at: string
}

export interface ApprovalRecord {
  id: string
  title: string
  file_url: string | null
  file_type: string | null
  status: string
  feedback: string | null
  created_at: string
  auto_approved: boolean
}

export interface PerformanceSnapshotRecord {
  id: string
  project_id: string
  snapshot_date: string
  spend: number | null
  revenue: number | null
  roas: number | null
  ctr: number | null
  channel: string | null
  clicks: number | null
  impressions: number | null
  conversions: number | null
}

export function useClient() {
  const { clientId } = useAuth()
  return useQuery({
    queryKey: ['client', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select(CLIENT_SAFE_COLUMNS)
        .eq('id', clientId as string)
        .single()
      if (error) throw error
      return data as ClientRecord
    },
    enabled: !!clientId,
  })
}

export function useProjects() {
  const { clientId } = useAuth()
  return useQuery({
    queryKey: ['projects', clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*').eq('client_id', clientId as string)
      if (error) throw error
      return data as ProjectRecord[]
    },
    enabled: !!clientId,
  })
}

/** Tarefas do Portal Cliente (Fase 30) — tabela própria (`client_tasks`),
 * separada de `public.tasks` (Kanban interno da agência, ver
 * `useManagerPortalData.ts`). As duas nunca compartilham linha: o que o
 * gestor cria/aplica pro Kanban não aparece aqui, e vice-versa. */
export function useTasks() {
  const { clientId } = useAuth()
  return useQuery({
    queryKey: ['tasks', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_tasks')
        .select('*')
        .eq('client_id', clientId as string)
        .order('due_date', { ascending: true, nullsFirst: false })
      if (error) throw error
      return data as TaskRecord[]
    },
    enabled: !!clientId,
  })
}

export function useUpcomingMeetings() {
  const { clientId } = useAuth()
  return useQuery({
    queryKey: ['meetings', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('client_id', clientId as string)
        .order('date', { ascending: true })
      if (error) throw error
      return data as MeetingRecord[]
    },
    enabled: !!clientId,
  })
}

export function useSmartGoals() {
  const { clientId } = useAuth()
  return useQuery({
    queryKey: ['smart-goals', clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from('smart_goals').select('*').eq('client_id', clientId as string)
      if (error) throw error
      return data as SmartGoalRecord[]
    },
    enabled: !!clientId,
  })
}

export function useAlerts() {
  const { clientId } = useAuth()
  return useQuery({
    queryKey: ['alerts', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .eq('client_id', clientId as string)
        .eq('resolved', false)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as AlertRecord[]
    },
    enabled: !!clientId,
  })
}

export interface ProjectProblem {
  project_id: string
  last_known_status: 'PAUSED' | 'REMOVED'
}

/** Fase 40.1 — "Projeto com problemas" no Portal do Cliente: quais dos
 * projetos deste cliente têm campanha vinculada Pausada/Removida no
 * Google/Meta Ads. De propósito SEM prazo de expiração (diferente da
 * versão do gestor, `useProblemCampaignLinks`) — só some daqui quando o
 * gestor apaga o aviso (`problem_dismissed_at`) ou a campanha volta a
 * ficar ativa (`check_campaign_state_changes()` zera os dois sozinho).
 * RLS própria (`cliente_le_proprios_project_campaign_links`,
 * migration-080) já restringe ao próprio cliente. */
export function useProjectProblems() {
  const { clientId } = useAuth()
  return useQuery({
    queryKey: ['project-problems', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_campaign_links')
        .select('project_id, last_known_status')
        .in('last_known_status', ['PAUSED', 'REMOVED'])
        .is('problem_dismissed_at', null)
      if (error) throw error
      return data as ProjectProblem[]
    },
    enabled: !!clientId,
  })
}


export function usePerformanceSnapshots() {
  const { clientId } = useAuth()
  return useQuery({
    queryKey: ['performance-snapshots', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('performance_snapshots')
        .select('*')
        .eq('client_id', clientId as string)
        .order('snapshot_date', { ascending: true })
      if (error) throw error
      return data as PerformanceSnapshotRecord[]
    },
    enabled: !!clientId,
  })
}

// Fase 21.3: histórico mensal fechado (client_monthly_reports),
// gerado automaticamente todo dia 1 pelo mês anterior — usado na aba
// "Histórico Mensal" de Relatórios pra baixar o PDF de um mês
// específico, sem depender do dado diário bruto continuar existindo.
export interface MonthlyReportRecord {
  id: string
  client_id: string
  ref_month: string
  spend: number | null
  revenue: number | null
  roas: number | null
  cpa: number | null
  ctr: number | null
  clicks: number | null
  impressions: number | null
  conversions: number | null
  health_score: number | null
  generated_at: string
}

export function useMonthlyReport(year: number, month: number) {
  const { clientId } = useAuth()
  const refMonth = `${year}-${String(month).padStart(2, '0')}-01`
  return useQuery({
    queryKey: ['monthly-report', clientId, refMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_monthly_reports')
        .select('*')
        .eq('client_id', clientId as string)
        .eq('ref_month', refMonth)
        .maybeSingle()
      if (error) throw error
      return data as MonthlyReportRecord | null
    },
    enabled: !!clientId,
  })
}

export interface NewTaskInput {
  title: string
  description: string | null
  category: string | null
  due_date: string | null
  priority: string
}

export function useCreateTask() {
  const { clientId } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewTaskInput) => {
      const { error } = await supabase.from('client_tasks').insert({ ...input, client_id: clientId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', clientId] })
    },
    onError: () => {
      toast.error('Não foi possível criar a tarefa.')
    },
  })
}

export function useSetTaskStatus() {
  const { clientId } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      const { error } = await supabase.rpc('set_client_task_status', { task_id: taskId, new_status: status })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', clientId] })
    },
    onError: () => {
      toast.error('Não foi possível atualizar o status da tarefa.')
    },
  })
}

export function useDeleteTask() {
  const { clientId } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from('client_tasks').delete().eq('id', taskId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', clientId] })
    },
    onError: () => {
      toast.error('Não foi possível excluir a tarefa.')
    },
  })
}

// Leads (Fase 35, Parte 2 — Fechamento do Loop de Venda): cada resposta
// de Formulário já sincronizada (Fase 8.2) ganha um status manual
// (Novo/Qualificado/Venda/Perdido), marcado por aqui OU pelo gestor
// (Portal Gestor → Ativos Digitais → Integrações → Ver respostas) —
// mesma linha, os dois lados enxergam o mesmo status.
export type LeadStatus = 'novo' | 'qualificado' | 'venda' | 'perdido'

export interface LeadAnswerRecord {
  external_question_id: string
  answer_text: string | null
}

export interface LeadResponseRecord {
  id: string
  connection_id: string
  submitted_at: string | null
  status: LeadStatus
  form_answers: LeadAnswerRecord[]
}

export function useLeads() {
  const { clientId } = useAuth()
  return useQuery({
    queryKey: ['leads', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('form_responses')
        .select('id, connection_id, submitted_at, status, form_answers(external_question_id, answer_text)')
        .eq('client_id', clientId as string)
        .order('submitted_at', { ascending: false })
      if (error) throw error
      return data as unknown as LeadResponseRecord[]
    },
    enabled: !!clientId,
  })
}

export interface LeadQuestionRecord {
  connection_id: string
  external_question_id: string
  title: string
}

/** Título de cada pergunta, pra rotular as respostas de `useLeads` —
 * `form_questions` não tem client_id direto (é por conexão), por isso
 * busca separada filtrada pelas conexões que aparecem nos leads. */
export function useLeadQuestions(connectionIds: string[]) {
  return useQuery({
    queryKey: ['lead-questions', connectionIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('form_questions')
        .select('connection_id, external_question_id, title')
        .in('connection_id', connectionIds)
      if (error) throw error
      return data as LeadQuestionRecord[]
    },
    enabled: connectionIds.length > 0,
  })
}

export function useSetLeadStatus() {
  const { clientId } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ responseId, status }: { responseId: string; status: LeadStatus }) => {
      const { error } = await supabase.rpc('set_form_response_status', { p_response_id: responseId, p_status: status })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads', clientId] })
    },
    onError: () => {
      toast.error('Não foi possível atualizar o status do lead.')
    },
  })
}

const COMMENTS_ENTITY_TYPE = 'general'

export function useComments() {
  const { clientId } = useAuth()
  return useQuery({
    queryKey: ['comments', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('client_id', clientId as string)
        .eq('entity_type', COMMENTS_ENTITY_TYPE)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as CommentRecord[]
    },
    enabled: !!clientId,
  })
}

export function useCreateComment() {
  const { clientId, user, fullName, role } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      title,
      content,
      audioUrl,
      audioDurationSeconds,
    }: {
      title: string | null
      content: string
      audioUrl?: string
      audioDurationSeconds?: number
    }) => {
      const { error } = await supabase.from('comments').insert({
        title,
        content,
        client_id: clientId,
        entity_type: COMMENTS_ENTITY_TYPE,
        entity_id: clientId,
        author_id: user?.id,
        author_name: fullName,
        author_role: role,
        audio_url: audioUrl ?? null,
        audio_duration_seconds: audioDurationSeconds ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', clientId] })
    },
    onError: () => {
      toast.error('Não foi possível enviar o comentário.')
    },
  })
}

/** Pedido de reunião de emergência (Fase 6.5.1) — toda a validação
 * (plano Dominação, 1x/mês, fora dos horários bloqueados) mora na
 * função `request_emergency_meeting` do banco, não aqui. */
export function useRequestEmergencyMeeting() {
  const { clientId } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ date, meetingLink }: { date: string; meetingLink: string | null }) => {
      const { error } = await supabase.rpc('request_emergency_meeting', {
        p_date: date,
        p_meeting_link: meetingLink,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings', clientId] })
    },
    onError: (err) => {
      // O RPC lança mensagens específicas e seguras de mostrar (regra de
      // negócio: plano, limite mensal, horário indisponível) — mantém
      // elas em vez de trocar por uma mensagem genérica.
      toast.error(err instanceof Error ? err.message : 'Não foi possível solicitar a reunião de emergência.')
    },
  })
}

export function useCancelMeeting() {
  const { clientId } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ meetingId, reason }: { meetingId: string; reason: string }) => {
      const { error } = await supabase.rpc('cancel_meeting', { meeting_id: meetingId, reason })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings', clientId] })
    },
    onError: () => {
      toast.error('Não foi possível cancelar a reunião.')
    },
  })
}

export function useDeleteMeeting() {
  const { clientId } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (meetingId: string) => {
      const { error } = await supabase.from('meetings').delete().eq('id', meetingId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings', clientId] })
    },
    onError: () => {
      toast.error('Não foi possível excluir a reunião.')
    },
  })
}

export function useFileItems() {
  const { clientId } = useAuth()
  return useQuery({
    queryKey: ['file-items', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('file_items')
        .select('*')
        .eq('client_id', clientId as string)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as FileItemRecord[]
    },
    enabled: !!clientId,
  })
}

export interface NewFileItemInput {
  name: string
  folder: string | null
  file_url: string
  file_type: string | null
}

export function useCreateFileItem() {
  const { clientId } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewFileItemInput) => {
      const { error } = await supabase.from('file_items').insert({ ...input, client_id: clientId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['file-items', clientId] })
    },
    onError: () => {
      toast.error('Não foi possível enviar o arquivo.')
    },
  })
}

export function useDeleteFile() {
  const { clientId } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (fileId: string) => {
      const { error } = await supabase.from('file_items').delete().eq('id', fileId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['file-items', clientId] })
    },
    onError: () => {
      toast.error('Não foi possível excluir o arquivo.')
    },
  })
}

export function useApprovals() {
  const { clientId } = useAuth()
  return useQuery({
    queryKey: ['approvals', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('approvals')
        .select('*')
        .eq('client_id', clientId as string)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as ApprovalRecord[]
    },
    enabled: !!clientId,
  })
}

export function useRespondToApproval() {
  const { clientId } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      approvalId,
      status,
      feedback,
    }: {
      approvalId: string
      status: 'approved' | 'rejected' | 'revision_requested'
      feedback: string | null
    }) => {
      const { error } = await supabase.rpc('respond_to_approval', {
        approval_id: approvalId,
        new_status: status,
        feedback_text: feedback,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals', clientId] })
      // Aprovar cria a entrada em "file_items" na hora (ver função
      // "respond_to_approval" no banco) — invalida também Arquivos pra
      // ela aparecer lá sem precisar recarregar a página.
      queryClient.invalidateQueries({ queryKey: ['file-items', clientId] })
    },
    onError: () => {
      toast.error('Não foi possível responder à aprovação.')
    },
  })
}

/** Última atividade por aba (chave = href do menu), usada pra acender a
 * bolinha de notificação — comparada com "nav_last_seen" em useNavSeen.ts. */
export function useNavActivity(enabled = true) {
  const { clientId } = useAuth()
  return useQuery({
    queryKey: ['client-nav-activity', clientId],
    queryFn: async () => {
      const [comments, tasks, fileItems, approvals, meetings] = await Promise.all([
        fetchLatestUpdatedAt('comments', clientId as string),
        fetchLatestUpdatedAt('tasks', clientId as string),
        fetchLatestUpdatedAt('file_items', clientId as string),
        fetchLatestUpdatedAt('approvals', clientId as string),
        fetchLatestUpdatedAt('meetings', clientId as string),
      ])
      return {
        '/comments': comments,
        '/tasks': tasks,
        '/files': latestOf(fileItems, approvals),
        '/meetings': meetings,
      } as Record<string, string | null>
    },
    enabled: enabled && !!clientId,
    refetchInterval: 60000,
  })
}

export function useUpdateProfile() {
  const { refreshProfile } = useAuth()
  return useMutation({
    mutationFn: async ({
      fullName,
      phone,
      avatarUrl,
    }: {
      fullName: string
      phone: string | null
      avatarUrl?: string
    }) => {
      const { error } = await supabase.rpc('update_own_profile', {
        new_full_name: fullName,
        new_phone: phone,
        new_avatar_url: avatarUrl ?? null,
      })
      if (error) throw error
    },
    onSuccess: async () => {
      await refreshProfile()
    },
    onError: () => {
      toast.error('Não foi possível atualizar o perfil.')
    },
  })
}

export interface OrganizationRecord {
  id: string
  name: string
  plan: string | null
  status: string | null
  domain: string | null
}

export function useOrganization() {
  return useQuery({
    queryKey: ['organization'],
    queryFn: async () => {
      const { data, error } = await supabase.from('organizations').select('*').limit(1).maybeSingle()
      if (error) throw error
      return data as OrganizationRecord | null
    },
  })
}

export interface UpdateOrganizationInput {
  id: string
  name: string
  plan: string | null
  status: string | null
  domain: string | null
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateOrganizationInput) => {
      const { error } = await supabase.from('organizations').update(input).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization'] })
    },
    onError: () => {
      toast.error('Não foi possível atualizar a organização.')
    },
  })
}

export interface FeatureFlagRecord {
  id: string
  key: string
  label: string | null
  enabled: boolean
  scope: string
}

export function useFeatureFlags() {
  return useQuery({
    queryKey: ['feature-flags'],
    queryFn: async () => {
      const { data, error } = await supabase.from('feature_flags').select('*').order('key', { ascending: true })
      if (error) throw error
      return data as FeatureFlagRecord[]
    },
  })
}

export function useTriggerEmergencyPause() {
  const { clientId } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ reason, projectIds }: { reason: string; projectIds: string[] }) => {
      const { error } = await supabase.rpc('trigger_emergency_pause', {
        p_reason: reason,
        p_project_ids: projectIds,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', clientId] })
    },
    onError: () => {
      toast.error('Não foi possível acionar a pausa de emergência.')
    },
  })
}
