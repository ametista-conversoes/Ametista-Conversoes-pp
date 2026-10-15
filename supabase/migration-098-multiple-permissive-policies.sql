-- Ametista Conversões — multiple_permissive_policies (240 achados do Advisor,
-- 30 tabelas). Puramente estrutural: toda policy aqui já é {public}, então
-- qualquer sobreposição de ação conta como "múltiplas policies permissivas"
-- pro Postgres reavaliar, mesmo quando as condições de negócio não mudam o
-- resultado final. Correção: substituir os pares/trios que se sobrepõem por
-- UMA policy por ação (SELECT/INSERT/UPDATE/DELETE), com a condição original
-- unida por OR — mesmo resultado de autorização, sem sobreposição. Gerado a
-- partir do dump real de pg_policies (scratch-sql/mpp-policies-clean.json),
-- não digitado à mão — nenhuma condição foi reescrita, só reorganizada.
-- Tudo numa transação só: se qualquer DROP/CREATE falhar no meio, nenhuma
-- tabela fica com policy faltando — ou aplica tudo, ou nada.

begin;

-- =========================================================
-- Grupo A — 2 policies SELECT-only (sem FOR ALL), merge direto
-- ========================================================= 
drop policy "admin_gestor_le_campaign_performance_snapshots" on public.campaign_performance_snapshots;
drop policy "cliente_le_proprias_campaign_performance_snapshots" on public.campaign_performance_snapshots;
create policy "leitura_campaign_performance_snapshots" on public.campaign_performance_snapshots for select
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])) or ((current_user_role() = 'cliente'::user_role) AND (client_id = current_user_client_id())));

drop policy "admin_gestor_read_client_health_score_snapshots" on public.client_health_score_snapshots;
drop policy "cliente_le_proprios_client_health_score_snapshots" on public.client_health_score_snapshots;
create policy "leitura_client_health_score_snapshots" on public.client_health_score_snapshots for select
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])) or ((current_user_role() = 'cliente'::user_role) AND (client_id = current_user_client_id())));

drop policy "admin_gestor_read_monthly_reports" on public.client_monthly_reports;
drop policy "client_read_own_monthly_reports" on public.client_monthly_reports;
create policy "leitura_client_monthly_reports" on public.client_monthly_reports for select
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])) or ((current_user_role() = 'cliente'::user_role) AND (client_id = current_user_client_id())));

drop policy "admin_gestor_le_form_answers" on public.form_answers;
drop policy "cliente_le_form_answers_proprias" on public.form_answers;
create policy "leitura_form_answers" on public.form_answers for select
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])) or ((current_user_role() = 'cliente'::user_role) AND (EXISTS ( SELECT 1
   FROM form_responses fr
  WHERE ((fr.id = form_answers.response_id) AND (fr.client_id = current_user_client_id()))))));

drop policy "admin_gestor_le_form_questions" on public.form_questions;
drop policy "cliente_le_form_questions_proprias" on public.form_questions;
create policy "leitura_form_questions" on public.form_questions for select
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])) or ((current_user_role() = 'cliente'::user_role) AND form_connection_belongs_to_client(connection_id, current_user_client_id())));

drop policy "admin_gestor_le_form_responses" on public.form_responses;
drop policy "cliente_le_proprias_form_responses" on public.form_responses;
create policy "leitura_form_responses" on public.form_responses for select
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])) or ((current_user_role() = 'cliente'::user_role) AND (client_id = current_user_client_id())));

-- ========================================================= 
-- Grupo F — admin FOR ALL + gestor SELECT (só overlap em SELECT)
-- ========================================================= 
drop policy "admin_full_activity_templates" on public.activity_templates;
drop policy "gestor_le_activity_templates" on public.activity_templates;
create policy "admin_gestor_le_activity_templates" on public.activity_templates for select
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));
create policy "admin_insere_activity_templates" on public.activity_templates for insert
  with check ((current_user_role() = 'admin'::user_role));
create policy "admin_atualiza_activity_templates" on public.activity_templates for update
  using ((current_user_role() = 'admin'::user_role))
  with check ((current_user_role() = 'admin'::user_role));
