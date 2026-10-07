// Ametista Conversões — Fase 11c.2: Sistema de Notificações Push.
//
// Como usar: cole este arquivo inteiro no painel do Supabase, em Edge
// Functions > notifications > editar código > Deploy. A verificação
// automática de JWT precisa estar DESLIGADA nas configurações da
// função — as duas rotas daqui são chamadas só por servidor (pelo
// pg_cron e pelos gatilhos de banco via net.http_post), nunca pelo
// navegador do usuário, então não têm CORS nem checagem de JWT de
// usuário — só um segredo compartilhado (ver abaixo).
//
// Segredos que essa função espera encontrar configurados (Edge
// Functions > Secrets), além dos que o Supabase já injeta sozinho
// (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY):
//   VAPID_PUBLIC_KEY          — gerado uma vez via `npx web-push generate-vapid-keys`
//   VAPID_PRIVATE_KEY         — idem, NUNCA colar no código nem no chat
//   VAPID_SUBJECT             — contato exigido pelo protocolo Web Push,
//                                ex: mailto:contato@dominio.com
//   NOTIFICATIONS_CRON_SECRET — inventado, usado também na migração
//                                migration-038-fase11c-notificacoes-gatilhos-cron.sql
//                                (gatilhos de incidente/alerta + cron do /tick)
//
// Rotas (as duas exigem o cabeçalho X-Notifications-Secret):
//   POST .../notifications/tick       {}                    — chamada pelo pg_cron a cada 1 minuto;
//                                                              roda as 4 checagens por tempo (cliente em
//                                                              risco, meta atrasada, lembrete de reunião
//                                                              1h/15min) e despacha o que for novo
//   POST .../notifications/dispatch   { kind, entity_id }   — chamada pelos gatilhos de incidente/alerta
//                                                              criado (evento, não por tempo)
//
// Inscrever/cancelar notificação (tabela push_subscriptions) NÃO passa
// por aqui — o front escreve direto via supabase-js, protegido por RLS
// (auth.uid() = user_id), igual a tabela nav_last_seen já faz hoje.

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import { timingSafeEqual } from 'node:crypto'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function getServiceClient() {
  return createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
}

// Fase 21.1: grava em error_logs pra aparecer em /errors no Portal
// Gestor. Nunca lança — logging não pode virar uma fonte nova de erro.
async function logServerError(functionName: string, context: string, error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error)
  try {
    await getServiceClient()
      .from('error_logs')
      .insert({
        source: 'edge_function',
        function_name: functionName,
        message: `${context}: ${message}`,
        stack: error instanceof Error ? (error.stack ?? null) : null,
        context: error instanceof Error ? null : (error ?? null),
      })
  } catch (err) {
    console.error(`[${functionName}] não foi possível gravar em error_logs:`, err)
  }
}

/** Compara em tempo constante (Fase 20.1) — evita que alguém descubra
 * o segredo aos poucos, medindo quanto tempo cada tentativa errada
 * leva pra falhar. */
function safeCompare(a: string, b: string): boolean {
  const bufA = new TextEncoder().encode(a)
  const bufB = new TextEncoder().encode(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

function requireCronSecret(req: Request): Response | null {
  const secret = req.headers.get('X-Notifications-Secret') ?? ''
  const expectedSecret = Deno.env.get('NOTIFICATIONS_CRON_SECRET') ?? ''
  if (!expectedSecret || !safeCompare(secret, expectedSecret)) return jsonResponse({ error: 'Não autorizado' }, 401)
  return null
}

function configureWebPush() {
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
  const subject = Deno.env.get('VAPID_SUBJECT') ?? ''
  if (!publicKey || !privateKey || !subject) return false
  webpush.setVapidDetails(subject, publicKey, privateKey)
  return true
}

interface PushPayload {
  title: string
  body: string
  url: string
  tag: string
}

/** Manda o payload pra todas as inscrições ativas dos usuários dados —
 * uma linha por navegador/aparelho, então uma pessoa com 2 aparelhos
 * recebe 2 notificações, uma em cada. Nunca lança erro: cada envio é
 * tentado de forma independente, e uma inscrição morta (404/410 —
 * usuário desinstalou, permissão revogada etc.) é apagada na hora,
 * autolimpeza padrão do protocolo Web Push. */
async function sendPushToUsers(supabase: SupabaseClient, userIds: string[], payload: PushPayload) {
  if (userIds.length === 0) return { sent: 0, failed: 0, cleaned: 0 }

  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth_key')
    .in('user_id', userIds)

  let sent = 0
  let failed = 0
  let cleaned = 0

  for (const sub of subscriptions ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
        JSON.stringify(payload),
      )
      sent++
    } catch (err) {
      failed++
      const statusCode = (err as { statusCode?: number }).statusCode
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        cleaned++
      }
    }
  }

  return { sent, failed, cleaned }
}

