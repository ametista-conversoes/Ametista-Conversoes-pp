import { useEffect, useRef } from 'react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { aggregateAudienceInsights, type AudienceRawResponse } from '@/lib/audience-insights'
import { fetchLinkedClientAccounts, linkClientAccount, resendClientInvite, unlinkClientAccount } from '@/lib/client-access'
import type { PerformanceSnapshotRecord } from '@/hooks/useClientPortalData'
import { disconnectIntegration, listAdGroups, listCampaignInsights, type ExternalAdGroup } from '@/lib/integrations'
import type { ClientHealthScoreSnapshotRecord, ExecutiveKpiSnapshotRecord } from '@/lib/manager-metrics'
import { computeRateMetrics } from '@/lib/metrics'
import { fetchLatestUpdatedAt, latestOf } from '@/lib/nav-activity'
import type { RecurrenceInterval } from '@/lib/recurrence'
import { severityRank } from '@/lib/status-styles'
import { supabase } from '@/lib/supabase'

export interface ManagerClientRecord {
  id: string
  name: string
  company: string | null
  email: string | null
  status: string
  plan: string | null
  monthly_fee: number | null
  health_score: number | null
  phone: string | null
  logo_url: string | null
  renewal_date: string | null
  internal_notes: string | null
  default_workflow_template_id: string | null
  leads_to_close: number | null
  average_ticket: number | null
  /** Fase 31 — só relevante quando `plan === 'validacao'`. */
  chosen_platform: 'meta' | 'google' | null
}

export interface ManagerIncidentRecord {
  id: string
  title: string
  client_id: string
  severity: string
  status: string
  category: string | null
  description: string | null
  resolution: string | null
  created_at: string
  client: { name: string } | null
}

export interface ManagerAlertRecord {
  id: string
  title: string
  message: string | null
  client_id: string
  severity: string
  category: string | null
  resolved: boolean
  created_at: string
  client: { name: string } | null
}

export interface TimelineEventRecord {
  id: string
  action: string
  entity_type: string | null
  entity_id: string | null
  client_id: string | null
  severity: string
  created_at: string
  client: { name: string } | null
}

export interface ManagerProjectRecord {
  id: string
  title: string
  client_id: string
  status: string
  spend: number | null
  objective: string | null
  description: string | null
  icp: string | null
  segmentations: string[]
  systems: string | null
  channel: string | null
  cpa: number | null
  roas: number | null
  ctr: number | null
  revenue: number | null
  health_score: number | null
  start_date: string | null
  end_date: string | null
  external_connection_id: string | null
  external_campaign_id: string | null
  external_campaign_name: string | null
  conversion_type: 'vendas' | 'leads'
  /** Fase 33 — Teste A/B de Campanhas: 'nenhum' é o padrão (projeto
   * normal, sem aba "Testes"). */
  test_type: 'nenhum' | 'segmentacao' | 'anuncio' | 'campanha'
  test_min_spend: number | null
  /** Fase 34d — plataforma de anúncios do projeto (escolhida na
   * criação, editável na aba Campanha) — null só em projeto criado
   * antes dessa fase. */
  platform: 'google_ads' | 'meta_ads' | null
  /** Palavras-chave documentadas manualmente pro gestor — só mostrado
   * na aba Campanha quando a campanha vinculada é do tipo Pesquisa
   * (Search), igual ao Público-alvo (`icp`) só que específico de Search. */
  keywords: string | null
}

export interface ManagerTaskRecord {
  id: string
  title: string
  description: string | null
  client_id: string
  project_id: string | null
  status: string
  priority: string
  category: string | null
  due_date: string | null
  archived_at: string | null
  client: { name: string } | null
}

export function useAllClients() {
  return useQuery({
    queryKey: ['manager-clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').order('name', { ascending: true })
      if (error) throw error
      return data as ManagerClientRecord[]
    },
  })
}

export function useManagerClient(clientId: string | null) {
  return useQuery({
    queryKey: ['manager-client', clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').eq('id', clientId as string).single()
      if (error) throw error
      return data as ManagerClientRecord
    },
    enabled: !!clientId,
  })
}

export interface UpdateClientDetailsInput {
  id: string
  name: string
  company: string | null
  email: string | null
  plan: string | null
  monthly_fee: number | null
  phone: string | null
  logo_url: string | null
  renewal_date: string | null
  internal_notes: string | null
  leads_to_close: number | null
  average_ticket: number | null
}

export function useUpdateClientDetails() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateClientDetailsInput) => {
      const { error } = await supabase.from('clients').update(input).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['manager-clients'] })
      queryClient.invalidateQueries({ queryKey: ['manager-client', id] })
    },
    onError: () => {
      toast.error('Não foi possível atualizar os dados do cliente.')
    },
  })
}

/** Contas de login (profiles com role='cliente') vinculadas a um
 * cliente — Fase 26. Não dá pra buscar isso com um select comum: a
 * RLS de "profiles" só deixa cada um ler a própria linha, então isso
 * passa pela Edge Function "client-access" (roda com service role). */
export function useLinkedClientAccounts(clientId: string) {
  return useQuery({
    queryKey: ['client-linked-accounts', clientId],
    queryFn: () => fetchLinkedClientAccounts(clientId),
    enabled: !!clientId,
  })
}

export function useLinkClientAccount(clientId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (email: string) => linkClientAccount(clientId, email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-linked-accounts', clientId] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Não foi possível vincular a conta.')
    },
  })
}

export function useResendClientInvite(clientId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (profileId: string) => resendClientInvite(profileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-linked-accounts', clientId] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Não foi possível reenviar o convite.')
    },
  })
}

export function useUnlinkClientAccount(clientId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (profileId: string) => unlinkClientAccount(profileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-linked-accounts', clientId] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Não foi possível remover o acesso.')
    },
  })
}

export function useUpdateClientStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ clientId, status }: { clientId: string; status: string }) => {
      const { error } = await supabase.from('clients').update({ status }).eq('id', clientId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-clients'] })
    },
    onError: () => {
      toast.error('Não foi possível atualizar o status do cliente.')
    },
  })
}

export function useRecomputeClientHealthScore() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase.rpc('recompute_client_health_score', { p_client_id: clientId })
      if (error) throw error
    },
    onSuccess: (_data, clientId) => {
      queryClient.invalidateQueries({ queryKey: ['manager-client', clientId] })
      queryClient.invalidateQueries({ queryKey: ['manager-clients'] })
    },
    onError: () => {
      toast.error('Não foi possível recalcular o Health Score do cliente.')
    },
  })
}

export function useDeleteClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase.from('clients').delete().eq('id', clientId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-clients'] })
    },
    onError: () => {
      toast.error('Não foi possível excluir o cliente.')
    },
  })
}

export function useAllIncidents() {
  return useQuery({
    queryKey: ['manager-incidents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('incidents')
        .select('*, client:clients(name)')
        .order('created_at', { ascending: false })
      if (error) throw error
      // Mais severo primeiro; sort é estável, então quem tem a mesma
      // severidade mantém a ordem por data mais recente já vinda do banco.
      return (data as unknown as ManagerIncidentRecord[]).sort(
        (a, b) => severityRank[b.severity] - severityRank[a.severity],
      )
    },
  })
}

export interface NewIncidentInput {
  title: string
  client_id: string
  severity: string
  category: string | null
  description: string | null
}

export function useCreateIncident() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewIncidentInput) => {
      const { error } = await supabase.from('incidents').insert({ ...input, status: 'open' })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-incidents'] })
      queryClient.invalidateQueries({ queryKey: ['manager-timeline'] })
    },
    onError: () => {
      toast.error('Não foi possível criar o incidente.')
    },
  })
}

export function useResolveIncident() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ incidentId, resolution }: { incidentId: string; resolution: string }) => {
      const { error } = await supabase
        .from('incidents')
        .update({ status: 'resolved', resolution })
        .eq('id', incidentId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-incidents'] })
      queryClient.invalidateQueries({ queryKey: ['manager-timeline'] })
    },
    onError: () => {
      toast.error('Não foi possível resolver o incidente.')
    },
  })
}

export function useDeleteIncident() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (incidentId: string) => {
      const { error } = await supabase.from('incidents').delete().eq('id', incidentId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-incidents'] })
    },
    onError: () => {
      toast.error('Não foi possível excluir o incidente.')
    },
  })
}

export function useAllAlerts() {
  return useQuery({
    queryKey: ['manager-alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alerts')
        .select('*, client:clients(name)')
        .order('created_at', { ascending: false })
      if (error) throw error
      // Mais severo primeiro (mesmo critério de useAllIncidents).
      return (data as unknown as ManagerAlertRecord[]).sort(
        (a, b) => severityRank[b.severity] - severityRank[a.severity],
      )
    },
  })
}

export function useResolveAlert() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase.from('alerts').update({ resolved: true }).eq('id', alertId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-alerts'] })
      queryClient.invalidateQueries({ queryKey: ['manager-timeline'] })
    },
    onError: () => {
      toast.error('Não foi possível resolver o alerta.')
    },
  })
}

export function useDeleteAlert() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase.from('alerts').delete().eq('id', alertId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-alerts'] })
    },
    onError: () => {
      toast.error('Não foi possível excluir o alerta.')
    },
  })
}

// Fase 21.1: monitoramento de erros (tipo Sentry, próprio) — captura
// tanto erro de front-end (ErrorBoundary/window.onerror, ver
// src/lib/error-logging.ts) quanto de Edge Function (logServerError
// nos 3 arquivos em supabase/functions/*/index.ts).
export interface ErrorLogRecord {
  id: string
  source: 'frontend' | 'edge_function'
  function_name: string | null
  message: string
  stack: string | null
  context: unknown
  severity: string
  resolved: boolean
  created_at: string
}

export function useErrorLogs() {
  return useQuery({
    queryKey: ['error-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('error_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return data as ErrorLogRecord[]
    },
  })
}

export function useResolveErrorLog() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('error_logs').update({ resolved: true }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['error-logs'] })
    },
    onError: () => {
      toast.error('Não foi possível marcar o erro como resolvido.')
    },
  })
}

// Fase 21.2: alerta automático por limiar de métrica, configurado por
// cliente na Central de Informações — a checagem de verdade roda no
// banco (check_metric_alert_thresholds, chamada a cada sync).
export interface MetricAlertThresholdRecord {
  id: string
  client_id: string
  metric: string
  comparison: 'above' | 'below'
  threshold_value: number
  enabled: boolean
}

export function useMetricAlertThresholds(clientId: string | null) {
  return useQuery({
    queryKey: ['metric-alert-thresholds', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('metric_alert_thresholds')
        .select('*')
        .eq('client_id', clientId as string)
      if (error) throw error
      return data as MetricAlertThresholdRecord[]
    },
    enabled: !!clientId,
  })
}

export function useUpsertMetricAlertThreshold() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      client_id: string
      metric: string
      comparison: 'above' | 'below'
      threshold_value: number
      enabled: boolean
    }) => {
      const { error } = await supabase.from('metric_alert_thresholds').upsert(input, { onConflict: 'client_id,metric' })
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['metric-alert-thresholds', variables.client_id] })
    },
    onError: () => {
      toast.error('Não foi possível salvar o limiar de alerta.')
    },
  })
}

export function useDeleteErrorLog() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('error_logs').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['error-logs'] })
    },
    onError: () => {
      toast.error('Não foi possível excluir o log de erro.')
    },
  })
}

