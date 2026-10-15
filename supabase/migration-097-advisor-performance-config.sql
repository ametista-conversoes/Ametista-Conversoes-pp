-- Ametista Conversões — itens de menor prioridade do Security/Performance
-- Advisor (achados de higiene, não brechas), pedidos pelo usuário "para
-- finalizar" o checklist da Fase 51. Cada bloco é mecânico e de baixo
-- risco — nenhuma mudança de comportamento real, só config/índice/cache.

-- =========================================================
-- 1) function_search_path_mutable — 3 funções sem search_path fixo.
-- Nenhuma das 3 referencia objeto não-qualificado de nenhum schema
-- (business_hours_between só usa built-ins de pg_catalog, sempre
-- resolvido independente do search_path; meeting_recurrence_interval
-- não toca em schema nenhum; set_updated_at só usa NEW/now()) — por
-- isso search_path = '' é seguro e máximo em segurança (fecha
-- qualquer *search path hijacking* teórico).
-- =========================================================
alter function public.business_hours_between(timestamp with time zone, timestamp with time zone) set search_path = '';
alter function public.meeting_recurrence_interval(text) set search_path = '';
alter function public.set_updated_at() set search_path = '';

-- =========================================================
-- 2) auth_rls_initplan — 12 policies reavaliando auth.uid() por linha
-- em vez de 1x por query. Mesma condição lógica, só envolvida em
-- `(select auth.uid())` pra o Postgres cachear via InitPlan.
-- =========================================================
alter policy "Usuário lê o próprio perfil" on public.profiles
  using ((select auth.uid()) = id);
alter policy "Usuário atualiza o próprio perfil" on public.profiles
  using ((select auth.uid()) = id);

alter policy "cliente_cria_proprios_comments" on public.comments
  with check (
    (current_user_role() = 'cliente'::user_role)
    and (client_id = current_user_client_id())
    and (author_id = (select auth.uid()))
    and (entity_type = 'general'::text)
  );

alter policy "usuario_le_proprio_nav_last_seen" on public.nav_last_seen
  using ((select auth.uid()) = user_id);
alter policy "usuario_insere_proprio_nav_last_seen" on public.nav_last_seen
  with check ((select auth.uid()) = user_id);
alter policy "usuario_atualiza_proprio_nav_last_seen" on public.nav_last_seen
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "usuario_le_propria_conversa_cassie" on public.cassie_messages
  using (conversation_owner_id = (select auth.uid()));
alter policy "usuario_apaga_propria_conversa_cassie" on public.cassie_messages
  using (conversation_owner_id = (select auth.uid()));

alter policy "usuario_le_propria_conversa_persuasiva" on public.persuasive_copy_messages
  using (conversation_owner_id = (select auth.uid()));

alter policy "usuario_le_propria_subscription" on public.push_subscriptions
  using ((select auth.uid()) = user_id);
alter policy "usuario_insere_propria_subscription" on public.push_subscriptions
  with check ((select auth.uid()) = user_id);
alter policy "usuario_deleta_propria_subscription" on public.push_subscriptions
  using ((select auth.uid()) = user_id);

-- =========================================================
-- 3) unindexed_foreign_keys — 17 FKs sem índice de cobertura. Só
-- adiciona (nenhum DROP), zero risco de comportamento, só overhead de
-- escrita extra (aceitável nessas tabelas, nenhuma de alto volume de
-- INSERT).
-- =========================================================
create index if not exists activity_checklist_items_project_id_idx on public.activity_checklist_items(project_id);
create index if not exists activity_checklist_items_source_activity_template_id_idx on public.activity_checklist_items(source_activity_template_id);
create index if not exists catalog_entries_campaign_link_id_idx on public.catalog_entries(campaign_link_id);
create index if not exists catalog_entries_derivado_de_idx on public.catalog_entries(derivado_de);
create index if not exists client_90day_milestones_created_by_idx on public.client_90day_milestones(created_by);
create index if not exists client_optimization_log_created_by_idx on public.client_optimization_log(created_by);
create index if not exists client_tasks_project_id_idx on public.client_tasks(project_id);
create index if not exists clients_default_workflow_template_id_idx on public.clients(default_workflow_template_id);
create index if not exists comments_author_id_idx on public.comments(author_id);
create index if not exists digital_asset_connections_agency_provider_connection_id_idx on public.digital_asset_connections(agency_provider_connection_id);
create index if not exists digital_asset_connections_project_id_idx on public.digital_asset_connections(project_id);
create index if not exists manager_analyses_created_by_idx on public.manager_analyses(created_by);
create index if not exists manual_leads_created_by_idx on public.manual_leads(created_by);
create index if not exists persuasive_copy_messages_client_id_idx on public.persuasive_copy_messages(client_id);
create index if not exists persuasive_copy_messages_connection_id_idx on public.persuasive_copy_messages(connection_id);
create index if not exists project_campaign_links_connection_id_idx on public.project_campaign_links(connection_id);
create index if not exists projects_external_connection_id_idx on public.projects(external_connection_id);

-- =========================================================
-- Não corrigidos de propósito, decisão registrada (não é omissão):
--
-- extension_in_public (pg_net): extrelocatable = false no
-- pg_extension — Postgres recusa `ALTER EXTENSION ... SET SCHEMA`
-- pra extensão não-relocável (confirmado via query direta). As
-- funções de verdade (net.http_post/http_get/...) já moram no schema
-- `net`, isolado de `public` — só o REGISTRO da extensão aponta pra
-- `public`, sem exposição real nenhuma. Forçar a correção exigiria
-- DROP/CREATE EXTENSION, arriscando os triggers de produção que
-- dependem dela (notify_alert_created, notify_incident_created,
-- notify_manager_analysis_published) por um achado puramente
-- cosmético — risco não compensa o benefício.
--
-- unused_index (profiles_client_id_idx, clients_renewal_date_idx,
-- push_notification_log_entity_id_idx, error_logs_resolved_idx): não
-- removidos — "não usado" aqui provavelmente reflete o volume baixo
-- de dados da fase atual (o planner prefere seq scan em tabela
-- pequena), não que o índice seja inútil; todos cobrem colunas que
-- consultas reais (lembretes de renovação, notificações, trilha de
-- erro) usam ou vão usar quando o volume de clientes reais crescer.
--
-- rls_enabled_no_policy (agency_oauth_tokens, form_response_events,
-- oauth_tokens, push_notification_log, rate_limit_hits): correto por
-- desenho, não bug — RLS ligada sem nenhuma policy bloqueia
-- `anon`/`authenticated` por completo (fail-closed), só `service_role`
-- (que ignora RLS) acessa, que é exatamente o esperado pra tabela
-- interna só tocada por Edge Function.
--
-- auth_leaked_password_protection: não existe campo equivalente no
-- config.toml da CLI (confirmado tentando `supabase init` +
-- `config pull` e lendo o schema gerado) — só dá pra ativar clicando
-- no painel (Authentication → Policies), não automatizável daqui.