async function getAdminGestorUserIds(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase.from('profiles').select('id').in('role', ['admin', 'gestor'])
  return (data ?? []).map((p) => p.id as string)
}

async function getClientUserIds(supabase: SupabaseClient, clientId: string): Promise<string[]> {
  const { data } = await supabase.from('profiles').select('id').eq('client_id', clientId).eq('role', 'cliente')
  return (data ?? []).map((p) => p.id as string)
}

async function dispatchIncident(supabase: SupabaseClient, entityId: string) {
  const { data: incident } = await supabase
    .from('incidents')
    .select('id, title, severity, client_id, clients(name)')
    .eq('id', entityId)
    .maybeSingle()
  if (!incident) return
  const clientName = (incident.clients as unknown as { name: string } | null)?.name ?? 'cliente'

  const adminGestorIds = await getAdminGestorUserIds(supabase)
  await sendPushToUsers(supabase, adminGestorIds, {
    title: 'Novo incidente',
    body: `${incident.title} (${clientName})`,
    url: '/incidents',
    tag: `incident-${incident.id}`,
  })
}

async function dispatchAlert(supabase: SupabaseClient, entityId: string) {
  const { data: alert } = await supabase
    .from('alerts')
    .select('id, title, client_id, clients(name)')
    .eq('id', entityId)
    .maybeSingle()
  if (!alert) return
  const clientName = (alert.clients as unknown as { name: string } | null)?.name ?? 'cliente'

  const adminGestorIds = await getAdminGestorUserIds(supabase)
  await sendPushToUsers(supabase, adminGestorIds, {
    title: 'Novo alerta',
    body: `${alert.title} (${clientName})`,
    url: '/alerts',
    tag: `alert-${alert.id}`,
  })

  const clientUserIds = await getClientUserIds(supabase, alert.client_id as string)
  await sendPushToUsers(supabase, clientUserIds, {
    title: 'Novo alerta',
    body: alert.title as string,
    url: '/',
    tag: `alert-${alert.id}`,
  })
}

async function dispatchClientAtRisk(supabase: SupabaseClient, clientId: string) {
  const { data: client } = await supabase.from('clients').select('id, name').eq('id', clientId).maybeSingle()
  if (!client) return

  const adminGestorIds = await getAdminGestorUserIds(supabase)
  await sendPushToUsers(supabase, adminGestorIds, {
    title: 'Cliente em risco',
    body: `${client.name} está com sinais de risco — confira a Central de Informações`,
    url: `/clients/${client.id}`,
    tag: `client-at-risk-${client.id}`,
  })
}

async function dispatchOverdueGoal(supabase: SupabaseClient, entityId: string) {
  const { data: goal } = await supabase
    .from('smart_goals')
    .select('id, title, client_id, clients(name)')
    .eq('id', entityId)
    .maybeSingle()
  if (!goal) return
  const clientName = (goal.clients as unknown as { name: string } | null)?.name ?? 'cliente'

  const adminGestorIds = await getAdminGestorUserIds(supabase)
  await sendPushToUsers(supabase, adminGestorIds, {
    title: 'Meta atrasada',
    body: `"${goal.title}" (${clientName}) está com o prazo vencido`,
    url: '/smart-goals',
    tag: `smart-goal-overdue-${goal.id}`,
  })
}