export function useTimelineEvents() {
  return useQuery({
    queryKey: ['manager-timeline'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*, client:clients(name)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as unknown as TimelineEventRecord[]
    },
  })
}

export function useAllProjects() {
  return useQuery({
    queryKey: ['manager-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(
          'id, title, client_id, status, spend, objective, description, icp, segmentations, systems, channel, cpa, roas, ctr, revenue, health_score, start_date, end_date, external_connection_id, external_campaign_id, external_campaign_name, conversion_type, test_type, test_min_spend, platform, keywords',
        )
      if (error) throw error
      return data as ManagerProjectRecord[]
    },
  })
}

export interface NewProjectInput {
  title: string
  client_id: string
  objective: string | null
  description: string | null
  conversion_type: 'vendas' | 'leads'
  test_type: 'nenhum' | 'segmentacao' | 'anuncio' | 'campanha'
  platform: 'google_ads' | 'meta_ads'
}

/** Devolve o projeto criado (id) porque `NewProjectDialog` precisa dele
 * pra, opcionalmente, vincular a 1ª campanha logo em seguida (Fase 32 —
 * `project_campaign_links`, ver `useAddProjectCampaignLink`). */
export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewProjectInput) => {
      const { data, error } = await supabase.from('projects').insert(input).select('id').single()
      if (error) throw error
      return data as { id: string }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-projects'] })
    },
    onError: () => {
      toast.error('Não foi possível criar o projeto.')
    },
  })
}

export interface UpdateProjectCampaignInput {
  id: string
  icp?: string | null
  segmentations?: string[]
  objective?: string | null
  systems?: string | null
  description?: string | null
  revenue?: number | null
  conversion_type?: 'vendas' | 'leads'
  status?: string
  test_type?: 'nenhum' | 'segmentacao' | 'anuncio' | 'campanha'
  test_min_spend?: number | null
  platform?: 'google_ads' | 'meta_ads' | null
  keywords?: string | null
}

export function useUpdateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateProjectCampaignInput) => {
      const { error } = await supabase.from('projects').update(input).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-projects'] })
    },
    onError: () => {
      toast.error('Não foi possível atualizar o projeto.')
    },
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projects').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-projects'] })
      toast.success('Projeto apagado.')
    },
    onError: () => {
      toast.error('Não foi possível apagar o projeto.')
    },
  })
}

export interface ProjectCampaignLink {
  id: string
  project_id: string
  connection_id: string
  external_campaign_id: string
  external_campaign_name: string | null
  created_at: string
}

/** Campanhas vinculadas a UM projeto (Fase 32 — um projeto pode ter
 * mais de uma campanha, ex: Search + Performance Max juntas). Substitui
 * o link único antigo (projects.external_connection_id/campaign_id) —
 * essas 3 colunas continuam existindo na tabela por compatibilidade,
 * mas não são mais lidas em lugar nenhum do app. */
export function useProjectCampaignLinks(projectId: string | null) {
  return useQuery({
    queryKey: ['project-campaign-links', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_campaign_links')
        .select('id, project_id, connection_id, external_campaign_id, external_campaign_name, created_at')
        .eq('project_id', projectId as string)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as ProjectCampaignLink[]
    },
    enabled: !!projectId,
  })
}

export interface AddProjectCampaignLinkInput {
  project_id: string
  connection_id: string
  external_campaign_id: string
  external_campaign_name: string | null
}

export function useAddProjectCampaignLink() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: AddProjectCampaignLinkInput) => {
      const { error } = await supabase.from('project_campaign_links').insert(input)
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['project-campaign-links', variables.project_id] })
    },
    onError: () => {
      toast.error('Não foi possível vincular a campanha.')
    },
  })
}

export function useRemoveProjectCampaignLink() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; project_id: string }) => {
      const { error } = await supabase.from('project_campaign_links').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['project-campaign-links', variables.project_id] })
    },
    onError: () => {
      toast.error('Não foi possível remover o vínculo.')
    },
  })
}

export interface CampaignAdChangeLogEntry {
  id: string
  campaign_link_id: string
  changed_at: string
  description: string
}

/** Fase 33 — Teste A/B de Campanhas, modo "anúncio": registro manual de
 * quando o criativo/anúncio de uma campanha vinculada foi trocado
 * (data + descrição livre). O app não sincroniza nem verifica o
 * conteúdo do anúncio via API — é só um histórico/contexto que o
 * gestor mesmo mantém. */
export function useCampaignAdChangeLog(campaignLinkId: string | null) {
  return useQuery({
    queryKey: ['campaign-ad-change-log', campaignLinkId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaign_ad_change_log')
        .select('id, campaign_link_id, changed_at, description')
        .eq('campaign_link_id', campaignLinkId as string)
        .order('changed_at', { ascending: false })
      if (error) throw error
      return data as CampaignAdChangeLogEntry[]
    },
    enabled: !!campaignLinkId,
  })
}

export interface AddCampaignAdChangeLogEntryInput {
  campaign_link_id: string
  changed_at: string
  description: string
}

export function useAddCampaignAdChangeLogEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: AddCampaignAdChangeLogEntryInput) => {
      const { error } = await supabase.from('campaign_ad_change_log').insert(input)
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-ad-change-log', variables.campaign_link_id] })
    },
    onError: () => {
      toast.error('Não foi possível registrar a troca de anúncio.')
    },
  })
}

export function useRemoveCampaignAdChangeLogEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; campaign_link_id: string }) => {
      const { error } = await supabase.from('campaign_ad_change_log').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-ad-change-log', variables.campaign_link_id] })
    },
    onError: () => {
      toast.error('Não foi possível apagar o registro.')
    },
  })
}

export interface CampaignPerformance {
  spend: number
  clicks: number
  impressions: number
  conversions: number
  cpa: number | null
  ctr: number | null
  cpc: number | null
  conversionRate: number | null
  /** Média dos últimos 30 dias com dado, de todas as campanhas
   * vinculadas juntas (ignora dias/campanhas sem dado) — só existe de
   * verdade em campanhas de Pesquisa do Google Ads. */
  searchRankLostImpressionShare: number | null
  searchBudgetLostImpressionShare: number | null
  /** Soma do orçamento mais recente de CADA campanha vinculada — null
   * só se nenhuma tiver orçamento conhecido. */
  budgetAmount: number | null
  /** Tipos distintos entre as campanhas vinculadas (Search/Display/
   * Vídeo/Performance Max/... no Google, objetivo no Meta) — um projeto
   * pode ter mais de uma campanha de tipos diferentes (Fase 32). */
  campaignTypes: string[]
  /** Valor de conversão que a própria plataforma reporta (Google/Meta),
   * somado de todas as campanhas vinculadas — NÃO é a Receita do app
   * (calculada a partir de Leads), é a aproximação de ROAS que o
   * provedor já calcula sozinho. */
  conversionValue: number
}

export interface CampaignLinkRef {
  connectionId: string
  campaignId: string
}

type CampaignSnapshotRow = {
  spend: number | null
  clicks: number | null
  impressions: number | null
  conversions: number | null
  snapshot_date: string
  search_rank_lost_impression_share: number | null
  search_budget_lost_impression_share: number | null
  budget_amount: number | null
  campaign_type: string | null
  conversion_value: number | null
}

const CAMPAIGN_SNAPSHOT_SELECT =
  'spend, clicks, impressions, conversions, snapshot_date, search_rank_lost_impression_share, search_budget_lost_impression_share, budget_amount, campaign_type, conversion_value'

/** Busca+resume `campaign_performance_snapshots` dos últimos 30 dias de
 * uma LISTA de campanhas (`connection_id`+`external_campaign_id`),
 * somando spend/clicks/impressions/conversions/valor de conversão de
 * todas juntas — extraído pra função à parte (Fase 33) porque tanto
 * `useCampaignPerformance` (agregado do projeto inteiro) quanto
 * `useCampaignVariantPerformances` (Teste A/B, 1 chamada por variante)
 * precisam do mesmo cálculo, só que com listas de tamanhos diferentes
 * (várias campanhas vs. 1 só por vez). Sem ROAS/receita — os
 * provedores de anúncio não reportam isso nessa sincronização (mesma
 * limitação que já existe hoje pro agregado por conta em
 * `performance_snapshots`). */
async function fetchCampaignPerformance(links: CampaignLinkRef[]): Promise<CampaignPerformance> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const perCampaignRows = await Promise.all(
    links.map(async (link) => {
      const { data, error } = await supabase
        .from('campaign_performance_snapshots')
        .select(CAMPAIGN_SNAPSHOT_SELECT)
        .eq('connection_id', link.connectionId)
        .eq('external_campaign_id', link.campaignId)
        .gte('snapshot_date', since)
        .order('snapshot_date', { ascending: true })
      if (error) throw error
      return data as CampaignSnapshotRow[]
    }),
  )

  const rows = perCampaignRows.flat()
  const totals = rows.reduce(
    (acc, row) => ({
      spend: acc.spend + (row.spend ?? 0),
      clicks: acc.clicks + (row.clicks ?? 0),
      impressions: acc.impressions + (row.impressions ?? 0),
      conversions: acc.conversions + (row.conversions ?? 0),
      conversionValue: acc.conversionValue + (row.conversion_value ?? 0),
    }),
    { spend: 0, clicks: 0, impressions: 0, conversions: 0, conversionValue: 0 },
  )

  const average = (values: Array<number | null>) => {
    const known = values.filter((v): v is number => v != null)
    return known.length > 0 ? known.reduce((sum, v) => sum + v, 0) / known.length : null
  }

  const latestPerCampaign = perCampaignRows.map((campaignRows) => ({
    budget: [...campaignRows].reverse().find((r) => r.budget_amount != null)?.budget_amount ?? null,
    type: [...campaignRows].reverse().find((r) => r.campaign_type != null)?.campaign_type ?? null,
  }))
  const knownBudgets = latestPerCampaign.map((c) => c.budget).filter((b): b is number => b != null)
  const campaignTypes = Array.from(new Set(latestPerCampaign.map((c) => c.type).filter((t): t is string => t != null)))

  return {
    ...totals,
    ...computeRateMetrics(totals.spend, totals.clicks, totals.impressions, totals.conversions),
    searchRankLostImpressionShare: average(rows.map((r) => r.search_rank_lost_impression_share)),
    searchBudgetLostImpressionShare: average(rows.map((r) => r.search_budget_lost_impression_share)),
    budgetAmount: knownBudgets.length > 0 ? knownBudgets.reduce((sum, b) => sum + b, 0) : null,
    campaignTypes,
  } as CampaignPerformance
}

/** Últimos 30 dias de `campaign_performance_snapshots` somados de TODAS
 * as campanhas vinculadas ao projeto (Fase 32 — um projeto pode ter
 * mais de uma campanha, ex: Search + Performance Max juntas; antes era
 * só 1 par connectionId/campaignId). */
export function useCampaignPerformance(links: CampaignLinkRef[]) {
  const sortedKey = [...links].map((l) => `${l.connectionId}:${l.campaignId}`).sort()
  return useQuery({
    queryKey: ['campaign-performance', sortedKey],
    queryFn: () => fetchCampaignPerformance(links),
    enabled: links.length > 0,
  })
}

