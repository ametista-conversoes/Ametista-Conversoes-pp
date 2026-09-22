-- Ametista Conversões — 2 achados ao vivo testando o alerta de mudança
-- de estado de campanha (item 16 do TESTES.md):
--
-- 1. Mesma campanha vinculada a 2 projetos diferentes gerava 2 alertas
--    idênticos pra uma única transição real (check_campaign_state_changes
--    percorre project_campaign_links, uma linha por vínculo — não por
--    campanha).
-- 2. Usuário pediu sincronização automática (não dá pra ficar clicando
--    "Sincronizar agora" pra sempre) — a infra já existia
--    (migration-019-fase64-cron.sql), mas nunca chegou a ser agendada de
--    verdade (`select * from cron.job` não mostrava o job
--    "sync-integrations").
--
-- Como usar: copie todo este arquivo e cole no SQL Editor do painel do
-- Supabase (SQL Editor > New query), depois clique em "Run". Seguro
-- rodar de novo. ANTES de rodar, troque o placeholder
-- '<COLE_AQUI_O_VALOR_DO_SEGREDO_CRON_SECRET>' pelo mesmo valor
-- configurado no segredo CRON_SECRET da Edge Function "integrations"
-- (Edge Functions > integrations > Secrets).

-- =========================================================
-- 1. Dedup do alerta de mudança de estado — 1 por campanha (connection_id
--    + external_campaign_id), não 1 por vínculo com projeto.
-- =========================================================
create or replace function public.check_campaign_state_changes()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  link record;
  latest record;
  v_title text;
  v_severity public.severity_level;
  already_alerted_state text[] := '{}';
  already_alerted_budget text[] := '{}';
  v_key text;
begin
  if public.current_user_role() is not null and public.current_user_role() not in ('admin', 'gestor') then
    raise exception 'Não autorizado';
  end if;

  for link in select * from public.project_campaign_links loop
    select cps.campaign_status, cps.budget_amount, cps.client_id
    into latest
    from public.campaign_performance_snapshots cps
    where cps.connection_id = link.connection_id
      and cps.external_campaign_id = link.external_campaign_id
    order by cps.snapshot_date desc
    limit 1;

    if not found then continue; end if;
    v_key := link.connection_id::text || '|' || link.external_campaign_id;

    -- Mudança de status — só alerta em transições de verdade (já
    -- tinha um status conhecido diferente do atual), não na 1ª leitura
    -- depois de vincular a campanha, e só 1 vez por campanha nesta
    -- rodada mesmo que ela esteja vinculada a mais de 1 projeto.
    if link.last_known_status is not null and latest.campaign_status is not null
       and link.last_known_status is distinct from latest.campaign_status
       and latest.campaign_status in ('PAUSED', 'REMOVED')
       and not (v_key = any(already_alerted_state)) then
      v_title := 'Campanha "' || coalesce(link.external_campaign_name, link.external_campaign_id) || '" mudou de estado';
      v_severity := case when latest.campaign_status = 'REMOVED' then 'high' else 'medium' end;
      insert into public.alerts (title, message, client_id, severity, category)
      values (
        v_title,
        'Status mudou de ' || link.last_known_status || ' para ' || latest.campaign_status || '.',
        latest.client_id,
        v_severity::public.severity_level,
        'campanha_mudou_estado'
      );
      already_alerted_state := array_append(already_alerted_state, v_key);
    end if;

    -- Orçamento mudou mais de 20% em relação ao último valor
    -- conhecido — mesmo dedup por campanha.
    if link.last_known_budget is not null and latest.budget_amount is not null and link.last_known_budget > 0
       and abs(latest.budget_amount - link.last_known_budget) / link.last_known_budget > 0.2
       and not (v_key = any(already_alerted_budget)) then
      insert into public.alerts (title, message, client_id, severity, category)
      values (
        'Orçamento da campanha "' || coalesce(link.external_campaign_name, link.external_campaign_id) || '" mudou bruscamente',
        'Orçamento foi de ' || round(link.last_known_budget, 2) || ' pra ' || round(latest.budget_amount, 2) || '.',
        latest.client_id,
        'medium'::public.severity_level,
        'campanha_mudou_estado'
      );
      already_alerted_budget := array_append(already_alerted_budget, v_key);
    end if;

    update public.project_campaign_links
    set last_known_status = coalesce(latest.campaign_status, last_known_status),
        last_known_budget = coalesce(latest.budget_amount, last_known_budget)
    where id = link.id;
  end loop;
end;
$$;

-- =========================================================
-- 2. Sincronização automática de verdade — a cada 1 hora (pedido do
--    usuário: "a cada hora ou 3 horas, o que for melhor"; 1 hora porque
--    são poucas conexões, sem risco real de limite de taxa da API, e
--    detecta mudança de estado/leads novos bem mais rápido). Substitui
--    o job de 6 em 6 horas que a migration-019 tinha deixado pronto mas
--    nunca chegou a agendar de verdade.
-- =========================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'sync-integrations',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://ktexhzcpqrqjdgzgxisx.supabase.co/functions/v1/integrations/sync-all',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', '<COLE_AQUI_O_VALOR_DO_SEGREDO_CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Pra conferir que o job ficou agendado certinho:
--   select * from cron.job where jobname = 'sync-integrations';
-- Pra ver as últimas execuções (sucesso/erro):
--   select * from cron.job_run_details where jobname = 'sync-integrations' order by start_time desc limit 10;
-- Pra cancelar o agendamento, se precisar:
--   select cron.unschedule('sync-integrations');