create policy "admin_apaga_activity_templates" on public.activity_templates for delete
  using ((current_user_role() = 'admin'::user_role));

drop policy "admin_full_client_workflow_templates" on public.client_workflow_templates;
drop policy "gestor_le_client_workflow_templates" on public.client_workflow_templates;
create policy "admin_gestor_le_client_workflow_templates" on public.client_workflow_templates for select
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));
create policy "admin_insere_client_workflow_templates" on public.client_workflow_templates for insert
  with check ((current_user_role() = 'admin'::user_role));
create policy "admin_atualiza_client_workflow_templates" on public.client_workflow_templates for update
  using ((current_user_role() = 'admin'::user_role))
  with check ((current_user_role() = 'admin'::user_role));
create policy "admin_apaga_client_workflow_templates" on public.client_workflow_templates for delete
  using ((current_user_role() = 'admin'::user_role));

drop policy "admin_full_organizations" on public.organizations;
drop policy "gestor_le_organizations" on public.organizations;
create policy "admin_gestor_le_organizations" on public.organizations for select
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));
create policy "admin_insere_organizations" on public.organizations for insert
  with check ((current_user_role() = 'admin'::user_role));
create policy "admin_atualiza_organizations" on public.organizations for update
  using ((current_user_role() = 'admin'::user_role))
  with check ((current_user_role() = 'admin'::user_role));
create policy "admin_apaga_organizations" on public.organizations for delete
  using ((current_user_role() = 'admin'::user_role));

drop policy "admin_full_workflow_templates" on public.workflow_templates;
drop policy "gestor_le_workflow_templates" on public.workflow_templates;
create policy "admin_gestor_le_workflow_templates" on public.workflow_templates for select
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));
create policy "admin_insere_workflow_templates" on public.workflow_templates for insert
  with check ((current_user_role() = 'admin'::user_role));
create policy "admin_atualiza_workflow_templates" on public.workflow_templates for update
  using ((current_user_role() = 'admin'::user_role))
  with check ((current_user_role() = 'admin'::user_role));
create policy "admin_apaga_workflow_templates" on public.workflow_templates for delete
  using ((current_user_role() = 'admin'::user_role));

-- ========================================================= 
-- Grupo B — admin/gestor FOR ALL + cliente SELECT-only
-- ========================================================= 
drop policy "admin_gestor_full_alerts" on public.alerts;
drop policy "cliente_le_proprios_alerts" on public.alerts;
create policy "leitura_alerts" on public.alerts for select
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])) or ((current_user_role() = 'cliente'::user_role) AND (client_id = current_user_client_id())));
create policy "admin_gestor_insere_alerts" on public.alerts for insert
  with check ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));
create policy "admin_gestor_atualiza_alerts" on public.alerts for update
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])))
  with check ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));
create policy "admin_gestor_apaga_alerts" on public.alerts for delete
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));

drop policy "admin_gestor_full_approvals" on public.approvals;
drop policy "cliente_le_proprios_approvals" on public.approvals;
create policy "leitura_approvals" on public.approvals for select
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])) or ((current_user_role() = 'cliente'::user_role) AND (client_id = current_user_client_id())));
create policy "admin_gestor_insere_approvals" on public.approvals for insert
  with check ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));
create policy "admin_gestor_atualiza_approvals" on public.approvals for update
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])))
  with check ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));
create policy "admin_gestor_apaga_approvals" on public.approvals for delete
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));

drop policy "admin_gestor_full_audit_logs" on public.audit_logs;
drop policy "cliente_le_proprios_audit_logs" on public.audit_logs;
create policy "leitura_audit_logs" on public.audit_logs for select
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])) or ((current_user_role() = 'cliente'::user_role) AND (client_id = current_user_client_id())));
create policy "admin_gestor_insere_audit_logs" on public.audit_logs for insert
  with check ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));
create policy "admin_gestor_atualiza_audit_logs" on public.audit_logs for update
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])))
  with check ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));
create policy "admin_gestor_apaga_audit_logs" on public.audit_logs for delete
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));