/** Fase 33 — Teste A/B de Campanhas: performance de CADA campanha
 * vinculada SEPARADA (não somada), uma consulta por variante via
 * `useQueries` (mesmo cálculo de `fetchCampaignPerformance`, só que
 * chamado com 1 campanha por vez em vez da lista inteira) — é como o
 * projeto compara CPA/CTR/Taxa de Conversão entre as variantes do
 * teste. */
export function useCampaignVariantPerformances(links: ProjectCampaignLink[]) {
  return useQueries({
    queries: links.map((link) => ({
      queryKey: ['campaign-performance', [`${link.connection_id}:${link.external_campaign_id}`]],
      queryFn: () => fetchCampaignPerformance([{ connectionId: link.connection_id, campaignId: link.external_campaign_id }]),
    })),
  })
}

export interface AdGroupPerformance extends ExternalAdGroup {
  cpa: number | null
  ctr: number | null
  cpc: number | null
  conversionRate: number | null
}

/** Grupos de anúncio da campanha vinculada a um projeto (aba "Grupos de
 * Anúncios") — busca ao vivo (sem histórico salvo), últimos 30 dias.
 * CTR/CPC/Taxa de Conversão calculados aqui a partir dos números brutos
 * que a Edge Function devolve (mesma fórmula de `computeRateMetrics`
 * usada pra conta/campanha, pra nunca destoar). */
export function useAdGroups(connectionId: string | null, campaignId: string | null) {
  return useQuery({
    queryKey: ['ad-groups', connectionId, campaignId],
    queryFn: async () => {
      const adGroups = await listAdGroups(connectionId as string, campaignId as string)
      return adGroups.map((a) => ({
        ...a,
        ...computeRateMetrics(a.spend, a.clicks, a.impressions, a.conversions),
      })) as AdGroupPerformance[]
    },
    enabled: !!connectionId && !!campaignId,
  })
}

/** Resumos curados (dispositivo, top termos de pesquisa, top
 * palavras-chave, geográfico) da campanha vinculada a um projeto —
 * busca ao vivo (sem histórico salvo), últimos 30 dias, mesmo padrão de
 * `useAdGroups`. CTR/CPC/Taxa de Conversão não fazem sentido aqui (os 3
 * blocos já vêm com clicks/impressions/conversions brutos — quem
 * renderiza decide se quer taxa ou número absoluto). */
export function useCampaignInsights(connectionId: string | null, campaignId: string | null) {
  return useQuery({
    queryKey: ['campaign-insights', connectionId, campaignId],
    queryFn: () => listCampaignInsights(connectionId as string, campaignId as string),
    enabled: !!connectionId && !!campaignId,
  })
}

// Fase 34 — Catálogo de Criativos e Segmentações: organização e
// classificação de anúncios (texto/vídeo) e segmentações, sempre por
// cliente específico. Vídeo não guarda o arquivo (navegador não abre
// arquivo local), só a referência de texto do caminho esperado — o
// campo "conteudo" serve pros dois casos, igual ao texto do anúncio.
export type CatalogType = 'criativo' | 'segmentacao'
/** Só em Criativos — headline/descrição/frase de destaque são os 3
 * componentes reais de um anúncio de texto (Google/Meta, cada um com
 * regra e tamanho diferentes); "video" não tem subtipo. */
export type CatalogEntryTipo = 'headline' | 'descricao' | 'frase_destaque' | 'video'
export type CatalogEntryOrigem = 'ia' | 'forms' | 'manual'
export type CatalogEntryStatus = 'rascunho' | 'em_teste' | 'aprovado_implementado' | 'descartado'
export type CatalogEntryPrioridade = 'alta' | 'media' | 'baixa'

export interface CatalogEntryRecord {
  id: string
  client_id: string
  catalog_type: CatalogType
  tipo: CatalogEntryTipo | null
  conteudo: string
  origem: CatalogEntryOrigem
  status: CatalogEntryStatus
  prioridade: CatalogEntryPrioridade
  derivado_de: string | null
  campaign_link_id: string | null
  /** 1 a 5, null = sem avaliação — só usado na UI pra Criativos, mas o
   * campo é genérico. */
  rating: number | null
  created_at: string
}

const CATALOG_ENTRY_SELECT =
  'id, client_id, catalog_type, tipo, conteudo, origem, status, prioridade, derivado_de, campaign_link_id, rating, created_at'

export function useCatalogEntries(clientId: string | null, catalogType: CatalogType) {
  return useQuery({
    queryKey: ['catalog-entries', clientId, catalogType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('catalog_entries')
        .select(CATALOG_ENTRY_SELECT)
        .eq('client_id', clientId as string)
        .eq('catalog_type', catalogType)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as CatalogEntryRecord[]
    },
    enabled: !!clientId,
  })
}

export interface CatalogEntryWithClient extends CatalogEntryRecord {
  client: { name: string } | null
}

/** Todas as entradas de um catálogo, de TODOS os clientes de uma vez —
 * usada pela página global "Catálogo" (Portal Gestor), que deixa ver,
 * avaliar, buscar e apagar criativos/segmentações de qualquer cliente
 * num só lugar. Busca tudo e filtra por cliente/texto no componente,
 * mesmo padrão de `useAllProjects`/`useAllClients`. */
export function useAllCatalogEntries(catalogType: CatalogType) {
  return useQuery({
    queryKey: ['all-catalog-entries', catalogType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('catalog_entries')
        .select(`${CATALOG_ENTRY_SELECT}, client:clients(name)`)
        .eq('catalog_type', catalogType)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as unknown as CatalogEntryWithClient[]
    },
  })
}

export interface NewCatalogEntryInput {
  client_id: string
  catalog_type: CatalogType
  tipo: CatalogEntryTipo | null
  conteudo: string
  origem: CatalogEntryOrigem
  prioridade: CatalogEntryPrioridade
  derivado_de: string | null
}

export function useCreateCatalogEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewCatalogEntryInput) => {
      const { error } = await supabase.from('catalog_entries').insert(input)
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['catalog-entries', variables.client_id, variables.catalog_type] })
      queryClient.invalidateQueries({ queryKey: ['all-catalog-entries', variables.catalog_type] })
    },
    onError: () => {
      toast.error('Não foi possível criar a entrada do catálogo.')
    },
  })
}

/** Criação em massa — "colar várias linhas" (Fase 34c): cada linha
 * colada numa textarea vira uma entrada separada, um único insert.
 * Todas as entradas do lote compartilham client_id/catalog_type (é
 * sempre assim que a UI monta o payload), então basta olhar a
 * primeira pra invalidar o cache certo. */
export function useCreateCatalogEntries() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (inputs: NewCatalogEntryInput[]) => {
      const { error } = await supabase.from('catalog_entries').insert(inputs)
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      const first = variables[0]
      if (!first) return
      queryClient.invalidateQueries({ queryKey: ['catalog-entries', first.client_id, first.catalog_type] })
      queryClient.invalidateQueries({ queryKey: ['all-catalog-entries', first.catalog_type] })
    },
    onError: () => {
      toast.error('Não foi possível criar as entradas do catálogo.')
    },
  })
}

export interface UpdateCatalogEntryInput {
  id: string
  client_id: string
  catalog_type: CatalogType
  status?: CatalogEntryStatus
  prioridade?: CatalogEntryPrioridade
  campaign_link_id?: string | null
  rating?: number | null
}

export function useUpdateCatalogEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, client_id, catalog_type, ...input }: UpdateCatalogEntryInput) => {
      const { error } = await supabase.from('catalog_entries').update(input).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['catalog-entries', variables.client_id, variables.catalog_type] })
      queryClient.invalidateQueries({ queryKey: ['all-catalog-entries', variables.catalog_type] })
    },
    onError: () => {
      toast.error('Não foi possível atualizar a entrada do catálogo.')
    },
  })
}

export function useDeleteCatalogEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; client_id: string; catalog_type: CatalogType }) => {
      const { error } = await supabase.from('catalog_entries').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['catalog-entries', variables.client_id, variables.catalog_type] })
      queryClient.invalidateQueries({ queryKey: ['all-catalog-entries', variables.catalog_type] })
    },
    onError: () => {
      toast.error('Não foi possível apagar a entrada do catálogo.')
    },
  })
}

export interface CampaignLinkWithProject {
  id: string
  project_id: string
  project_title: string
  project_test_type: 'nenhum' | 'segmentacao' | 'anuncio' | 'campanha'
  client_id: string
  connection_id: string
  external_campaign_id: string
  external_campaign_name: string | null
}

/** Todas as campanhas vinculadas de todos os projetos, já com o título/
 * tipo de teste/cliente do projeto embutido — usada pelo Catálogo pra
 * montar a lista "Vincular a Grupo de Teste" (só projetos com
 * `test_type !== 'nenhum'` têm de fato um Grupo de Teste, ver Fase 33)
 * sem precisar de uma rota nova: busca tudo e filtra no componente,
 * mesmo padrão de `useAllProjects`/`useAllClients`. */
export function useAllCampaignLinksWithProject() {
  return useQuery({
    queryKey: ['all-campaign-links-with-project'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_campaign_links')
        .select(
          'id, project_id, connection_id, external_campaign_id, external_campaign_name, project:projects(title, test_type, client_id)',
        )
      if (error) throw error
      return (
        data as unknown as Array<{
          id: string
          project_id: string
          connection_id: string
          external_campaign_id: string
          external_campaign_name: string | null
          project: { title: string; test_type: CampaignLinkWithProject['project_test_type']; client_id: string } | null
        }>
      ).map((row) => ({
        id: row.id,
        project_id: row.project_id,
        connection_id: row.connection_id,
        external_campaign_id: row.external_campaign_id,
        external_campaign_name: row.external_campaign_name,
        project_title: row.project?.title ?? '',
        project_test_type: row.project?.test_type ?? 'nenhum',
        client_id: row.project?.client_id ?? '',
      })) as CampaignLinkWithProject[]
    },
  })
}

export interface CampaignLinkTestResult {
  eligible: boolean
  hasEnoughVariants: boolean
  spend: number
  cpa: number | null
  ctr: number | null
  conversionRate: number | null
  beatsCpa: boolean | null
  beatsCtr: boolean | null
  beatsConversionRate: boolean | null
}

/** Resultado herdado do Grupo de Teste (Fase 33) pra UMA campanha
 * vinculada — mesmo cálculo de `CampaignTestsTab` (elegibilidade pelo
 * gasto mínimo do projeto, média do grupo, "bate a média"), só que
 * autocontido a partir só do `campaignLinkId` (o Catálogo não tem o
 * contexto de projeto/lista de variantes já carregado como a aba
 * Testes tem). Usado pra entrada do catálogo vinculada a um Grupo de
 * Teste mostrar o resultado sozinha, sem duplicar o número em lugar
 * nenhum. */
