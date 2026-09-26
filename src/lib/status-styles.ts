// Rótulos e cores de badge para os campos de status/prioridade/severidade
// vindos do banco (Fase 3). Centralizados aqui porque as mesmas listas
// vão reaparecer em várias telas nas próximas sub-fases.

export const taskStatusLabels: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'A fazer',
  in_progress: 'Em andamento',
  review: 'Em revisão',
  done: 'Concluída',
}

export const taskStatusStyles: Record<string, string> = {
  backlog: 'border-slate-500/20 bg-slate-500/10 text-slate-400',
  todo: 'border-sky-500/20 bg-sky-500/10 text-sky-400',
  in_progress: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
  review: 'border-purple-500/20 bg-purple-500/10 text-purple-400',
  done: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
}

export const taskPriorityLabels: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
}

export const meetingStatusLabels: Record<string, string> = {
  scheduled: 'Agendada',
  completed: 'Concluída',
  cancelled: 'Cancelada',
}

export const meetingStatusStyles: Record<string, string> = {
  scheduled: 'border-sky-500/20 bg-sky-500/10 text-sky-400',
  completed: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
  cancelled: 'border-destructive/20 bg-destructive/10 text-destructive',
}

export const incidentStatusLabels: Record<string, string> = {
  open: 'Aberto',
  in_progress: 'Em andamento',
  resolved: 'Resolvido',
  closed: 'Fechado',
}

export const incidentStatusStyles: Record<string, string> = {
  open: 'border-destructive/20 bg-destructive/10 text-destructive',
  in_progress: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
  resolved: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
  closed: 'border-slate-500/20 bg-slate-500/10 text-slate-400',
}

export const severityLabels: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
}

export const severityStyles: Record<string, string> = {
  low: 'border-slate-500/20 bg-slate-500/10 text-slate-400',
  medium: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
  high: 'border-orange-500/20 bg-orange-500/10 text-orange-400',
  critical: 'border-destructive/20 bg-destructive/10 text-destructive',
}

// Usado pra ordenar incidentes/alertas com os mais severos primeiro
// (número maior = mais severo).
export const severityRank: Record<string, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
}

export const roleLabels: Record<string, string> = {
  admin: 'Admin',
  gestor: 'Gestor',
  cliente: 'Cliente',
}

export const roleStyles: Record<string, string> = {
  admin: 'border-purple-500/20 bg-purple-500/10 text-purple-400',
  gestor: 'border-sky-500/20 bg-sky-500/10 text-sky-400',
  cliente: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
}

export const clientStatusLabels: Record<string, string> = {
  active: 'Ativo',
  onboarding: 'Onboarding',
  paused: 'Pausado',
  churned: 'Encerrado',
  at_risk: 'Em risco',
}

export const clientStatusStyles: Record<string, string> = {
  active: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
  onboarding: 'border-sky-500/20 bg-sky-500/10 text-sky-400',
  paused: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
  churned: 'border-destructive/20 bg-destructive/10 text-destructive',
  at_risk: 'border-destructive/20 bg-destructive/10 text-destructive',
}

// Badge extra e automático (não é um status salvo — calculado em
// src/lib/client-risk.ts) mostrado junto do status manual do cliente.
export const clientProblemStatusStyle = 'border-orange-500/20 bg-orange-500/10 text-orange-400'
export const clientProblemStatusLabel = 'Em problemas'

// Planos fixos do cliente (Fase 5.5) — chave estável salva no banco,
// rótulo em português só existe aqui no front.
export const planLabels: Record<string, string> = {
  validacao: 'Validação',
  escala: 'Escala',
  dominacao: 'Dominação',
}

export const planStyles: Record<string, string> = {
  validacao: 'border-sky-500/20 bg-sky-500/10 text-sky-400',
  escala: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
  dominacao: 'border-purple-500/20 bg-purple-500/10 text-purple-400',
}

// Frequência de reuniões automáticas ligada a cada plano — ver
// "meeting_recurrence_interval" no banco (mesmo mapeamento dos dois lados).
export const planMeetingFrequencyLabels: Record<string, string> = {
  validacao: 'Mensal',
  escala: 'Quinzenal',
  dominacao: 'Semanal',
}