drop policy "admin_gestor_full_milestones_90dias" on public.client_90day_milestones;
drop policy "cliente_le_proprios_milestones_90dias" on public.client_90day_milestones;
create policy "leitura_client_90day_milestones" on public.client_90day_milestones for select
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])) or ((current_user_role() = 'cliente'::user_role) AND (client_id = current_user_client_id())));
create policy "admin_gestor_insere_client_90day_milestones" on public.client_90day_milestones for insert
  with check ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));
create policy "admin_gestor_atualiza_client_90day_milestones" on public.client_90day_milestones for update
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])))
  with check ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));
create policy "admin_gestor_apaga_client_90day_milestones" on public.client_90day_milestones for delete
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));

drop policy "admin_gestor_full_digital_assets" on public.digital_assets;
drop policy "cliente_le_proprios_digital_assets" on public.digital_assets;
create policy "leitura_digital_assets" on public.digital_assets for select
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])) or ((current_user_role() = 'cliente'::user_role) AND (client_id = current_user_client_id())));
create policy "admin_gestor_insere_digital_assets" on public.digital_assets for insert
  with check ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));
create policy "admin_gestor_atualiza_digital_assets" on public.digital_assets for update
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])))
  with check ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));
create policy "admin_gestor_apaga_digital_assets" on public.digital_assets for delete
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));

drop policy "admin_gestor_full_incidents" on public.incidents;
drop policy "cliente_le_proprios_incidents" on public.incidents;
create policy "leitura_incidents" on public.incidents for select
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])) or ((current_user_role() = 'cliente'::user_role) AND (client_id = current_user_client_id())));
create policy "admin_gestor_insere_incidents" on public.incidents for insert
  with check ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));
create policy "admin_gestor_atualiza_incidents" on public.incidents for update
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])))
  with check ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));
create policy "admin_gestor_apaga_incidents" on public.incidents for delete
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));

drop policy "admin_gestor_full_manager_analyses" on public.manager_analyses;
drop policy "cliente_le_analises_publicadas" on public.manager_analyses;
create policy "leitura_manager_analyses" on public.manager_analyses for select
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])) or ((current_user_role() = 'cliente'::user_role) AND (client_id = current_user_client_id()) AND (status = 'publicada'::text)));
create policy "admin_gestor_insere_manager_analyses" on public.manager_analyses for insert
  with check ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));
create policy "admin_gestor_atualiza_manager_analyses" on public.manager_analyses for update
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])))
  with check ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));
create policy "admin_gestor_apaga_manager_analyses" on public.manager_analyses for delete
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));

drop policy "admin_gestor_full_availability_blocks" on public.manager_availability_blocks;
drop policy "cliente_le_availability_blocks" on public.manager_availability_blocks;
create policy "leitura_manager_availability_blocks" on public.manager_availability_blocks for select
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])) or (current_user_role() = 'cliente'::user_role));
create policy "admin_gestor_insere_manager_availability_blocks" on public.manager_availability_blocks for insert
  with check ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));
create policy "admin_gestor_atualiza_manager_availability_blocks" on public.manager_availability_blocks for update
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])))
  with check ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));
create policy "admin_gestor_apaga_manager_availability_blocks" on public.manager_availability_blocks for delete
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));

drop policy "admin_gestor_full_onboarding_steps" on public.onboarding_steps;
drop policy "cliente_le_proprios_onboarding_steps" on public.onboarding_steps;
create policy "leitura_onboarding_steps" on public.onboarding_steps for select
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])) or ((current_user_role() = 'cliente'::user_role) AND (client_id = current_user_client_id())));
create policy "admin_gestor_insere_onboarding_steps" on public.onboarding_steps for insert
  with check ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));
create policy "admin_gestor_atualiza_onboarding_steps" on public.onboarding_steps for update
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])))
  with check ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));
create policy "admin_gestor_apaga_onboarding_steps" on public.onboarding_steps for delete
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));

drop policy "admin_gestor_full_performance_snapshots" on public.performance_snapshots;
drop policy "cliente_le_proprios_performance_snapshots" on public.performance_snapshots;
create policy "leitura_performance_snapshots" on public.performance_snapshots for select
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])) or ((current_user_role() = 'cliente'::user_role) AND (client_id = current_user_client_id())));
create policy "admin_gestor_insere_performance_snapshots" on public.performance_snapshots for insert
  with check ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));