export function useCampaignLinkTestResult(campaignLinkId: string | null) {
  return useQuery({
    queryKey: ['campaign-link-test-result', campaignLinkId],
    queryFn: async (): Promise<CampaignLinkTestResult> => {
      const { data: link, error: linkError } = await supabase
        .from('project_campaign_links')
        .select('id, project_id')
        .eq('id', campaignLinkId as string)
        .single()
      if (linkError) throw linkError

      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('test_min_spend')
        .eq('id', link.project_id)
        .single()
      if (projectError) throw projectError

      const { data: siblingLinks, error: siblingsError } = await supabase
        .from('project_campaign_links')
        .select('id, connection_id, external_campaign_id')
        .eq('project_id', link.project_id)
      if (siblingsError) throw siblingsError

      const performances = await Promise.all(
        (siblingLinks as Array<{ id: string; connection_id: string; external_campaign_id: string }>).map(
          async (sibling) => ({
            id: sibling.id,
            performance: await fetchCampaignPerformance([
              { connectionId: sibling.connection_id, campaignId: sibling.external_campaign_id },
            ]),
          }),
        ),
      )

      const minSpend = project.test_min_spend as number | null
      const eligiblePerformances = performances.filter((p) => minSpend == null || p.performance.spend >= minSpend)
      const average = (values: Array<number | null>) => {
        const known = values.filter((v): v is number => v != null)
        return known.length > 0 ? known.reduce((sum, v) => sum + v, 0) / known.length : null
      }
      const avgCpa = average(eligiblePerformances.map((p) => p.performance.cpa))
      const avgCtr = average(eligiblePerformances.map((p) => p.performance.ctr))
      const avgConversionRate = average(eligiblePerformances.map((p) => p.performance.conversionRate))
      const hasEnoughVariants = eligiblePerformances.length >= 2

      const mine = performances.find((p) => p.id === campaignLinkId)
      const mineSpend = mine?.performance.spend ?? 0
      const eligible = minSpend == null || mineSpend >= minSpend

      const beats = (value: number | null | undefined, avg: number | null, lowerIsBetter: boolean) => {
        if (!eligible || !hasEnoughVariants || value == null || avg == null) return null
        return lowerIsBetter ? value < avg : value > avg
      }

      return {
        eligible,
        hasEnoughVariants,
        spend: mineSpend,
        cpa: mine?.performance.cpa ?? null,
        ctr: mine?.performance.ctr ?? null,
        conversionRate: mine?.performance.conversionRate ?? null,
        beatsCpa: beats(mine?.performance.cpa, avgCpa, true),
        beatsCtr: beats(mine?.performance.ctr, avgCtr, false),
        beatsConversionRate: beats(mine?.performance.conversionRate, avgConversionRate, false),
      }
    },
    enabled: !!campaignLinkId,
  })
}

export function useAllTasks() {
  return useQuery({
    queryKey: ['manager-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select(
          'id, title, description, client_id, project_id, status, priority, category, due_date, archived_at, client:clients(name)',
        )
        .is('archived_at', null)
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as unknown as ManagerTaskRecord[]
    },
  })
}

/** Fase 36 — tarefas do Kanban arquivadas automaticamente (concluídas há
 * mais de 30 dias, ver `archive_stale_completed_tasks`) ou à mão. Fora
 * da lista padrão do Kanban, só aparece na tela "Arquivadas". */
export function useArchivedTasks() {
  return useQuery({
    queryKey: ['manager-tasks-archived'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select(
          'id, title, description, client_id, project_id, status, priority, category, due_date, archived_at, client:clients(name)',
        )
        .not('archived_at', 'is', null)
        .order('archived_at', { ascending: false })
      if (error) throw error
      return data as unknown as ManagerTaskRecord[]
    },
  })
}

export function useRestoreManagerTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from('tasks').update({ archived_at: null }).eq('id', taskId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-tasks'] })
      queryClient.invalidateQueries({ queryKey: ['manager-tasks-archived'] })
    },
    onError: () => {
      toast.error('Não foi possível restaurar a tarefa.')
    },
  })
}

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      const { error } = await supabase.from('tasks').update({ status }).eq('id', taskId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-tasks'] })
    },
    onError: () => {
      toast.error('Não foi possível atualizar o status da tarefa.')
    },
  })
}

export function useDeleteManagerTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-tasks'] })
      queryClient.invalidateQueries({ queryKey: ['manager-tasks-archived'] })
    },
    onError: () => {
      toast.error('Não foi possível excluir a tarefa.')
    },
  })
}

/** Apaga várias tarefas do Kanban de uma vez (modo de seleção múltipla). */
export function useDeleteManagerTasks() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (taskIds: string[]) => {
      const { error } = await supabase.from('tasks').delete().in('id', taskIds)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-tasks'] })
      queryClient.invalidateQueries({ queryKey: ['manager-tasks-archived'] })
    },
    onError: () => {
      toast.error('Não foi possível excluir as tarefas selecionadas.')
    },
  })
}

export interface NewManagerTaskInput {
  title: string
  client_id: string
  project_id: string | null
  category: string | null
  priority: string
  due_date: string | null
}

export function useCreateManagerTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewManagerTaskInput) => {
      const { error } = await supabase.from('tasks').insert(input)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-tasks'] })
    },
    onError: () => {
      toast.error('Não foi possível criar a tarefa.')
    },
  })
}

export function useUpdateManagerTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: NewManagerTaskInput & { id: string }) => {
      const { error } = await supabase.from('tasks').update(input).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-tasks'] })
    },
    onError: () => {
      toast.error('Não foi possível atualizar a tarefa.')
    },
  })
}

// Tarefas do Cliente (`client_tasks`) — vistas pelo gestor em
// `/client-tasks` (Fase 35.1, corrigindo um bug real: essa página
// sempre leu `public.tasks`/Kanban filtrado por cliente, então nunca
// mostrava as tarefas que o próprio cliente cria/completa em `/tasks`
// (Portal Cliente) nem as que "Workflows do Cliente" aplica — o
// propósito original da página, segundo o usuário, sempre foi mostrar
// isso). Tabela igual à de `useClientPortalData.ts`, só que aqui o
// gestor pode ver/editar/apagar TODAS (RLS "admin_gestor_full_client_tasks"
// já libera), com o mesmo filtro de plataforma que o Kanban não tem.
export interface ManagerClientTaskRecord {
  id: string
  title: string
  description: string | null
  client_id: string
  project_id: string | null
  status: string
  priority: string
  category: string | null
  due_date: string | null
  recurrence_interval: RecurrenceInterval | null
  completed_at: string | null
  archived_at: string | null
  client: { name: string; plan: string | null } | null
}

export function useAllClientTasks() {
  return useQuery({
    queryKey: ['manager-client-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_tasks')
        .select(
          'id, title, description, client_id, project_id, status, priority, category, due_date, recurrence_interval, completed_at, archived_at, client:clients(name, plan)',
        )
        .is('archived_at', null)
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as unknown as ManagerClientTaskRecord[]
    },
  })
}

/** Fase 36 — mesma ideia de `useArchivedTasks`, pro lado de `client_tasks`.
 * Itens com `recurrence_interval` nunca chegam aqui: o design da Fase 35
 * já cicla a mesma linha pra sempre, então nunca são candidatos a
 * arquivamento (ver `archive_stale_completed_tasks`). */
export function useArchivedClientTasks() {
  return useQuery({
    queryKey: ['manager-client-tasks-archived'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_tasks')
        .select(
          'id, title, description, client_id, project_id, status, priority, category, due_date, recurrence_interval, completed_at, archived_at, client:clients(name, plan)',
        )
        .not('archived_at', 'is', null)
        .order('archived_at', { ascending: false })
      if (error) throw error
      return data as unknown as ManagerClientTaskRecord[]
    },
  })
}

export function useRestoreManagerClientTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from('client_tasks').update({ archived_at: null }).eq('id', taskId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-client-tasks'] })
      queryClient.invalidateQueries({ queryKey: ['manager-client-tasks-archived'] })
    },
    onError: () => {
      toast.error('Não foi possível restaurar a tarefa.')
    },
  })
}

/** Fase 36 — dispara `archive_stale_completed_tasks()` uma vez por
 * carregamento de página (Kanban e "Tarefas do Cliente" chamam este
 * mesmo hook — a função arquiva as duas tabelas juntas de qualquer dos
 * dois lugares, então não importa qual tela o gestor abriu primeiro).
 * Sem cron: é assim que "automático" funciona aqui — silencioso na
 * maioria das vezes, só avisa quando realmente arquivou algo. */
export function useAutoArchiveOldTasks() {
  const queryClient = useQueryClient()
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true

    supabase.rpc('archive_stale_completed_tasks').then(({ data, error }) => {
      if (error) return
      const archivedCount = typeof data === 'number' ? data : 0
      if (archivedCount > 0) {
        toast.info(
          archivedCount === 1
            ? '1 tarefa concluída há mais de 30 dias foi arquivada automaticamente.'
            : `${archivedCount} tarefas concluídas há mais de 30 dias foram arquivadas automaticamente.`,
        )
        queryClient.invalidateQueries({ queryKey: ['manager-tasks'] })
        queryClient.invalidateQueries({ queryKey: ['manager-tasks-archived'] })
        queryClient.invalidateQueries({ queryKey: ['manager-client-tasks'] })
        queryClient.invalidateQueries({ queryKey: ['manager-client-tasks-archived'] })
        queryClient.invalidateQueries({ queryKey: ['activity-checklist-items'] })
        queryClient.invalidateQueries({ queryKey: ['activity-checklist-items-archived'] })
      }
    })
  }, [queryClient])
}

/** Mesma RPC que o Portal Cliente usa (`set_client_task_status`) — ela
 * já aceita admin/gestor, não só o próprio cliente, e carimba
 * `completed_at` quando o novo status é "done" (Fase 35, recorrência). */
export function useUpdateClientTaskStatusAsManager() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      const { error } = await supabase.rpc('set_client_task_status', { task_id: taskId, new_status: status })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-client-tasks'] })
    },
    onError: () => {
      toast.error('Não foi possível atualizar o status da tarefa.')
    },
  })
}

export function useDeleteManagerClientTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from('client_tasks').delete().eq('id', taskId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-client-tasks'] })
      queryClient.invalidateQueries({ queryKey: ['manager-client-tasks-archived'] })
    },
    onError: () => {
      toast.error('Não foi possível excluir a tarefa.')
    },
  })
}

export interface NewManagerClientTaskInput {
  title: string
  client_id: string
  project_id: string | null
  category: string | null
  priority: string
  due_date: string | null
}

export function useCreateManagerClientTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewManagerClientTaskInput) => {
      const { error } = await supabase.from('client_tasks').insert(input)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-client-tasks'] })
    },
    onError: () => {
      toast.error('Não foi possível criar a tarefa.')
    },
  })
}

export function useUpdateManagerClientTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: NewManagerClientTaskInput & { id: string }) => {
      const { error } = await supabase.from('client_tasks').update(input).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-client-tasks'] })
    },
    onError: () => {
      toast.error('Não foi possível atualizar a tarefa.')
    },
  })
}

export function useApplyWorkflow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      clientId,
      projectId,
      workflowName,
      steps,
      activityTemplateIds,
      target,
    }: {
      clientId: string
      projectId: string | null
      workflowName: string
      steps: { title: string; category: string }[]
      activityTemplateIds?: string[]
      /** Sempre 'kanban' (interno da agência) — o destino "client_tasks"
       * que a Fase 30 tinha dado ao Workflow Operacional foi removido:
       * "Workflows do Cliente" (`useApplyClientWorkflow`) é o único
       * caminho pra mandar tarefa pro Portal Cliente daqui pra frente. */
      target?: 'kanban'
    }) => {
      const { error } = await supabase.rpc('apply_workflow', {
        p_client_id: clientId,
        p_project_id: projectId,
        p_workflow_name: workflowName,
        p_steps: steps,
        p_activity_template_ids: activityTemplateIds ?? [],
        p_target: target ?? 'kanban',
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-tasks'] })
      queryClient.invalidateQueries({ queryKey: ['manager-timeline'] })
      queryClient.invalidateQueries({ queryKey: ['activity-checklist-items'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: () => {
      toast.error('Não foi possível aplicar o workflow.')
    },
  })
}

/** Só uma pré-seleção de conveniência (Fase 14) — não aplica nada
 * sozinho, só lembra qual workflow costuma ser usado nesse cliente. */
export function useSetClientDefaultWorkflow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ clientId, workflowTemplateId }: { clientId: string; workflowTemplateId: string }) => {
      const { error } = await supabase
        .from('clients')
        .update({ default_workflow_template_id: workflowTemplateId })
        .eq('id', clientId)
      if (error) throw error
    },
    onSuccess: (_data, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: ['manager-clients'] })
      queryClient.invalidateQueries({ queryKey: ['manager-client', clientId] })
    },
    onError: () => {
      toast.error('Não foi possível salvar o workflow padrão do cliente.')
    },
  })
}