export function getHealthScoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'text-foreground'
  if (score < 50) return 'text-destructive'
  if (score < 70) return 'text-amber-400'
  return 'text-emerald-400'
}

export const projectStatusLabels: Record<string, string> = {
  planning: 'Planejamento',
  active: 'Ativo',
  paused: 'Pausado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
}

export const projectStatusStyles: Record<string, string> = {
  planning: 'border-sky-500/20 bg-sky-500/10 text-sky-400',
  active: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
  paused: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
  completed: 'border-purple-500/20 bg-purple-500/10 text-purple-400',
  cancelled: 'border-destructive/20 bg-destructive/10 text-destructive',
}

export const reviewStatusLabels: Record<string, string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  revision_requested: 'Revisão pedida',
}

export const reviewStatusStyles: Record<string, string> = {
  pending: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
  approved: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
  rejected: 'border-destructive/20 bg-destructive/10 text-destructive',
  revision_requested: 'border-purple-500/20 bg-purple-500/10 text-purple-400',
}

/** Aprovações viradas sozinhas depois de 48h sem resposta do cliente
 * (Fase 7) — mesmo status "approved" no banco, mas com um rótulo/cor
 * diferentes pra deixar claro que não foi uma decisão real do cliente. */
export function getApprovalStatusLabel(approval: { status: string; auto_approved: boolean }): string {
  if (approval.status === 'approved' && approval.auto_approved) return 'Aprovado por atraso'
  return reviewStatusLabels[approval.status] ?? approval.status
}

export function getApprovalStatusStyle(approval: { status: string; auto_approved: boolean }): string {
  if (approval.status === 'approved' && approval.auto_approved) {
    return 'border-amber-500/20 bg-amber-500/10 text-amber-400'
  }
  return reviewStatusStyles[approval.status] ?? ''
}

export const smartGoalStatusLabels: Record<string, string> = {
  on_track: 'No caminho certo',
  at_risk: 'Em risco',
  off_track: 'Fora da rota',
  completed: 'Concluída',
}

export const smartGoalStatusStyles: Record<string, string> = {
  on_track: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
  at_risk: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
  off_track: 'border-destructive/20 bg-destructive/10 text-destructive',
  completed: 'border-purple-500/20 bg-purple-500/10 text-purple-400',
}

export const digitalAssetStatusLabels: Record<string, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  pending: 'Pendente',
  revoked: 'Revogado',
}

export const digitalAssetStatusStyles: Record<string, string> = {
  active: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
  inactive: 'border-slate-500/20 bg-slate-500/10 text-slate-400',
  pending: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
  revoked: 'border-destructive/20 bg-destructive/10 text-destructive',
}

export const digitalAssetTypeLabels: Record<string, string> = {
  business_manager: 'Business Manager',
  ad_account: 'Conta de Anúncios',
  pixel: 'Pixel',
  tag: 'Tag',
  domain: 'Domínio',
  // Fase 38 — escolher esse tipo já revela o campo "Propósito deste
  // formulário" (Genérico/Vendas/Objeções) no próprio formulário de
  // criar/editar Ativo, antes de existir qualquer conexão.
  google_forms: 'Formulário (Google Forms)',
  other: 'Outro',
}

// Tipos de ativo cujo acesso é por código/snippet, não por link.
export const digitalAssetCodeTypes = ['pixel', 'tag']

export const goalDeadlineStatusLabels: Record<string, string> = {
  overdue: 'Atrasada',
  urgent: 'Urgente',
  upcoming: 'Imediato',
}

export const goalDeadlineStatusStyles: Record<string, string> = {
  overdue: 'border-destructive/20 bg-destructive/10 text-destructive',
  urgent: 'border-orange-500/20 bg-orange-500/10 text-orange-400',
  upcoming: 'border-sky-500/20 bg-sky-500/10 text-sky-400',
}