create policy "admin_gestor_atualiza_performance_snapshots" on public.performance_snapshots for update
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])))
  with check ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));
create policy "admin_gestor_apaga_performance_snapshots" on public.performance_snapshots for delete
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));

drop policy "admin_gestor_full_project_campaign_links" on public.project_campaign_links;
drop policy "cliente_le_proprios_project_campaign_links" on public.project_campaign_links;
create policy "leitura_project_campaign_links" on public.project_campaign_links for select
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])) or ((current_user_role() = 'cliente'::user_role) AND (EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_campaign_links.project_id) AND (p.client_id = current_user_client_id()))))));
create policy "admin_gestor_insere_project_campaign_links" on public.project_campaign_links for insert
  with check ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));
create policy "admin_gestor_atualiza_project_campaign_links" on public.project_campaign_links for update
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])))
  with check ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));
create policy "admin_gestor_apaga_project_campaign_links" on public.project_campaign_links for delete
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));

drop policy "admin_gestor_full_projects" on public.projects;
drop policy "cliente_le_proprios_projects" on public.projects;
create policy "leitura_projects" on public.projects for select
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])) or ((current_user_role() = 'cliente'::user_role) AND (client_id = current_user_client_id())));
create policy "admin_gestor_insere_projects" on public.projects for insert
  with check ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));
create policy "admin_gestor_atualiza_projects" on public.projects for update
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])))
  with check ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));
create policy "admin_gestor_apaga_projects" on public.projects for delete
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));

drop policy "admin_gestor_full_smart_goals" on public.smart_goals;
drop policy "cliente_le_proprias_smart_goals" on public.smart_goals;
create policy "leitura_smart_goals" on public.smart_goals for select
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])) or ((current_user_role() = 'cliente'::user_role) AND (client_id = current_user_client_id())));
create policy "admin_gestor_insere_smart_goals" on public.smart_goals for insert
  with check ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));
create policy "admin_gestor_atualiza_smart_goals" on public.smart_goals for update
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])))
  with check ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));
create policy "admin_gestor_apaga_smart_goals" on public.smart_goals for delete
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));

-- ========================================================= 
-- Grupo E — clients (shape própria, só overlap em SELECT)
-- ========================================================= 
drop policy "admin_gestor_select_clients" on public.clients;
drop policy "cliente_le_proprio_registro" on public.clients;
create policy "leitura_clients" on public.clients for select
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])) or ((current_user_role() = 'cliente'::user_role) AND (id = current_user_client_id())));
-- admin_delete_clients, admin_gestor_insert_clients, admin_gestor_update_clients: sem overlap, intocadas

-- ========================================================= 
-- Grupo C — FOR ALL + cliente SELECT + cliente INSERT (2 overlaps)
-- ========================================================= 
drop policy "admin_gestor_full_comments" on public.comments;
drop policy "cliente_le_proprios_comments" on public.comments;
drop policy "cliente_cria_proprios_comments" on public.comments;
create policy "leitura_comments" on public.comments for select
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])) or ((current_user_role() = 'cliente'::user_role) AND (client_id = current_user_client_id())));
create policy "insercao_comments" on public.comments for insert
  with check ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])) or ((current_user_role() = 'cliente'::user_role) AND (client_id = current_user_client_id()) AND (author_id = ( SELECT auth.uid() AS uid)) AND (entity_type = 'general'::text)));
create policy "admin_gestor_atualiza_comments" on public.comments for update
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])))
  with check ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));
create policy "admin_gestor_apaga_comments" on public.comments for delete
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));

drop policy "admin_gestor_full_manual_leads" on public.manual_leads;
drop policy "cliente_le_proprios_manual_leads" on public.manual_leads;
drop policy "cliente_cria_proprios_manual_leads" on public.manual_leads;
create policy "leitura_manual_leads" on public.manual_leads for select
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])) or ((current_user_role() = 'cliente'::user_role) AND (client_id = current_user_client_id())));
create policy "insercao_manual_leads" on public.manual_leads for insert
  with check ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])) or ((current_user_role() = 'cliente'::user_role) AND (client_id = current_user_client_id())));