/** Fase 31 — só relevante pra clientes do plano Validação; passar
 * `null` volta pro estado "ainda não definida". */
export function useSetClientChosenPlatform() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ clientId, chosenPlatform }: { clientId: string; chosenPlatform: 'meta' | 'google' | null }) => {
      const { error } = await supabase.from('clients').update({ chosen_platform: chosenPlatform }).eq('id', clientId)
      if (error) throw error
    },
    onSuccess: (_data, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: ['manager-clients'] })
      queryClient.invalidateQueries({ queryKey: ['manager-client', clientId] })
      queryClient.invalidateQueries({ queryKey: ['activity-checklist-items'] })
    },
    onError: () => {
      toast.error('Não foi possível salvar a plataforma escolhida.')
    },
  })
}

export interface WorkflowTemplateStep {
  title: string
  category: string
  /** Prazo em dias — quando aplicado, a tarefa nasce com due_date =
   * hoje + esse número (calculado no banco, ver apply_workflow /
   * apply_client_workflow). Sem valor, a tarefa não ganha prazo. */
  due_days?: number | null
  /** Fase 35 — recorrência (ver `src/lib/recurrence.ts`), só usada de
   * verdade pelo Workflow do Cliente (`apply_client_workflow` copia pra
   * `client_tasks.recurrence_interval`); o Workflow Operacional
   * (`apply_workflow`, tarefas do Kanban) ignora esse campo — a UI de
   * edição dele nem mostra a opção. */
  recurrence?: RecurrenceInterval | null
}

export interface WorkflowTemplateRecord {
  id: string
  name: string
  description: string | null
  steps: WorkflowTemplateStep[]
  /** Workflows de Atividades disparados junto quando esse workflow é
   * aplicado (Fase 6.6.2) — ids de `activity_templates`. */
  activity_template_ids: string[]
}

export function useWorkflowTemplates() {
  return useQuery({
    queryKey: ['workflow-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workflow_templates')
        .select('id, name, description, steps, activity_template_ids')
        .order('name', { ascending: true })
      if (error) throw error
      return data as unknown as WorkflowTemplateRecord[]
    },
  })
}

export interface NewWorkflowTemplateInput {
  name: string
  description: string | null
  steps: WorkflowTemplateStep[]
  activity_template_ids: string[]
}

export function useCreateWorkflowTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewWorkflowTemplateInput) => {
      const { error } = await supabase.from('workflow_templates').insert(input)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-templates'] })
    },
    onError: () => {
      toast.error('Não foi possível criar o modelo de workflow.')
    },
  })
}

export function useDeleteWorkflowTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase.from('workflow_templates').delete().eq('id', templateId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-templates'] })
    },
    onError: () => {
      toast.error('Não foi possível excluir o modelo de workflow.')
    },
  })
}

export function useUpdateWorkflowTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: NewWorkflowTemplateInput & { id: string }) => {
      const { error } = await supabase.from('workflow_templates').update(input).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-templates'] })
    },
    onError: () => {
      toast.error('Não foi possível atualizar o modelo de workflow.')
    },
  })
}

// Workflows do Cliente (Fase 6.5.2) — mesmo modelo de workflow_templates,
// mas aplicado direto a um ou mais clientes (sem projeto), via
// apply_client_workflow.
export interface ClientWorkflowTemplateRecord {
  id: string
  name: string
  description: string | null
  steps: WorkflowTemplateStep[]
}

export function useClientWorkflowTemplates() {
  return useQuery({
    queryKey: ['client-workflow-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_workflow_templates')
        .select('id, name, description, steps')
        .order('name', { ascending: true })
      if (error) throw error
      return data as unknown as ClientWorkflowTemplateRecord[]
    },
  })
}

export interface NewClientWorkflowTemplateInput {
  name: string
  description: string | null
  steps: WorkflowTemplateStep[]
}

export function useCreateClientWorkflowTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewClientWorkflowTemplateInput) => {
      const { error } = await supabase.from('client_workflow_templates').insert(input)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-workflow-templates'] })
    },
    onError: () => {
      toast.error('Não foi possível criar o workflow do cliente.')
    },
  })
}

export function useUpdateClientWorkflowTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: NewClientWorkflowTemplateInput & { id: string }) => {
      const { error } = await supabase.from('client_workflow_templates').update(input).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-workflow-templates'] })
    },
    onError: () => {
      toast.error('Não foi possível atualizar o workflow do cliente.')
    },
  })
}

export function useDeleteClientWorkflowTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase.from('client_workflow_templates').delete().eq('id', templateId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-workflow-templates'] })
    },
    onError: () => {
      toast.error('Não foi possível excluir o workflow do cliente.')
    },
  })
}

export function useApplyClientWorkflow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ clientIds, templateId }: { clientIds: string[]; templateId: string }) => {
      const { error } = await supabase.rpc('apply_client_workflow', {
        p_client_ids: clientIds,
        p_template_id: templateId,
      })
      if (error) throw error
    },
    onSuccess: () => {
      // As tarefas nascem em client_tasks, direto no Portal Cliente do
      // outro usuário — nada na tela do gestor mostra client_tasks pra
      // invalidar; só o audit_log de "Workflow de cliente aplicado".
      queryClient.invalidateQueries({ queryKey: ['manager-timeline'] })
    },
    onError: () => {
      toast.error('Não foi possível aplicar o workflow ao cliente.')
    },
  })
}

// Workflows de Atividades (Fase 6.6.2) — checklists reaproveitáveis de
// texto simples. Disparados junto de um Workflow do Kanban (ver
// activity_template_ids em WorkflowTemplateRecord) ou, quando marcados
// como padrão, aplicados sozinhos a todo cliente novo (trigger no
// banco, ver handle_new_client_activity_template).
export type ActivityPlanScope = 'validacao' | 'escala' | 'dominacao'
export type ActivityPlatformScope = 'meta' | 'google'

export interface ActivityTemplateItem {
  title: string
  category?: string | null
  /** Fase 29 — em quais planos do cliente (`clients.plan`) esse item entra
   * ao aplicar o Workflow. Ausente/vazio é tratado como "todos os planos"
   * (dado antigo, de antes desta fase). */
  plan_scope?: ActivityPlanScope[]
  /** Fase 31/31b — mesmo padrão do plan_scope: os 2 marcados = aparece
   * pra qualquer plataforma escolhida (só distingue algo pra clientes
   * Validação, ver `clients.chosen_platform`); só 1 marcado = exclusivo
   * daquela plataforma. Ausente/vazio é tratado como "as duas". */
  platform_scope?: ActivityPlatformScope[]
  /** Fase 35 — recorrência (ver `src/lib/recurrence.ts`): ausente/null =
   * item único, como sempre foi. Copiado pra `recurrence_interval` na
   * instância (`activity_checklist_items`) no momento em que o Workflow
   * é aplicado. */
  recurrence?: RecurrenceInterval | null
}

export interface ActivityTemplateRecord {
  id: string
  name: string
  description: string | null
  items: ActivityTemplateItem[]
  is_default: boolean
}

export function useActivityTemplates() {
  return useQuery({
    queryKey: ['activity-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_templates')
        .select('id, name, description, items, is_default')
        .order('name', { ascending: true })
      if (error) throw error
      return data as unknown as ActivityTemplateRecord[]
    },
  })
}

export interface NewActivityTemplateInput {
  name: string
  description: string | null
  items: ActivityTemplateItem[]
}

export function useCreateActivityTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewActivityTemplateInput) => {
      const { error } = await supabase.from('activity_templates').insert(input)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-templates'] })
    },
    onError: () => {
      toast.error('Não foi possível criar o modelo de atividade.')
    },
  })
}

export function useUpdateActivityTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: NewActivityTemplateInput & { id: string }) => {
      const { error } = await supabase.from('activity_templates').update(input).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-templates'] })
    },
    onError: () => {
      toast.error('Não foi possível atualizar o modelo de atividade.')
    },
  })
}

export function useDeleteActivityTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase.from('activity_templates').delete().eq('id', templateId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-templates'] })
    },
    onError: () => {
      toast.error('Não foi possível excluir o modelo de atividade.')
    },
  })
}

export function useSetDefaultActivityTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase.rpc('set_default_activity_template', { p_template_id: templateId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-templates'] })
    },
    onError: () => {
      toast.error('Não foi possível marcar o modelo como padrão.')
    },
  })
}

/** Diferente de "marcar como padrão" (que zera os outros via RPC — só
 * pode haver 1), desmarcar é um update direto e simples: a policy
 * "admin_full_activity_templates" já libera isso pra admin. */
export function useUnsetDefaultActivityTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase.from('activity_templates').update({ is_default: false }).eq('id', templateId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-templates'] })
    },
    onError: () => {
      toast.error('Não foi possível desmarcar o modelo como padrão.')
    },
  })
}

// Atividades (Fase 6.6.2) — itens já instanciados por cliente, exibidos
// na aba "Atividades" e na Central de Informações do Cliente.
export interface ActivityChecklistItemRecord {
  id: string
  client_id: string
  project_id: string | null
  title: string
  category: string | null
  completed: boolean
  step_order: number
  source_template_name: string | null
  /** Fase 31/31b — os 2 juntos aparecem pra qualquer plataforma; só 1
   * aparece pro cliente Validação que escolheu essa plataforma. */
  platform_scope: ActivityPlatformScope[]
  /** Fase 35 — ver `src/lib/recurrence.ts`. `completed_at` é o carimbo
   * do último ciclo concluído; junto com `recurrence_interval` e o
   * plano do cliente (`client.plan`) decide se o item já "venceu" e
   * deve voltar a aparecer como pendente. */
  recurrence_interval: RecurrenceInterval | null
  completed_at: string | null
  archived_at: string | null
  client: { name: string; plan: string | null } | null
}

export function useActivityChecklistItems() {
  return useQuery({
    queryKey: ['activity-checklist-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_checklist_items')
        .select(
          'id, client_id, project_id, title, category, completed, step_order, source_template_name, platform_scope, recurrence_interval, completed_at, archived_at, client:clients(name, plan)',
        )
        .is('archived_at', null)
        .order('step_order', { ascending: true })
      if (error) throw error
      return data as unknown as ActivityChecklistItemRecord[]
    },
  })
}

/** Fase 36.1 — mesma ideia de `useArchivedTasks`/`useArchivedClientTasks`,
 * pro lado de `activity_checklist_items`. Só item SEM recorrência chega
 * aqui (ver `archive_stale_completed_tasks`) — item recorrente nunca é
 * arquivado de verdade, só fica visualmente colapsado quando concluído
 * (`isCompletionStale`, calculado em `Activities.tsx`/`ClientDetail.tsx`,
 * sem nenhuma linha no banco envolvida). */