export const smartGoalMetricLabels: Record<string, string> = {
  cpa: 'CPA',
  roas: 'ROAS',
  cpc: 'CPC',
  ctr: 'CTR',
  cpm: 'CPM',
  leads: 'Leads',
  conversoes: 'Conversões',
  faturamento: 'Faturamento',
  ticket_medio: 'Ticket Médio',
  taxa_conversao: 'Taxa de Conversão',
  // Fase 35, Parte 2 — Fechamento do Loop de Venda: alimentados de
  // verdade pela contagem de status de leads (ver
  // `useClientLeadStatusCounts`), não é só rótulo decorativo.
  leads_qualificados: 'Leads Qualificados',
  vendas: 'Vendas',
}

// Status de lead (Fase 35, Parte 2) — marcado no Portal Cliente (aba
// "Leads") ou pelo gestor (Ativos Digitais → Integrações → Ver
// respostas), sempre a mesma linha em `form_responses`.
export const leadStatusLabels: Record<string, string> = {
  novo: 'Novo',
  qualificado: 'Qualificado',
  venda: 'Venda',
  perdido: 'Perdido',
}

export const leadStatusStyles: Record<string, string> = {
  novo: 'border-slate-500/20 bg-slate-500/10 text-slate-400',
  qualificado: 'border-sky-500/20 bg-sky-500/10 text-sky-400',
  venda: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
  perdido: 'border-destructive/20 bg-destructive/10 text-destructive',
}

// Conexões de integração (Fase 6.1-6.4) — usados no card de Ativo
// Digital e na página "Integrações".
export const connectionProviderLabels: Record<string, string> = {
  google_ads: 'Google Ads',
  google_forms: 'Google Forms',
  meta_ads: 'Meta Ads',
}

// Estado de campanha (last_known_status de project_campaign_links,
// mantido por check_campaign_state_changes()) — mesma severidade usada
// pro alerta em si (medium/high), reaproveitando severityStyles acima
// em vez de cores novas.
export const campaignStateLabels: Record<string, string> = {
  PAUSED: 'Pausada',
  REMOVED: 'Removida',
}

export const campaignStateStyles: Record<string, string> = {
  PAUSED: severityStyles.medium,
  REMOVED: severityStyles.high,
}

export const connectionStatusLabels: Record<string, string> = {
  disconnected: 'Desconectado',
  connected: 'Conectado',
  error: 'Erro na conexão',
}

export const connectionStatusStyles: Record<string, string> = {
  disconnected: 'border-slate-500/20 bg-slate-500/10 text-slate-400',
  connected: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
  error: 'border-destructive/20 bg-destructive/10 text-destructive',
}

// Dispositivo (Fase 32, aba "Grupos de Anúncios" > Dispositivo) —
// segments.device do Google Ads.
export const deviceLabels: Record<string, string> = {
  MOBILE: 'Celular',
  DESKTOP: 'Computador',
  TABLET: 'Tablet',
  CONNECTED_TV: 'TV conectada',
  OTHER: 'Outro',
  UNKNOWN: 'Desconhecido',
}

// Demográfico + melhor dia/horário (Nível 2 do documento de dados do
// Google Ads) — ad_group_criterion.age_range.type / .gender.type
// (age_range_view/gender_view), segments.day_of_week e o "hourBucket"
// que o Edge Function já resume (ver handleListCampaignInsights).
export const ageRangeLabels: Record<string, string> = {
  AGE_RANGE_18_24: '18–24 anos',
  AGE_RANGE_25_34: '25–34 anos',
  AGE_RANGE_35_44: '35–44 anos',
  AGE_RANGE_45_54: '45–54 anos',
  AGE_RANGE_55_64: '55–64 anos',
  AGE_RANGE_65_UP: '65+ anos',
  AGE_RANGE_UNDETERMINED: 'Não determinado',
}

export const genderLabels: Record<string, string> = {
  MALE: 'Masculino',
  FEMALE: 'Feminino',
  UNDETERMINED: 'Não determinado',
}

export const dayOfWeekLabels: Record<string, string> = {
  MONDAY: 'segundas-feiras',
  TUESDAY: 'terças-feiras',
  WEDNESDAY: 'quartas-feiras',
  THURSDAY: 'quintas-feiras',
  FRIDAY: 'sextas-feiras',
  SATURDAY: 'sábados',
  SUNDAY: 'domingos',
}

