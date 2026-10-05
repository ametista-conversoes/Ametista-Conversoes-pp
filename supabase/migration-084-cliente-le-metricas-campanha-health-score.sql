-- Fase 48 — revisão de RLS (hardening de segurança) achou 2 tabelas de
-- métrica POR CLIENTE sem nenhuma policy de select pro próprio cliente,
-- diferente da irmã `performance_snapshots` que já tinha
-- (`cliente_le_proprios_performance_snapshots`). Confirmado com o
-- usuário que é intencional o cliente ver essas duas (diferente da
-- 3ª tabela do mesmo achado, `executive_kpi_snapshots` — essa é
-- agregado da AGÊNCIA inteira, sem client_id, ficou de fora de
-- propósito).
create policy "cliente_le_proprias_campaign_performance_snapshots" on public.campaign_performance_snapshots for select
  using (public.current_user_role() = 'cliente' and client_id = public.current_user_client_id());

create policy "cliente_le_proprios_client_health_score_snapshots" on public.client_health_score_snapshots for select
  using (public.current_user_role() = 'cliente' and client_id = public.current_user_client_id());