create policy "admin_gestor_atualiza_manual_leads" on public.manual_leads for update
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])))
  with check ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));
create policy "admin_gestor_apaga_manual_leads" on public.manual_leads for delete
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));

-- ========================================================= 
-- Grupo D — FOR ALL + cliente SELECT + INSERT + DELETE (3 overlaps)
-- ========================================================= 
drop policy "admin_gestor_full_client_tasks" on public.client_tasks;
drop policy "cliente_le_proprias_client_tasks" on public.client_tasks;
drop policy "cliente_cria_proprias_client_tasks" on public.client_tasks;
drop policy "cliente_apaga_proprias_client_tasks" on public.client_tasks;
create policy "leitura_client_tasks" on public.client_tasks for select
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])) or ((current_user_role() = 'cliente'::user_role) AND (client_id = current_user_client_id())));
create policy "insercao_client_tasks" on public.client_tasks for insert
  with check ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])) or ((current_user_role() = 'cliente'::user_role) AND (client_id = current_user_client_id())));
create policy "admin_gestor_atualiza_client_tasks" on public.client_tasks for update
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])))
  with check ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));
create policy "delecao_client_tasks" on public.client_tasks for delete
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])) or ((current_user_role() = 'cliente'::user_role) AND (client_id = current_user_client_id())));

drop policy "admin_gestor_full_file_items" on public.file_items;
drop policy "cliente_le_proprios_file_items" on public.file_items;
drop policy "cliente_cria_proprios_file_items" on public.file_items;
drop policy "cliente_apaga_proprios_file_items" on public.file_items;
create policy "leitura_file_items" on public.file_items for select
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])) or ((current_user_role() = 'cliente'::user_role) AND (client_id = current_user_client_id())));
create policy "insercao_file_items" on public.file_items for insert
  with check ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])) or ((current_user_role() = 'cliente'::user_role) AND (client_id = current_user_client_id())));
create policy "admin_gestor_atualiza_file_items" on public.file_items for update
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])))
  with check ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));
create policy "delecao_file_items" on public.file_items for delete
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])) or ((current_user_role() = 'cliente'::user_role) AND (client_id = current_user_client_id())));

drop policy "admin_gestor_full_meetings" on public.meetings;
drop policy "cliente_le_proprias_meetings" on public.meetings;
drop policy "cliente_cria_proprias_meetings" on public.meetings;
drop policy "cliente_apaga_propria_reuniao_cancelada" on public.meetings;
create policy "leitura_meetings" on public.meetings for select
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])) or ((current_user_role() = 'cliente'::user_role) AND (client_id = current_user_client_id())));
create policy "insercao_meetings" on public.meetings for insert
  with check ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])) or ((current_user_role() = 'cliente'::user_role) AND (client_id = current_user_client_id())));
create policy "admin_gestor_atualiza_meetings" on public.meetings for update
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])))
  with check ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));
create policy "delecao_meetings" on public.meetings for delete
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])) or ((current_user_role() = 'cliente'::user_role) AND (client_id = current_user_client_id()) AND (status = 'cancelled'::meeting_status) AND (cancelled_by_role = ANY (ARRAY['gestor'::user_role, 'admin'::user_role]))));

drop policy "admin_gestor_full_tasks" on public.tasks;
drop policy "cliente_le_proprias_tasks" on public.tasks;
drop policy "cliente_cria_proprias_tasks" on public.tasks;
drop policy "cliente_apaga_proprias_tasks" on public.tasks;
create policy "leitura_tasks" on public.tasks for select
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])) or ((current_user_role() = 'cliente'::user_role) AND (client_id = current_user_client_id())));
create policy "insercao_tasks" on public.tasks for insert
  with check ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])) or ((current_user_role() = 'cliente'::user_role) AND (client_id = current_user_client_id())));
create policy "admin_gestor_atualiza_tasks" on public.tasks for update
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])))
  with check ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])));
create policy "delecao_tasks" on public.tasks for delete
  using ((current_user_role() = ANY (ARRAY['admin'::user_role, 'gestor'::user_role])) or ((current_user_role() = 'cliente'::user_role) AND (client_id = current_user_client_id())));

commit;