async function dispatchMeetingReminder(supabase: SupabaseClient, entityId: string, when: '1 hora' | '15 minutos') {
  const { data: meeting } = await supabase
    .from('meetings')
    .select('id, title, client_id, clients(name)')
    .eq('id', entityId)
    .maybeSingle()
  if (!meeting) return
  const clientName = (meeting.clients as unknown as { name: string } | null)?.name ?? 'cliente'

  const adminGestorIds = await getAdminGestorUserIds(supabase)
  const clientUserIds = await getClientUserIds(supabase, meeting.client_id as string)
  const recipientIds = [...new Set([...adminGestorIds, ...clientUserIds])]

  await sendPushToUsers(supabase, recipientIds, {
    title: `Reunião em ${when}`,
    body: `"${meeting.title}" com ${clientName}`,
    url: '/meetings',
    tag: `meeting-reminder-${meeting.id}`,
  })
}

/** Fase 21.4 — lembrete de renovação de contrato (30/7/1 dias antes de
 * clients.renewal_date). Aviso interno da agência, não do cliente —
 * só admin/gestor recebe (diferente de dispatchMeetingReminder, que
 * também avisa o cliente). */
async function dispatchRenewalReminder(supabase: SupabaseClient, entityId: string, when: '30 dias' | '7 dias' | '1 dia') {
  const { data: client } = await supabase.from('clients').select('id, name').eq('id', entityId).maybeSingle()
  if (!client) return

  const adminGestorIds = await getAdminGestorUserIds(supabase)
  await sendPushToUsers(supabase, adminGestorIds, {
    title: `Renovação em ${when}`,
    body: `Contrato de ${client.name} renova em ${when}`,
    url: `/clients/${client.id}`,
    tag: `renewal-reminder-${client.id}`,
  })
}

/** Fase 48.8 — análise do gestor publicada. Só o cliente é avisado
 * (quem publica já sabe, é o próprio gestor que acabou de agir). */
async function dispatchManagerAnalysisPublished(supabase: SupabaseClient, entityId: string) {
  const { data: analysis } = await supabase
    .from('manager_analyses')
    .select('id, client_id, clients(name)')
    .eq('id', entityId)
    .maybeSingle()
  if (!analysis) return
  const clientName = (analysis.clients as unknown as { name: string } | null)?.name ?? 'seu gestor'

  const clientUserIds = await getClientUserIds(supabase, analysis.client_id as string)
  await sendPushToUsers(supabase, clientUserIds, {
    title: 'Nova análise do gestor',
    body: `${clientName}: sua análise do período foi publicada`,
    url: '/reports',
    tag: `manager-analysis-${analysis.id}`,
  })
}

/** Fase 48.9 — análise do gestor vencida (passou da cadência do plano
 * sem publicar nenhuma pro período corrente). Aviso interno, só
 * admin/gestor (mesmo padrão de dispatchRenewalReminder). */
async function dispatchManagerAnalysisOverdue(supabase: SupabaseClient, clientId: string) {
  const { data: client } = await supabase.from('clients').select('id, name').eq('id', clientId).maybeSingle()
  if (!client) return

  const adminGestorIds = await getAdminGestorUserIds(supabase)
  await sendPushToUsers(supabase, adminGestorIds, {
    title: 'Análise do gestor vencida',
    body: `${client.name} está sem análise publicada no período corrente`,
    url: `/clients/${client.id}`,
    tag: `manager-analysis-overdue-${client.id}`,
  })
}

async function dispatchByKindAndId(supabase: SupabaseClient, kind: string, entityId: string) {
  switch (kind) {
    case 'incident_created':
      return dispatchIncident(supabase, entityId)
    case 'alert_created':
      return dispatchAlert(supabase, entityId)
    case 'client_at_risk':
      return dispatchClientAtRisk(supabase, entityId)
    case 'smart_goal_overdue':
      return dispatchOverdueGoal(supabase, entityId)
    case 'meeting_reminder_1h':
      return dispatchMeetingReminder(supabase, entityId, '1 hora')
    case 'meeting_reminder_15m':
      return dispatchMeetingReminder(supabase, entityId, '15 minutos')
    case 'renewal_reminder_30d':
      return dispatchRenewalReminder(supabase, entityId, '30 dias')
    case 'renewal_reminder_7d':
      return dispatchRenewalReminder(supabase, entityId, '7 dias')
    case 'renewal_reminder_1d':
      return dispatchRenewalReminder(supabase, entityId, '1 dia')
    case 'manager_analysis_published':
      return dispatchManagerAnalysisPublished(supabase, entityId)
    case 'manager_analysis_overdue':
      return dispatchManagerAnalysisOverdue(supabase, entityId)
  }
}

