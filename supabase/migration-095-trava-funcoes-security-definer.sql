-- Ametista Conversões — auditoria de segurança (14/10/2026), achado
-- crítico: TODA função `security definer` deste projeto nasce com
-- EXECUTE concedido por padrão a PUBLIC (que inclui `anon` — qualquer
-- visitante NÃO logado, só com a chave pública `anon`). A proteção de
-- cada função sempre dependeu só da checagem interna
-- `current_user_role() not in (...)`, mas pra quem não tem sessão
-- nenhuma (`auth.uid()` = null), `current_user_role()` também é null
-- — e em SQL, `NULL NOT IN (...)` é NULL (nem verdadeiro nem falso), e
-- um `IF <NULL> THEN` do PL/pgSQL trata isso como FALSO: a exceção
-- NUNCA é lançada, e a função roda até o fim.
--
-- Confirmado ao vivo, sem login nenhum, só com a chave anon pública:
-- `complete_meeting` (exigia admin/gestor) e `set_client_meeting_recurrence_active`
-- (idem) foram chamadas com sucesso por um visitante anônimo (só não
-- causaram efeito visível porque os ids de teste eram inválidos de
-- propósito); `set_default_activity_template` retornou 204 (sucesso
-- real). Ou seja: qualquer pessoa na internet, sem conta nenhuma,
-- podia cancelar reunião de cliente real, aprovar/rejeitar aprovação,
-- mudar status de lead/tarefa, aplicar workflow, pausar campanha em
-- nome do cliente, etc. — só sabendo o nome da função e um id válido
-- (nem precisa ser válido pra algumas, como mostrado acima).
--
-- Correção: a defesa de verdade não pode ser a checagem interna (ela
-- não distingue "sem sessão" de "sem perfil") — tem que ser o GRANT.
-- `anon` nunca deveria poder executar nenhuma dessas funções; `role
-- is null` só deveria acontecer pra quem roda sem contexto de usuário
-- de propósito (pg_cron, que roda como `postgres` e nunca passa pelos
-- grants de anon/authenticated/public — confirmado em `cron.job`) ou
-- pra Edge Functions com a service_role key. Revoga de `anon` (e de
-- `authenticated` também, pros casos sem nenhum chamador legítimo do
-- Portal — conferido 1 a 1 contra todo `.rpc(...)` em src/ e
-- supabase/functions/ antes de escrever isto) e garante `grant` pra
-- `service_role` onde a Edge Function precisa.
--
-- Fora desta lista, de propósito: `current_user_role()`/
-- `current_user_client_id()`/`form_connection_belongs_to_client()`
-- (helpers só-leitura, usados dentro de policy de RLS — têm que
-- continuar públicos) e toda função `returns trigger` (handle_new_user,
-- handle_new_client_activity_template, check_activity_item_platform_match,
-- notify_*, log_*_event, log_*_delete_event, clear_*_log) — essas só
-- rodam disparadas por trigger de tabela, chamar via RPC direto já
-- falha sozinho (sem contexto de NEW/OLD), então o GRANT nelas é
-- irrelevante pra esse ataque.

-- =========================================================
-- Grupo B — chamadas de verdade pelo Portal (cliente/gestor/admin
-- logado, role Postgres "authenticated"): revoga só de `anon`,
-- authenticated continua podendo (cada uma já confere role +
-- dono dos dados por dentro).
-- =========================================================
revoke execute on function public.apply_client_workflow(uuid[], uuid) from anon;
revoke execute on function public.apply_workflow(uuid, uuid, text, jsonb) from anon;
revoke execute on function public.apply_workflow(uuid, uuid, text, jsonb, uuid[]) from anon;
revoke execute on function public.apply_workflow(uuid, uuid, text, jsonb, uuid[], text) from anon;
revoke execute on function public.archive_stale_completed_tasks() from anon;
revoke execute on function public.cancel_meeting(uuid, text) from anon;
revoke execute on function public.complete_meeting(uuid) from anon;
revoke execute on function public.enroll_client_meeting_recurrence(uuid) from anon;
revoke execute on function public.recompute_client_health_score(uuid) from anon;
revoke execute on function public.request_emergency_meeting(timestamptz, text) from anon;
revoke execute on function public.respond_to_approval(uuid, text, text) from anon;
revoke execute on function public.set_asset_form_purpose(uuid, text) from anon;
revoke execute on function public.set_client_meeting_recurrence_active(uuid, boolean) from anon;
revoke execute on function public.set_client_task_status(uuid, text) from anon;
revoke execute on function public.set_default_activity_template(uuid) from anon;
revoke execute on function public.set_form_purpose(uuid, text) from anon;
revoke execute on function public.set_form_response_status(uuid, text) from anon;
revoke execute on function public.set_manual_lead_status(uuid, text) from anon;
revoke execute on function public.trigger_emergency_pause(text, uuid[]) from anon;
revoke execute on function public.update_own_profile(text, text) from anon;
revoke execute on function public.update_own_profile(text, text, text) from anon;

