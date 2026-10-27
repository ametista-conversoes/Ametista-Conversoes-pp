-- Ametista Conversões — Fase 59: registro semanal das etiquetas do WhatsApp.
--
-- Como usar: rode no SQL Editor do Supabase (ou `npx supabase db query
-- --linked -f`). Seguro rodar de novo.
--
-- O Kit de Atendimento manda contar, toda sexta, as conversas por etiqueta
-- (Novo, Qualificado, Agendado, Venda, Perdido — contrato 4.1-VI). O WhatsApp
-- Business não integra com nada, então o cliente digita só as contagens
-- (~1 min por semana) no Dashboard.
--
-- Decisões do usuário: quem registra é o cliente; "Vendas do mês" passa a
-- ser a soma das vendas das semanas (um número só pra digitar). Mês sem
-- registro semanal continua com o valor digitado no card do mês.
--
-- 1. Tabela `client_weekly_labels` (uma linha por cliente/semana; a semana
--    começa na segunda) + RLS igual à de `client_monthly_sales`.
-- 2. Gatilho: salvar/apagar uma semana recalcula `client_monthly_sales` do
--    mês dela. A semana conta no mês da sua sexta (dia da contagem). O
--    gatilho da migration-106 recalcula metas e relatório em seguida.
-- 3. `remove_demo_data` também apaga as etiquetas semanais.

-- ---------------------------------------------------------------- 1. tabela
create table if not exists public.client_weekly_labels (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  novo integer not null default 0 check (novo >= 0),
  qualificado integer not null default 0 check (qualificado >= 0),
  agendado integer not null default 0 check (agendado >= 0),
  venda integer not null default 0 check (venda >= 0),
  perdido integer not null default 0 check (perdido >= 0),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, week_start)
);

alter table public.client_weekly_labels enable row level security;

drop policy if exists "leitura_client_weekly_labels" on public.client_weekly_labels;
create policy "leitura_client_weekly_labels" on public.client_weekly_labels for select
  using (
    public.current_user_role() in ('admin', 'gestor')
    or (public.current_user_role() = 'cliente' and client_id = public.current_user_client_id())
  );

drop policy if exists "insercao_client_weekly_labels" on public.client_weekly_labels;
create policy "insercao_client_weekly_labels" on public.client_weekly_labels for insert
  with check (
    public.current_user_role() in ('admin', 'gestor')
    or (public.current_user_role() = 'cliente' and client_id = public.current_user_client_id())
  );

drop policy if exists "atualizacao_client_weekly_labels" on public.client_weekly_labels;
create policy "atualizacao_client_weekly_labels" on public.client_weekly_labels for update
  using (
    public.current_user_role() in ('admin', 'gestor')
    or (public.current_user_role() = 'cliente' and client_id = public.current_user_client_id())
  )
  with check (
    public.current_user_role() in ('admin', 'gestor')
    or (public.current_user_role() = 'cliente' and client_id = public.current_user_client_id())
  );

drop policy if exists "admin_gestor_apaga_client_weekly_labels" on public.client_weekly_labels;
create policy "admin_gestor_apaga_client_weekly_labels" on public.client_weekly_labels for delete
  using (public.current_user_role() in ('admin', 'gestor'));

drop trigger if exists set_updated_at on public.client_weekly_labels;
create trigger set_updated_at before update on public.client_weekly_labels
  for each row execute procedure public.set_updated_at();

-- ------------------------------------- 2. vendas do mês = soma das semanas
create or replace function public.sync_monthly_sales_from_weeks(p_client_id uuid, p_month date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
begin
  select sum(venda) into v_total
  from public.client_weekly_labels
  where client_id = p_client_id
    and date_trunc('month', week_start + 4)::date = p_month;

  -- Sem nenhuma semana no mês: mantém o que foi digitado no card do mês.
  if v_total is null then return; end if;

  insert into public.client_monthly_sales (client_id, month, sales)
  values (p_client_id, p_month, v_total)
  on conflict (client_id, month) do update
    set sales = excluded.sales
    where public.client_monthly_sales.sales is distinct from excluded.sales;
end;
$$;

revoke execute on function public.sync_monthly_sales_from_weeks(uuid, date) from public, anon, authenticated;

create or replace function public.on_client_weekly_labels_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.sync_monthly_sales_from_weeks(old.client_id, date_trunc('month', old.week_start + 4)::date);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.sync_monthly_sales_from_weeks(new.client_id, date_trunc('month', new.week_start + 4)::date);
  end if;
  return null;
end;
$$;

revoke execute on function public.on_client_weekly_labels_change() from public, anon, authenticated;

drop trigger if exists trg_client_weekly_labels_change on public.client_weekly_labels;
create trigger trg_client_weekly_labels_change
  after insert or update or delete on public.client_weekly_labels
  for each row execute procedure public.on_client_weekly_labels_change();

-- ------------------------------------------- 3. dados demo também limpam
CREATE OR REPLACE FUNCTION public.remove_demo_data()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- Etiquetas antes das vendas: apagar semanas resincroniza o mês.
  delete from public.client_weekly_labels where client_id = any(demo_ids);
  delete from public.client_monthly_sales where client_id = any(demo_ids);
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
$function$;
