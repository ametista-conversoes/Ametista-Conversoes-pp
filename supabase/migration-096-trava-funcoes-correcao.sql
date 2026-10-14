-- Ametista Conversões — correção da migration-095: o primeiro REVOKE
-- não bastou. Confirmado por teste ao vivo (de novo) que o bypass
-- continuava funcionando mesmo depois do deploy — investigando
-- `information_schema.role_routine_grants`, achei 2 caminhos de
-- permissão independentes nesta base, não só 1:
--   (1) o `GRANT EXECUTE ... TO PUBLIC` padrão do Postgres (toda
--       função nasce assim);
--   (2) um `GRANT ... TO anon, authenticated, service_role` À PARTE
--       (provavelmente via `ALTER DEFAULT PRIVILEGES`, configurado
--       pelo próprio Supabase no setup do projeto) — uma concessão
--       DIRETA pro papel `anon`, independente da (1).
-- A migration-095 só revogou de `anon` nas funções do Grupo B (sem
-- tocar em `public`) e só de `public, authenticated` no Grupo C (sem
-- tocar em `anon`) — por isso sobrou acesso pelo caminho que não foi
-- revogado em cada caso. Esta migration revoga dos 2 caminhos ao
-- mesmo tempo (`public` E `anon` sempre), pra fechar de vez.

-- =========================================================
-- Grupo B — revoga de public+anon, GARANTE authenticated de volta
-- (pra nenhum Portal real quebrar, mesmo que o acesso dele também só
-- existisse via PUBLIC).
-- =========================================================
revoke execute on function public.apply_client_workflow(uuid[], uuid) from public, anon;
revoke execute on function public.apply_workflow(uuid, uuid, text, jsonb) from public, anon;
revoke execute on function public.apply_workflow(uuid, uuid, text, jsonb, uuid[]) from public, anon;
revoke execute on function public.apply_workflow(uuid, uuid, text, jsonb, uuid[], text) from public, anon;
revoke execute on function public.archive_stale_completed_tasks() from public, anon;
revoke execute on function public.cancel_meeting(uuid, text) from public, anon;
revoke execute on function public.complete_meeting(uuid) from public, anon;
revoke execute on function public.enroll_client_meeting_recurrence(uuid) from public, anon;
revoke execute on function public.recompute_client_health_score(uuid) from public, anon;
revoke execute on function public.request_emergency_meeting(timestamptz, text) from public, anon;
revoke execute on function public.respond_to_approval(uuid, text, text) from public, anon;
revoke execute on function public.set_asset_form_purpose(uuid, text) from public, anon;
revoke execute on function public.set_client_meeting_recurrence_active(uuid, boolean) from public, anon;
revoke execute on function public.set_client_task_status(uuid, text) from public, anon;
revoke execute on function public.set_default_activity_template(uuid) from public, anon;
revoke execute on function public.set_form_purpose(uuid, text) from public, anon;
revoke execute on function public.set_form_response_status(uuid, text) from public, anon;
revoke execute on function public.set_manual_lead_status(uuid, text) from public, anon;
revoke execute on function public.trigger_emergency_pause(text, uuid[]) from public, anon;
revoke execute on function public.update_own_profile(text, text) from public, anon;
revoke execute on function public.update_own_profile(text, text, text) from public, anon;

grant execute on function public.apply_client_workflow(uuid[], uuid) to authenticated;
grant execute on function public.apply_workflow(uuid, uuid, text, jsonb) to authenticated;
grant execute on function public.apply_workflow(uuid, uuid, text, jsonb, uuid[]) to authenticated;
grant execute on function public.apply_workflow(uuid, uuid, text, jsonb, uuid[], text) to authenticated;
grant execute on function public.archive_stale_completed_tasks() to authenticated;
grant execute on function public.cancel_meeting(uuid, text) to authenticated;
grant execute on function public.complete_meeting(uuid) to authenticated;
grant execute on function public.enroll_client_meeting_recurrence(uuid) to authenticated;
grant execute on function public.recompute_client_health_score(uuid) to authenticated;
grant execute on function public.request_emergency_meeting(timestamptz, text) to authenticated;
grant execute on function public.respond_to_approval(uuid, text, text) to authenticated;
grant execute on function public.set_asset_form_purpose(uuid, text) to authenticated;
grant execute on function public.set_client_meeting_recurrence_active(uuid, boolean) to authenticated;
grant execute on function public.set_client_task_status(uuid, text) to authenticated;
grant execute on function public.set_default_activity_template(uuid) to authenticated;
grant execute on function public.set_form_purpose(uuid, text) to authenticated;
grant execute on function public.set_form_response_status(uuid, text) to authenticated;
grant execute on function public.set_manual_lead_status(uuid, text) to authenticated;
grant execute on function public.trigger_emergency_pause(text, uuid[]) to authenticated;
grant execute on function public.update_own_profile(text, text) to authenticated;
grant execute on function public.update_own_profile(text, text, text) to authenticated;

-- =========================================================
-- Grupo C — revoga TAMBÉM de `anon` especificamente (faltou na
-- migration-095). service_role já tinha sido concedido lá, não
-- precisa repetir.
-- =========================================================
revoke execute on function public.capture_executive_kpi_snapshot() from anon;
revoke execute on function public.check_campaign_state_changes() from anon;
revoke execute on function public.check_metric_alert_thresholds() from anon;
revoke execute on function public.generate_monthly_client_reports(date) from anon;
revoke execute on function public.remove_demo_data() from anon;
revoke execute on function public.auto_approve_overdue_approvals() from anon;
revoke execute on function public.recompute_all_client_health_scores() from anon;
revoke execute on function public.compute_at_risk_client_ids() from anon;
revoke execute on function public.detect_new_at_risk_clients() from anon;
revoke execute on function public.detect_new_manager_analysis_overdue() from anon;
revoke execute on function public.detect_new_meeting_reminders_15m() from anon;
revoke execute on function public.detect_new_meeting_reminders_1h() from anon;
revoke execute on function public.detect_new_overdue_goals() from anon;
revoke execute on function public.detect_new_renewal_reminders_1d() from anon;
revoke execute on function public.detect_new_renewal_reminders_30d() from anon;
revoke execute on function public.detect_new_renewal_reminders_7d() from anon;
revoke execute on function public.set_task_done(uuid, boolean) from anon;
revoke execute on function public.set_task_status(uuid, text) from anon;
revoke execute on function public.toggle_onboarding_step(uuid, boolean) from anon;
revoke execute on function public.check_rate_limit(uuid, text, integer, integer) from anon;