export function useArchivedActivityChecklistItems() {
  return useQuery({
    queryKey: ['activity-checklist-items-archived'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_checklist_items')
        .select(
          'id, client_id, project_id, title, category, completed, step_order, source_template_name, platform_scope, recurrence_interval, completed_at, archived_at, client:clients(name, plan)',
        )
        .not('archived_at', 'is', null)
        .order('archived_at', { ascending: false })
      if (error) throw error
      return data as unknown as ActivityChecklistItemRecord[]
    },
  })
}

export function useRestoreActivityChecklistItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from('activity_checklist_items').update({ archived_at: null }).eq('id', itemId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-checklist-items'] })
      queryClient.invalidateQueries({ queryKey: ['activity-checklist-items-archived'] })
    },
    onError: () => {
      toast.error('Não foi possível restaurar o item.')
    },
  })
}

export interface NewActivityChecklistItemInput {
  client_id: string
  title: string
  category: string | null
}

export function useCreateActivityChecklistItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewActivityChecklistItemInput) => {
      const { error } = await supabase.from('activity_checklist_items').insert(input)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-checklist-items'] })
    },
    onError: () => {
      toast.error('Não foi possível criar o item da checklist.')
    },
  })
}

export function useToggleActivityChecklistItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ itemId, completed }: { itemId: string; completed: boolean }) => {
      // Fase 35 — marcar como concluído carimba completed_at (usado pra
      // saber quando o próximo ciclo de recorrência vence); desmarcar
      // limpa o carimbo. Item sem recorrência nenhuma ignora isso, mas
      // gravar o carimbo sempre é inofensivo (só passa a importar se o
      // item ganhar recorrência depois).
      const { error } = await supabase
        .from('activity_checklist_items')
        .update({ completed, completed_at: completed ? new Date().toISOString() : null })
        .eq('id', itemId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-checklist-items'] })
    },
    onError: () => {
      toast.error('Não foi possível marcar o item da checklist.')
    },
  })
}

/** Apaga vários itens de Atividades de uma vez (modo de seleção múltipla). */
export function useDeleteActivityChecklistItems() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (itemIds: string[]) => {
      const { error } = await supabase.from('activity_checklist_items').delete().in('id', itemIds)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-checklist-items'] })
      queryClient.invalidateQueries({ queryKey: ['activity-checklist-items-archived'] })
    },
    onError: () => {
      toast.error('Não foi possível excluir os itens selecionados.')
    },
  })
}

export interface ManagerDigitalAssetRecord {
  id: string
  name: string
  type: string | null
  client_id: string
  platform: string | null
  status: string
  url: string | null
  code: string | null
  /** Fase 38 — só usado quando type === 'google_forms': o "propósito"
   * combinado no cadastro do Ativo (Genérico/Vendas/Objeções), copiado
   * pra dentro da conexão assim que ela existir (ver
   * digital_asset_connections.form_purpose, Fase 37). */
  form_purpose: 'vendas' | 'perdido' | null
  client: { name: string } | null
}

export function useAllDigitalAssets() {
  return useQuery({
    queryKey: ['manager-digital-assets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('digital_assets')
        .select('*, client:clients(name)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as unknown as ManagerDigitalAssetRecord[]
    },
  })
}

export interface DigitalAssetConnectionRecord {
  id: string
  digital_asset_id: string
  provider: string
  status: string
  project_id: string | null
  external_account_id: string | null
  /** Fase 35.2 — nome de verdade do que a conexão aponta (hoje só
   * preenchido pro Google Forms, com o título real do formulário) —
   * diferente do nome do Ativo Digital, que é só um rótulo escolhido
   * por quem cadastrou. */
  external_account_name: string | null
  last_synced_at: string | null
  /** Fase 37 — só faz sentido pro Google Forms: quando definido, toda
   * resposta nova sincronizada (ainda "novo") já nasce classificada
   * como Venda/Perdido sozinha, sem precisar de clique manual. */
  form_purpose: 'vendas' | 'perdido' | null
}

/** Conexões de integração (Fase 6.1/6.2) — quem escreve aqui é sempre
 * a Edge Function "integrations" (service role); o app só lê, pra
 * mostrar o status "Conectado"/"Desconectado" no card do Ativo Digital. */
export function useDigitalAssetConnections() {
  return useQuery({
    queryKey: ['digital-asset-connections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('digital_asset_connections')
        .select(
          'id, digital_asset_id, provider, status, project_id, external_account_id, external_account_name, last_synced_at, form_purpose',
        )
      if (error) throw error
      return data as DigitalAssetConnectionRecord[]
    },
  })
}

/** Fase 37 — propósito do formulário conectado (Venda/Perdido/nenhum),
 * via RPC (mesma razão de sempre: a RLS de `digital_asset_connections`
 * só libera SELECT pro app). */
export function useSetFormPurpose() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ connectionId, purpose }: { connectionId: string; purpose: 'vendas' | 'perdido' | null }) => {
      const { error } = await supabase.rpc('set_form_purpose', { p_connection_id: connectionId, p_purpose: purpose })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['digital-asset-connections'] })
    },
    onError: () => {
      toast.error('Não foi possível salvar o propósito do formulário.')
    },
  })
}

/** Fase 35.2 — desconecta a integração de um Ativo Digital (mantém a
 * linha/histórico, chama a Edge Function porque a RLS de
 * digital_asset_connections só libera SELECT pro app, quem escreve é
 * sempre a service role). */
export function useDisconnectIntegration() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (connectionId: string) => disconnectIntegration(connectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['digital-asset-connections'] })
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Não foi possível desconectar.')
    },
  })
}

export interface AgencyProviderConnectionRecord {
  id: string
  provider: string
  status: string
  external_account_id: string | null
}

/** Conexão de agência (Fase 28 — MCC no Google Ads, Business Manager no
 * Meta), 1 linha por provedor. Quem escreve é sempre a Edge Function
 * "integrations" (service role); o app só lê, pra mostrar o status em
 * Configurações > Agência e decidir se o diálogo "Conectar integração"
 * mostra a lista de contas ou pede pra conectar a agência primeiro. */
export function useAgencyProviderConnections() {
  return useQuery({
    queryKey: ['agency-provider-connections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agency_provider_connections')
        .select('id, provider, status, external_account_id')
      if (error) throw error
      return data as AgencyProviderConnectionRecord[]
    },
  })
}

export interface FormQuestionRecord {
  id: string
  external_question_id: string
  title: string
  question_type: string
  options: string[] | null
  position: number | null
}

/** Perguntas estruturadas de um Google Forms conectado (Fase 8.2),
 * sincronizadas via API oficial (forms.googleapis.com) — usadas pra
 * rotular as respostas de `useFormResponses` pelo título real. */
export function useFormQuestions(connectionId: string | null) {
  return useQuery({
    queryKey: ['form-questions', connectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('form_questions')
        .select('id, external_question_id, title, question_type, options, position')
        .eq('connection_id', connectionId as string)
        .order('position', { ascending: true })
      if (error) throw error
      return data as FormQuestionRecord[]
    },
    enabled: !!connectionId,
  })
}

export interface FormAnswerRecord {
  external_question_id: string
  answer_text: string | null
  answer_values: string[] | null
}

export type LeadStatus = 'novo' | 'qualificado' | 'venda' | 'perdido'

export interface FormResponseRecord {
  id: string
  external_response_id: string
  submitted_at: string | null
  /** Fase 35 — Fechamento do Loop de Venda: status manual do lead,
   * marcado pelo gestor aqui ou pelo próprio cliente (Portal Cliente →
   * Leads). Alimenta a contagem de "Leads Qualificados"/"Vendas" das
   * Metas SMART (`useClientLeadStatusCounts`). */
  status: LeadStatus
  form_answers: FormAnswerRecord[]
}

/** Respostas estruturadas mais recentes de um Google Forms conectado
 * (Fase 8.2) — só uma vitrine pra confirmar que a sincronização trouxe
 * dado real; a síntese em % das perguntas fechadas fica pra Fase 8.3. */
export function useFormResponses(connectionId: string | null) {
  return useQuery({
    queryKey: ['form-responses', connectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('form_responses')
        .select(
          'id, external_response_id, submitted_at, status, form_answers(external_question_id, answer_text, answer_values)',
        )
        .eq('connection_id', connectionId as string)
        .order('submitted_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return data as unknown as FormResponseRecord[]
    },
    enabled: !!connectionId,
  })
}

export function useSetFormResponseStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ responseId, status }: { responseId: string; status: LeadStatus }) => {
      const { error } = await supabase.rpc('set_form_response_status', { p_response_id: responseId, p_status: status })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-responses'] })
      queryClient.invalidateQueries({ queryKey: ['lead-status-counts'] })
      // Fase 37, Bloco 3: o botão "Já é esse" do ManualLeadsDialog usa essa
      // mesma mutation -- sem isso, a busca ficava com o resultado velho
      // (botão "marcar Qualificado" continuava ali, status ainda "Novo" no
      // subtítulo) mesmo depois do status já ter mudado de verdade no banco.
      queryClient.invalidateQueries({ queryKey: ['search-form-responses'] })
    },
    onError: () => {
      toast.error('Não foi possível atualizar o status do lead.')
    },
  })
}

/** Contagem de leads por status de um cliente, somando TODOS os
 * formulários conectados dele + os leads manuais (Fase 37 — registrados
 * pra cobrir quem qualifica por um canal que o app não rastreia, ex:
 * respondeu no WhatsApp) — alimenta a sugestão automática nas Metas
 * SMART de tipo "Leads"/"Leads Qualificados"/"Vendas" (Fase 35, Parte 2
 * + Fase 37). "Qualificados" conta qualificado + venda (uma venda
 * também passou pela qualificação); "Vendas" conta só venda. `total`
 * (volume bruto) continua só de resposta de formulário de propósito —
 * lead manual nunca preencheu formulário nenhum, não faz sentido somar
 * aí. */
export function useClientLeadStatusCounts(clientId: string | null) {
  return useQuery({
    queryKey: ['lead-status-counts', clientId],
    queryFn: async () => {
      const [formResult, manualResult] = await Promise.all([
        supabase.from('form_responses').select('status').eq('client_id', clientId as string),
        supabase.from('manual_leads').select('status').eq('client_id', clientId as string),
      ])
      if (formResult.error) throw formResult.error
      if (manualResult.error) throw manualResult.error
      const formRows = formResult.data as { status: LeadStatus }[]
      const manualRows = manualResult.data as { status: LeadStatus }[]
      const allClassified = [...formRows, ...manualRows]
      const qualificados = allClassified.filter((r) => r.status === 'qualificado' || r.status === 'venda').length
      const vendas = allClassified.filter((r) => r.status === 'venda').length
      return { qualificados, vendas, total: formRows.length }
    },
    enabled: !!clientId,
  })
}

export interface ClientAdConversions {
  /** Soma de `conversions` (pixel/tag do próprio Google/Meta Ads) dos
   * últimos 30 dias, de TODAS as campanhas vinculadas a QUALQUER
   * projeto do cliente — número por natureza diferente da contagem de
   * respostas de formulário (uma conversão rastreada pelo provedor não
   * é necessariamente um preenchimento do Google Forms conectado). */
  conversions: number
  /** false quando o cliente não tem nenhuma campanha vinculada ainda —
   * usado pra decidir se vale a pena mostrar a linha (0 por falta de
   * vínculo é diferente de 0 conversões reais). */
  hasLinkedCampaigns: boolean
}

