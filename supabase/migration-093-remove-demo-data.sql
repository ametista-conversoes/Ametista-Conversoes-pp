-- Ametista Conversões — Fase 50.B: "Remover dados de demonstração".
-- Apaga TODO o dado gerado pelo seed de um cliente `is_demo` (tudo que
-- tem `client_id`, confirmado contra o schema real via information_schema
-- — 28 tabelas), mas NUNCA a linha do cliente em si (preserva a Loja
-- Aurora como identidade real reaproveitada, e deixa a Clínica Sorriso
-- demo como um "molde" vazio pronto pro próximo "Recriar") nem
-- `profiles` (preserva a conta de login do cliente demo, criada 1x só
-- na Fase 50.E — recriar o dado não deve recriar/duplicar o usuário).
--
-- `digital_assets` e `projects` são apagados primeiro de propósito:
-- o `on delete cascade` de `digital_asset_connections`/`project_campaign_links`/
-- `performance_snapshots`/etc (conferido via information_schema antes de
-- escrever esta função) já limpa boa parte sozinho; as demais tabelas
-- são deletadas direto por `client_id`, em qualquer ordem (são folhas).
create or replace function public.remove_demo_data()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  demo_ids uuid[];
begin
  if public.current_user_role() is not null and public.current_user_role() not in ('admin', 'gestor') then
    raise exception 'Não autorizado';
  end if;

  select array_agg(id) into demo_ids from public.clients where is_demo = true;
  if demo_ids is null then return; end if;

  delete from public.digital_assets where client_id = any(demo_ids);
  delete from public.projects where client_id = any(demo_ids);

  delete from public.activity_checklist_items where client_id = any(demo_ids);
  delete from public.alerts where client_id = any(demo_ids);
  delete from public.approvals where client_id = any(demo_ids);
  delete from public.audit_logs where client_id = any(demo_ids);
  delete from public.campaign_performance_snapshots where client_id = any(demo_ids);
  delete from public.cassie_messages where client_id = any(demo_ids);
  delete from public.catalog_entries where client_id = any(demo_ids);
  delete from public.client_90day_milestones where client_id = any(demo_ids);
  delete from public.client_health_score_snapshots where client_id = any(demo_ids);
  delete from public.client_meeting_recurrence where client_id = any(demo_ids);
  delete from public.client_monthly_reports where client_id = any(demo_ids);
  delete from public.client_optimization_log where client_id = any(demo_ids);
  delete from public.client_tasks where client_id = any(demo_ids);
  delete from public.comments where client_id = any(demo_ids);
  delete from public.file_items where client_id = any(demo_ids);
  delete from public.form_responses where client_id = any(demo_ids);
  delete from public.incidents where client_id = any(demo_ids);
  delete from public.manager_analyses where client_id = any(demo_ids);
  delete from public.manual_leads where client_id = any(demo_ids);
  delete from public.meetings where client_id = any(demo_ids);
  delete from public.metric_alert_thresholds where client_id = any(demo_ids);
  delete from public.onboarding_steps where client_id = any(demo_ids);
  delete from public.performance_snapshots where client_id = any(demo_ids);
  delete from public.persuasive_copy_messages where client_id = any(demo_ids);
  delete from public.smart_goals where client_id = any(demo_ids);
  delete from public.tasks where client_id = any(demo_ids);
end;
$$;

grant execute on function public.remove_demo_data() to authenticated;