export const hourBucketLabels: Record<string, string> = {
  MADRUGADA: 'madrugada (0h–6h)',
  MANHA: 'manhã (6h–12h)',
  TARDE: 'tarde (12h–18h)',
  NOITE: 'noite (18h–24h)',
}

// Tipo de campanha (Fase 32) — vem cru da API do provedor, sincronizado
// junto com o resto (campaign.advertising_channel_type no Google Ads,
// objective no Meta Ads). Sem entrada = mostra o valor cru mesmo (mesmo
// padrão de projectStatusLabels), pra nunca esconder um valor novo que
// a API passe a devolver antes de eu mapear aqui.
export const campaignTypeLabels: Record<string, string> = {
  // Google Ads — campaign.advertising_channel_type
  SEARCH: 'Pesquisa',
  DISPLAY: 'Display',
  SHOPPING: 'Shopping',
  VIDEO: 'Vídeo',
  PERFORMANCE_MAX: 'Performance Max',
  DEMAND_GEN: 'Demand Gen',
  DISCOVERY: 'Demand Gen',
  MULTI_CHANNEL: 'Multicanal',
  LOCAL: 'Local',
  LOCAL_SERVICES: 'Serviços Locais',
  SMART: 'Smart',
  APP: 'App',
  HOTEL: 'Hotel',
  TRAVEL: 'Viagem',
  UNKNOWN: 'Desconhecido',
  UNSPECIFIED: 'Não especificado',
  // Meta Ads — objective da campanha
  OUTCOME_SALES: 'Vendas',
  OUTCOME_LEADS: 'Leads',
  OUTCOME_ENGAGEMENT: 'Engajamento',
  OUTCOME_AWARENESS: 'Reconhecimento',
  OUTCOME_TRAFFIC: 'Tráfego',
  OUTCOME_APP_PROMOTION: 'Promoção de App',
  CONVERSIONS: 'Conversões',
  LEAD_GENERATION: 'Geração de Leads',
  LINK_CLICKS: 'Cliques no Link',
  BRAND_AWARENESS: 'Reconhecimento de Marca',
  REACH: 'Alcance',
  APP_INSTALLS: 'Instalações de App',
}

// Catálogo de Criativos e Segmentações (Fase 34) — sempre por cliente
// específico, sem reaproveitamento entre clientes.
export const catalogTypeLabels: Record<string, string> = {
  criativo: 'Criativo',
  segmentacao: 'Segmentação',
}

export const catalogEntryTipoLabels: Record<string, string> = {
  headline: 'Headline',
  descricao: 'Descrição',
  frase_destaque: 'Frase de destaque',
  video: 'Vídeo',
}

export const catalogEntryOrigemLabels: Record<string, string> = {
  ia: 'IA (Cassie)',
  forms: 'Forms',
  manual: 'Manual',
}

export const catalogEntryStatusLabels: Record<string, string> = {
  rascunho: 'Rascunho',
  em_teste: 'Em Teste',
  aprovado_implementado: 'Aprovado/Implementado',
  descartado: 'Descartado',
}

export const catalogEntryStatusStyles: Record<string, string> = {
  rascunho: 'border-slate-500/20 bg-slate-500/10 text-slate-400',
  em_teste: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
  aprovado_implementado: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
  descartado: 'border-destructive/20 bg-destructive/10 text-destructive',
}

export const catalogEntryPrioridadeLabels: Record<string, string> = {
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
}

export const catalogEntryPrioridadeStyles: Record<string, string> = {
  alta: 'border-destructive/20 bg-destructive/10 text-destructive',
  media: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
  baixa: 'border-slate-500/20 bg-slate-500/10 text-slate-400',
}

// Usado pra ordenar candidatas em triagem com as de prioridade mais
// alta primeiro (número maior = mais prioritária).
export const catalogEntryPrioridadeRank: Record<string, number> = {
  alta: 2,
  media: 1,
  baixa: 0,
}