/** Fase 37, Bloco 2 — "Leads" (bruto) ganha uma 2ª fonte de contagem
 * real: em vez de só respostas de formulário, também soma a conversão
 * que o próprio Google/Meta Ads já rastreia via pixel/tag nas campanhas
 * vinculadas aos projetos do cliente (`campaign_performance_snapshots`,
 * já sincronizado pra CPA/ROAS — só reaproveitado aqui). */
export function useClientAdConversions(clientId: string | null) {
  return useQuery({
    queryKey: ['client-ad-conversions', clientId],
    queryFn: async (): Promise<ClientAdConversions> => {
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id')
        .eq('client_id', clientId as string)
      if (projectsError) throw projectsError
      const projectIds = (projects ?? []).map((p) => p.id as string)
      if (projectIds.length === 0) return { conversions: 0, hasLinkedCampaigns: false }

      const { data: links, error: linksError } = await supabase
        .from('project_campaign_links')
        .select('connection_id, external_campaign_id')
        .in('project_id', projectIds)
      if (linksError) throw linksError
      const linkRows = (links ?? []) as { connection_id: string; external_campaign_id: string }[]
      if (linkRows.length === 0) return { conversions: 0, hasLinkedCampaigns: false }

      const connectionIds = Array.from(new Set(linkRows.map((l) => l.connection_id)))
      const validPairs = new Set(linkRows.map((l) => `${l.connection_id}:${l.external_campaign_id}`))
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

      const { data: snapshots, error: snapshotsError } = await supabase
        .from('campaign_performance_snapshots')
        .select('connection_id, external_campaign_id, conversions, snapshot_date')
        .in('connection_id', connectionIds)
        .gte('snapshot_date', since)
      if (snapshotsError) throw snapshotsError

      const conversions = ((snapshots ?? []) as { connection_id: string; external_campaign_id: string; conversions: number | null }[])
        .filter((s) => validPairs.has(`${s.connection_id}:${s.external_campaign_id}`))
        .reduce((sum, s) => sum + (s.conversions ?? 0), 0)

      return { conversions, hasLinkedCampaigns: true }
    },
    enabled: !!clientId,
  })
}

export interface ManualLeadRecord {
  id: string
  client_id: string
  name: string
  contact: string | null
  note: string | null
  status: LeadStatus
  created_at: string
}

/** Fase 37, Bloco 3 — leads registrados na mão (ex: respondeu no
 * WhatsApp, nunca preencheu formulário nenhum) — mesmo funil de status
 * de `form_responses`, só que sem resposta de formulário por trás.
 * Contam pra "Leads Qualificados"/"Vendas" (`useClientLeadStatusCounts`),
 * nunca pro volume bruto "Leads" (que é só preenchimento de formulário). */
export function useManualLeads(clientId: string | null) {
  return useQuery({
    queryKey: ['manual-leads', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('manual_leads')
        .select('id, client_id, name, contact, note, status, created_at')
        .eq('client_id', clientId as string)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as ManualLeadRecord[]
    },
    enabled: !!clientId,
  })
}

export interface CreateManualLeadInput {
  client_id: string
  name: string
  contact: string | null
  note: string | null
}

export function useCreateManualLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateManualLeadInput) => {
      const { error } = await supabase.from('manual_leads').insert(input)
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['manual-leads', variables.client_id] })
      queryClient.invalidateQueries({ queryKey: ['lead-status-counts', variables.client_id] })
    },
    onError: () => {
      toast.error('Não foi possível registrar o lead.')
    },
  })
}

export function useSetManualLeadStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ leadId, status }: { leadId: string; status: LeadStatus }) => {
      const { error } = await supabase.rpc('set_manual_lead_status', { p_lead_id: leadId, p_status: status })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manual-leads'] })
      queryClient.invalidateQueries({ queryKey: ['lead-status-counts'] })
    },
    onError: () => {
      toast.error('Não foi possível atualizar o status do lead.')
    },
  })
}

export interface FormResponseSearchHit {
  id: string
  submitted_at: string | null
  status: LeadStatus
  matchedAnswer: string
}

/** Fase 37, Bloco 3 — busca dentro das respostas de formulário já
 * sincronizadas de um cliente, procurando o termo em QUALQUER resposta
 * de QUALQUER pergunta (nome, telefone, e-mail, o que a pessoa tiver
 * digitado) — usada antes de registrar um lead manual, pra achar quem
 * já tem uma linha de formulário e evitar duplicar o mesmo lead 2 vezes. */
export function useSearchFormResponses(clientId: string | null, term: string) {
  const trimmed = term.trim()
  return useQuery({
    queryKey: ['search-form-responses', clientId, trimmed],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('form_answers')
        .select('answer_text, response:form_responses!inner(id, submitted_at, status, client_id)')
        .eq('form_responses.client_id', clientId as string)
        .ilike('answer_text', `%${trimmed}%`)
        .limit(10)
      if (error) throw error
      const rows = data as unknown as {
        answer_text: string | null
        response: { id: string; submitted_at: string | null; status: LeadStatus }
      }[]
      const seen = new Set<string>()
      const hits: FormResponseSearchHit[] = []
      for (const row of rows) {
        if (seen.has(row.response.id)) continue
        seen.add(row.response.id)
        hits.push({
          id: row.response.id,
          submitted_at: row.response.submitted_at,
          status: row.response.status,
          matchedAnswer: row.answer_text ?? '',
        })
      }
      return hits
    },
    enabled: !!clientId && trimmed.length >= 2,
  })
}

const CLOSED_QUESTION_TYPES = ['choice_radio', 'choice_checkbox', 'choice_dropdown', 'scale', 'grid_row']

/** Síntese em % das perguntas fechadas dos Google Forms conectados de
 * um cliente (Fase 8.3, "Públicos-Alvo") — 100% dinâmico: junta as
 * perguntas fechadas de TODOS os formulários conectados do cliente (0,
 * 1 ou vários), sem nenhuma lista de perguntas/opções fixa no código.
 * A agregação em si (`aggregateAudienceInsights`) é uma função pura em
 * `src/lib/audience-insights.ts`, coberta por teste automatizado. */
export function useAudienceInsights(clientId: string | null) {
  return useQuery({
    queryKey: ['audience-insights', clientId],
    queryFn: async () => {
      const { data: assets, error: assetsError } = await supabase
        .from('digital_assets')
        .select('id')
        .eq('client_id', clientId as string)
      if (assetsError) throw assetsError
      const assetIds = (assets ?? []).map((a) => a.id)
      if (assetIds.length === 0) return []

      const { data: connections, error: connectionsError } = await supabase
        .from('digital_asset_connections')
        .select('id')
        .eq('provider', 'google_forms')
        .in('digital_asset_id', assetIds)
      if (connectionsError) throw connectionsError
      const connectionIds = (connections ?? []).map((c) => c.id)
      if (connectionIds.length === 0) return []

      const { data: questions, error: questionsError } = await supabase
        .from('form_questions')
        .select('id, connection_id, external_question_id, title, question_type, position')
        .in('connection_id', connectionIds)
        .in('question_type', CLOSED_QUESTION_TYPES)
        .order('position', { ascending: true })
      if (questionsError) throw questionsError
      if (!questions || questions.length === 0) return []

      const { data: responses, error: responsesError } = await supabase
        .from('form_responses')
        .select('id, connection_id, form_answers(external_question_id, answer_text, answer_values)')
        .eq('client_id', clientId as string)
      if (responsesError) throw responsesError

      return aggregateAudienceInsights(questions, (responses ?? []) as unknown as AudienceRawResponse[])
    },
    enabled: !!clientId,
  })
}

const OPEN_QUESTION_TYPES = ['text_short', 'text_paragraph']

/** Respostas de texto livre dos Google Forms conectados de um cliente
 * (Fase 8.4, "Comunicação Persuasiva") — mesma ideia de
 * `useAudienceInsights`, mas pras perguntas abertas em vez das
 * fechadas. `connectionIds` já vem filtrado pelo seletor de Formulário
 * da própria página (`AudienceInsights.tsx`), não recalcula aqui. */
export function useOpenTextAnswers(clientId: string | null, connectionIds: string[]) {
  return useQuery({
    queryKey: ['open-text-answers', clientId, connectionIds],
    queryFn: async () => {
      const { data: questions, error: questionsError } = await supabase
        .from('form_questions')
        .select('external_question_id, connection_id')
        .in('connection_id', connectionIds)
        .in('question_type', OPEN_QUESTION_TYPES)
      if (questionsError) throw questionsError
      if (!questions || questions.length === 0) return []

      const openQuestionKeys = new Set(questions.map((q) => `${q.connection_id}|${q.external_question_id}`))

      const { data: responses, error: responsesError } = await supabase
        .from('form_responses')
        .select('connection_id, form_answers(external_question_id, answer_text)')
        .eq('client_id', clientId as string)
        .in('connection_id', connectionIds)
      if (responsesError) throw responsesError

      const answers: string[] = []
      for (const response of (responses ?? []) as unknown as Array<{
        connection_id: string
        form_answers: Array<{ external_question_id: string; answer_text: string | null }>
      }>) {
        for (const answer of response.form_answers) {
          if (!answer.answer_text?.trim()) continue
          if (!openQuestionKeys.has(`${response.connection_id}|${answer.external_question_id}`)) continue
          answers.push(answer.answer_text)
        }
      }
      return answers
    },
    enabled: !!clientId && connectionIds.length > 0,
  })
}

export interface NewDigitalAssetInput {
  name: string
  client_id: string
  type: string | null
  platform: string | null
  status: string
  url: string | null
  code: string | null
  /** Fase 38 — ver ManagerDigitalAssetRecord.form_purpose. */
  form_purpose?: 'vendas' | 'perdido' | null
}

export function useCreateDigitalAsset() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewDigitalAssetInput) => {
      const { error } = await supabase.from('digital_assets').insert(input)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-digital-assets'] })
    },
    onError: () => {
      toast.error('Não foi possível criar o ativo digital.')
    },
  })
}

export function useUpdateDigitalAsset() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: NewDigitalAssetInput & { id: string }) => {
      const { error } = await supabase.from('digital_assets').update(input).eq('id', id)
      if (error) throw error
      // Fase 38 — propaga o propósito também pra conexão google_forms já
      // existente (se houver), senão a sincronização continuaria usando
      // o valor antigo até desconectar/reconectar. RLS de
      // digital_asset_connections só libera SELECT pro app (mesma razão
      // de sempre), por isso via RPC (`set_asset_form_purpose`, ela
      // mesma também já regrava o valor em `digital_assets`).
      if ('form_purpose' in input) {
        const { error: purposeError } = await supabase.rpc('set_asset_form_purpose', {
          p_asset_id: id,
          p_purpose: input.form_purpose ?? null,
        })
        if (purposeError) throw purposeError
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-digital-assets'] })
      queryClient.invalidateQueries({ queryKey: ['digital-asset-connections'] })
    },
    onError: () => {
      toast.error('Não foi possível atualizar o ativo digital.')
    },
  })
}

export function useUpdateDigitalAssetStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ assetId, status }: { assetId: string; status: string }) => {
      const { error } = await supabase.from('digital_assets').update({ status }).eq('id', assetId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-digital-assets'] })
    },
    onError: () => {
      toast.error('Não foi possível atualizar o status do ativo digital.')
    },
  })
}

export function useDeleteDigitalAsset() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (assetId: string) => {
      const { error } = await supabase.from('digital_assets').delete().eq('id', assetId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-digital-assets'] })
    },
    onError: () => {
      toast.error('Não foi possível excluir o ativo digital.')
    },
  })
}

export interface ManagerSmartGoalRecord {
  id: string
  title: string
  client_id: string
  metric_type: string | null
  target_value: number | null
  current_value: number | null
  target_date: string | null
  status: string
  client: { name: string } | null
}

export function useAllSmartGoals() {
  return useQuery({
    queryKey: ['manager-smart-goals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('smart_goals')
        .select('*, client:clients(name)')
        .order('target_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as unknown as ManagerSmartGoalRecord[]
    },
  })
}

export interface NewSmartGoalInput {
  title: string
  client_id: string
  metric_type: string | null
  target_value: number | null
  current_value: number | null
  target_date: string | null
  status: string
}

export function useCreateSmartGoal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewSmartGoalInput) => {
      const { error } = await supabase.from('smart_goals').insert(input)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-smart-goals'] })
    },
    onError: () => {
      toast.error('Não foi possível criar a meta.')
    },
  })
}

export function useUpdateSmartGoalProgress() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      goalId,
      currentValue,
      status,
    }: {
      goalId: string
      currentValue: number
      status: string
    }) => {
      const { error } = await supabase
        .from('smart_goals')
        .update({ current_value: currentValue, status })
        .eq('id', goalId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-smart-goals'] })
    },
    onError: () => {
      toast.error('Não foi possível atualizar o progresso da meta.')
    },
  })
}

export function useDeleteSmartGoal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (goalId: string) => {
      const { error } = await supabase.from('smart_goals').delete().eq('id', goalId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-smart-goals'] })
    },
    onError: () => {
      toast.error('Não foi possível excluir a meta.')
    },
  })
}

const COMMENTS_ENTITY_TYPE = 'general'

export interface ManagerCommentRecord {
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

export function useClientComments(clientId: string | null) {
  return useQuery({
    queryKey: ['manager-comments', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('client_id', clientId as string)
        .eq('entity_type', COMMENTS_ENTITY_TYPE)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as ManagerCommentRecord[]
    },
    enabled: !!clientId,
  })
}

export function useCreateManagerComment() {
  const { user, fullName, role } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      clientId,
      title,
      content,
      audioUrl,
      audioDurationSeconds,
    }: {
      clientId: string
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
    onSuccess: (_data, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: ['manager-comments', clientId] })
    },
    onError: () => {
      toast.error('Não foi possível enviar o comentário.')
    },
  })
}

export interface ManagerMeetingRecord {
  id: string
  title: string
  client_id: string
  date: string | null
  meeting_link: string | null
  status: string
  cancellation_reason: string | null
  cancelled_by_role: string | null
  client: { name: string } | null
}

export function useAllMeetings() {
  return useQuery({
    queryKey: ['manager-meetings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meetings')
        .select('*, client:clients(name)')
        .order('date', { ascending: true })
      if (error) throw error
      return data as unknown as ManagerMeetingRecord[]
    },
  })
}

export interface NewManagerMeetingInput {
  title: string
  client_id: string
  date: string
  meeting_link: string | null
}

export function useCreateManagerMeeting() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewManagerMeetingInput) => {
      const { error } = await supabase.from('meetings').insert(input)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-meetings'] })
    },
    onError: () => {
      toast.error('Não foi possível agendar a reunião.')
    },
  })
}

export function useCancelManagerMeeting() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ meetingId, reason }: { meetingId: string; reason: string }) => {
      const { error } = await supabase.rpc('cancel_meeting', { meeting_id: meetingId, reason })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-meetings'] })
    },
    onError: () => {
      toast.error('Não foi possível cancelar a reunião.')
    },
  })
}

export function useDeleteManagerMeeting() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (meetingId: string) => {
      const { error } = await supabase.from('meetings').delete().eq('id', meetingId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-meetings'] })
    },
    onError: () => {
      toast.error('Não foi possível excluir a reunião.')
    },
  })
}

export function useCompleteManagerMeeting() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (meetingId: string) => {
      const { error } = await supabase.rpc('complete_meeting', { meeting_id: meetingId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-meetings'] })
    },
    onError: () => {
      toast.error('Não foi possível concluir a reunião.')
    },
  })
}

export interface ClientMeetingRecurrenceRecord {
  client_id: string
  active: boolean
}

export function useClientMeetingRecurrence(clientId: string | null) {
  return useQuery({
    queryKey: ['manager-meeting-recurrence', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_meeting_recurrence')
        .select('client_id, active')
        .eq('client_id', clientId as string)
        .maybeSingle()
      if (error) throw error
      return data as ClientMeetingRecurrenceRecord | null
    },
    enabled: !!clientId,
  })
}

export function useEnrollMeetingRecurrence() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase.rpc('enroll_client_meeting_recurrence', { p_client_id: clientId })
      if (error) throw error
    },
    onSuccess: (_data, clientId) => {
      queryClient.invalidateQueries({ queryKey: ['manager-meeting-recurrence', clientId] })
      queryClient.invalidateQueries({ queryKey: ['manager-meetings'] })
    },
    onError: (err) => {
      // O RPC lança uma mensagem específica e segura de mostrar quando o
      // cliente não tem plano definido — mantém em vez de trocar por uma
      // mensagem genérica.
      toast.error(err instanceof Error ? err.message : 'Não foi possível ativar a recorrência de reuniões.')
    },
  })
}

export function useSetMeetingRecurrenceActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ clientId, active }: { clientId: string; active: boolean }) => {
      const { error } = await supabase.rpc('set_client_meeting_recurrence_active', {
        p_client_id: clientId,
        p_active: active,
      })
      if (error) throw error
    },
    onSuccess: (_data, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: ['manager-meeting-recurrence', clientId] })
    },
    onError: () => {
      toast.error('Não foi possível atualizar a recorrência de reuniões.')
    },
  })
}

export interface ManagerFileItemRecord {
  id: string
  name: string
  client_id: string
  folder: string | null
  file_url: string | null
  file_type: string | null
  status: string
  created_at: string
}

export function useClientFileItems(clientId: string | null) {
  return useQuery({
    queryKey: ['manager-file-items', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('file_items')
        .select('*')
        .eq('client_id', clientId as string)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as ManagerFileItemRecord[]
    },
    enabled: !!clientId,
  })
}

export interface NewManagerFileItemInput {
  name: string
  client_id: string
  folder: string | null
  file_url: string
  file_type: string | null
}

export function useCreateManagerFileItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewManagerFileItemInput) => {
      const { error } = await supabase.from('file_items').insert(input)
      if (error) throw error
    },
    onSuccess: (_data, { client_id }) => {
      queryClient.invalidateQueries({ queryKey: ['manager-file-items', client_id] })
    },
    onError: () => {
      toast.error('Não foi possível enviar o arquivo.')
    },
  })
}

export interface ManagerApprovalRecord {
  id: string
  title: string
  client_id: string
  file_url: string | null
  file_type: string | null
  status: string
  feedback: string | null
  created_at: string
  auto_approved: boolean
}

export function useClientApprovals(clientId: string | null) {
  return useQuery({
    queryKey: ['manager-approvals', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('approvals')
        .select('*')
        .eq('client_id', clientId as string)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as ManagerApprovalRecord[]
    },
    enabled: !!clientId,
  })
}

export interface NewManagerApprovalInput {
  title: string
  client_id: string
  file_url: string
  file_type: string | null
}

export function useCreateManagerApproval() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewManagerApprovalInput) => {
      const { error } = await supabase.from('approvals').insert(input)
      if (error) throw error
    },
    onSuccess: (_data, { client_id }) => {
      queryClient.invalidateQueries({ queryKey: ['manager-approvals', client_id] })
    },
    onError: () => {
      toast.error('Não foi possível enviar a aprovação.')
    },
  })
}

/** Última atividade por aba (chave = href do menu), usada pra acender a
 * bolinha de notificação — comparada com "nav_last_seen" em useNavSeen.ts. */
export function useManagerNavActivity(enabled = true) {
  return useQuery({
    queryKey: ['manager-nav-activity'],
    queryFn: async () => {
      const [comments, meetings, fileItems, approvals, alerts, incidents, tasks, smartGoals] = await Promise.all([
        fetchLatestUpdatedAt('comments'),
        fetchLatestUpdatedAt('meetings'),
        fetchLatestUpdatedAt('file_items'),
        fetchLatestUpdatedAt('approvals'),
        fetchLatestUpdatedAt('alerts'),
        fetchLatestUpdatedAt('incidents'),
        fetchLatestUpdatedAt('tasks'),
        fetchLatestUpdatedAt('smart_goals'),
      ])
      return {
        '/client-comments': comments,
        '/client-meetings': meetings,
        '/client-files': latestOf(fileItems, approvals),
        '/incidents': latestOf(alerts, incidents),
        '/kanban': tasks,
        '/smart-goals': smartGoals,
      } as Record<string, string | null>
    },
    enabled,
    refetchInterval: 60000,
  })
}

export interface NewClientInput {
  name: string
  company: string | null
  email: string | null
  status: string
  plan: string | null
  monthly_fee: number | null
}

export function useCreateClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewClientInput) => {
      const { error } = await supabase.from('clients').insert(input)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-clients'] })
    },
    onError: () => {
      toast.error('Não foi possível criar o cliente.')
    },
  })
}

// Fase 23b — mesmo dado que `usePerformanceSnapshots` já busca pro
// cliente logado (Portal Cliente), só que aqui pra um client_id
// arbitrário (Central de Informações do Cliente, Portal Gestor) —
// mesmas fórmulas (aggregateSnapshotKpis/buildMetricSeries) valem
// pros dois, pra nunca mostrar número diferente do lado do cliente.
export function useClientPerformanceSnapshots(clientId: string | null) {
  return useQuery({
    queryKey: ['client-performance-snapshots', clientId],
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

// Fase 23 — histórico diário dos 8 KPIs do Dashboard Executivo
// (executive_kpi_snapshots, capturado por cron), pro clique-pra-detalhe
// nos cards (MetricDetailDialog, mesmo componente do Portal Cliente).
export function useExecutiveKpiHistory() {
  return useQuery({
    queryKey: ['executive-kpi-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('executive_kpi_snapshots')
        .select('*')
        .order('snapshot_date', { ascending: true })
      if (error) throw error
      return data as ExecutiveKpiSnapshotRecord[]
    },
  })
}

// Fase 24 — histórico diário do Health Score de UM cliente
// (client_health_score_snapshots, gravado a cada recálculo), pro
// clique-pra-detalhe no card "Health Score" da Central de Informações.
export function useClientHealthScoreHistory(clientId: string | null) {
  return useQuery({
    queryKey: ['client-health-score-history', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_health_score_snapshots')
        .select('*')
        .eq('client_id', clientId as string)
        .order('snapshot_date', { ascending: true })
      if (error) throw error
      return data as ClientHealthScoreSnapshotRecord[]
    },
    enabled: !!clientId,
  })
}