async function handleDispatch(req: Request) {
  const authError = requireCronSecret(req)
  if (authError) return authError
  if (!configureWebPush()) return jsonResponse({ error: 'VAPID ainda não configurado (faltam segredos)' }, 400)

  let body: { kind?: string; entity_id?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Corpo inválido' }, 400)
  }
  if (!body.kind || !body.entity_id) return jsonResponse({ error: 'kind e entity_id são obrigatórios' }, 400)

  const supabase = getServiceClient()
  await dispatchByKindAndId(supabase, body.kind, body.entity_id)
  return jsonResponse({ ok: true })
}

/** Roda as 4 checagens por tempo (as por evento — incidente/alerta —
 * chegam por /dispatch, direto do gatilho de banco). Cada função de
 * detecção já devolve só o que é NOVO desde a última vez (dedup feito
 * no banco via push_notification_log), então aqui é só despachar. */
async function handleTick(req: Request) {
  const authError = requireCronSecret(req)
  if (authError) return authError
  if (!configureWebPush()) return jsonResponse({ error: 'VAPID ainda não configurado (faltam segredos)' }, 400)

  const supabase = getServiceClient()

  const [atRisk, overdueGoals, reminders1h, reminders15m, renewal30d, renewal7d, renewal1d, analysisOverdue] = await Promise.all([
    supabase.rpc('detect_new_at_risk_clients'),
    supabase.rpc('detect_new_overdue_goals'),
    supabase.rpc('detect_new_meeting_reminders_1h'),
    supabase.rpc('detect_new_meeting_reminders_15m'),
    supabase.rpc('detect_new_renewal_reminders_30d'),
    supabase.rpc('detect_new_renewal_reminders_7d'),
    supabase.rpc('detect_new_renewal_reminders_1d'),
    supabase.rpc('detect_new_manager_analysis_overdue'),
  ])

  const errors = [
    atRisk.error,
    overdueGoals.error,
    reminders1h.error,
    reminders15m.error,
    renewal30d.error,
    renewal7d.error,
    renewal1d.error,
    analysisOverdue.error,
  ].filter(Boolean)
  if (errors.length > 0) {
    await logServerError('notifications', 'handleTick: rodar detect_new_*', errors)
    return jsonResponse({ error: errors.map((e) => e?.message).join('; ') }, 500)
  }

  const dispatched: Array<{ kind: string; id: string }> = [
    ...(atRisk.data ?? []).map((r: { id: string }) => ({ kind: 'client_at_risk', id: r.id })),
    ...(overdueGoals.data ?? []).map((r: { id: string }) => ({ kind: 'smart_goal_overdue', id: r.id })),
    ...(reminders1h.data ?? []).map((r: { id: string }) => ({ kind: 'meeting_reminder_1h', id: r.id })),
    ...(reminders15m.data ?? []).map((r: { id: string }) => ({ kind: 'meeting_reminder_15m', id: r.id })),
    ...(renewal30d.data ?? []).map((r: { id: string }) => ({ kind: 'renewal_reminder_30d', id: r.id })),
    ...(renewal7d.data ?? []).map((r: { id: string }) => ({ kind: 'renewal_reminder_7d', id: r.id })),
    ...(renewal1d.data ?? []).map((r: { id: string }) => ({ kind: 'renewal_reminder_1d', id: r.id })),
    ...(analysisOverdue.data ?? []).map((r: { id: string }) => ({ kind: 'manager_analysis_overdue', id: r.id })),
  ]

  for (const item of dispatched) {
    await dispatchByKindAndId(supabase, item.kind, item.id)
  }

  return jsonResponse({ ok: true, dispatched: dispatched.length })
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  try {
    if (req.method === 'POST' && url.pathname.endsWith('/tick')) return await handleTick(req)
    if (req.method === 'POST' && url.pathname.endsWith('/dispatch')) return await handleDispatch(req)
    return jsonResponse({ error: 'Rota não encontrada. Use /tick ou /dispatch.' }, 404)
  } catch (err) {
    console.error('[notifications] erro inesperado:', err)
    await logServerError('notifications', 'erro inesperado', err)
    return jsonResponse({ error: err instanceof Error ? err.message : 'Erro inesperado' }, 500)
  }
})