-- =========================================================
-- Grupo C — sem NENHUM chamador legítimo pelo Portal (só cron ou Edge
-- Function via service_role): revoga de anon E authenticated, garante
-- service_role (cron roda como `postgres`, não precisa de grant).
-- =========================================================
revoke execute on function public.capture_executive_kpi_snapshot() from public, authenticated;
revoke execute on function public.check_campaign_state_changes() from public, authenticated;
revoke execute on function public.check_metric_alert_thresholds() from public, authenticated;
revoke execute on function public.generate_monthly_client_reports(date) from public, authenticated;
revoke execute on function public.remove_demo_data() from public, authenticated;
revoke execute on function public.auto_approve_overdue_approvals() from public, authenticated;
revoke execute on function public.recompute_all_client_health_scores() from public, authenticated;
revoke execute on function public.compute_at_risk_client_ids() from public, authenticated;
revoke execute on function public.detect_new_at_risk_clients() from public, authenticated;
revoke execute on function public.detect_new_manager_analysis_overdue() from public, authenticated;
revoke execute on function public.detect_new_meeting_reminders_15m() from public, authenticated;
revoke execute on function public.detect_new_meeting_reminders_1h() from public, authenticated;
revoke execute on function public.detect_new_overdue_goals() from public, authenticated;
revoke execute on function public.detect_new_renewal_reminders_1d() from public, authenticated;
revoke execute on function public.detect_new_renewal_reminders_30d() from public, authenticated;
revoke execute on function public.detect_new_renewal_reminders_7d() from public, authenticated;
-- set_task_done/set_task_status/toggle_onboarding_step: busca completa
-- em src/ e supabase/functions/ não achou NENHUM chamador — parecem
-- substituídas por set_client_task_status (que já cobre o mesmo caso
-- com checagem de dono). Trava por segurança; se algum dia precisar
-- delas de volta pelo Portal, é só mover pro Grupo B.
revoke execute on function public.set_task_done(uuid, boolean) from public, authenticated;
revoke execute on function public.set_task_status(uuid, text) from public, authenticated;
revoke execute on function public.toggle_onboarding_step(uuid, boolean) from public, authenticated;
-- check_rate_limit: só chamada via getServiceClient() (service_role)
-- em cassie/integrations — nunca pelo cliente anon/authenticated do
-- navegador. Sem essa trava, qualquer um podia incrementar o
-- contador de limite de QUALQUER usuário (p_user_id é parâmetro
-- livre), travando a Cassie/integração de outra pessoa de propósito.
revoke execute on function public.check_rate_limit(uuid, text, integer, integer) from public, authenticated;
-- encrypt_oauth_secret/decrypt_oauth_secret: sobra de uma tentativa
-- abandonada (comentário na migration-016) com pgsodium direto, antes
-- de trocar pro Supabase Vault (store_oauth_secret/read_oauth_secret,
-- que já tinham o revoke certo desde a Fase 6). Nunca foram
-- removidas do banco nem tinham migration própria. Hoje não há
-- nenhuma coluna bytea no schema (conferido via information_schema)
-- pra decrypt_oauth_secret decifrar, então não há segredo real
-- exposto agora — mas um oráculo de cripto com chave do servidor
-- acessível por qualquer anônimo não deveria existir de qualquer
-- jeito. Trava aqui; dropar de vez é decisão separada.
revoke execute on function public.encrypt_oauth_secret(text) from public, anon, authenticated;
revoke execute on function public.decrypt_oauth_secret(bytea) from public, anon, authenticated;

grant execute on function public.capture_executive_kpi_snapshot() to service_role;
grant execute on function public.check_campaign_state_changes() to service_role;
grant execute on function public.check_metric_alert_thresholds() to service_role;
grant execute on function public.generate_monthly_client_reports(date) to service_role;
grant execute on function public.remove_demo_data() to service_role;
grant execute on function public.auto_approve_overdue_approvals() to service_role;
grant execute on function public.recompute_all_client_health_scores() to service_role;
grant execute on function public.compute_at_risk_client_ids() to service_role;
grant execute on function public.detect_new_at_risk_clients() to service_role;
grant execute on function public.detect_new_manager_analysis_overdue() to service_role;
grant execute on function public.detect_new_meeting_reminders_15m() to service_role;
grant execute on function public.detect_new_meeting_reminders_1h() to service_role;
grant execute on function public.detect_new_overdue_goals() to service_role;
grant execute on function public.detect_new_renewal_reminders_1d() to service_role;
grant execute on function public.detect_new_renewal_reminders_30d() to service_role;
grant execute on function public.detect_new_renewal_reminders_7d() to service_role;
grant execute on function public.check_rate_limit(uuid, text, integer, integer) to service_role;
