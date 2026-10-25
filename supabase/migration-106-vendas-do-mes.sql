-- Ametista Conversões — Fase 58: "Vendas do mês" informadas pelo cliente.
--
-- Como usar: rode no SQL Editor do Supabase (ou `npx supabase db query
-- --linked -f`). Seguro rodar de novo.
--
-- Decisões do usuário: o cliente digita quantas vendas fez no mês (pode
-- corrigir); faturamento = vendas × ticket médio da ficha; vale pro app
-- inteiro no lugar da estimativa (conversões ÷ leads p/ fechar × ticket);
-- sem vendas informadas, faturamento e ROAS ficam vazios ("—").
--
-- 1. Tabela `client_monthly_sales` (uma linha por cliente/mês) + RLS: o
--    cliente lê e grava só as próprias vendas; admin/gestor, todas.
-- 2. `refresh_smart_goals_internal` (sem checagem de papel, só pra uso
--    interno) + `refresh_smart_goals_from_ads` (chamada pelo Portal, com
--    checagem). Vendas = vendas informadas do mês corrente; Faturamento =
--    vendas × ticket; ROAS = faturamento ÷ investimento do mês.
-- 3. Gatilho: salvar as vendas recalcula na hora as metas do cliente e o
--    relatório mensal daquele mês (se já existir).
-- 4. `generate_monthly_client_reports` usa as vendas informadas (vendas,
--    faturamento, ROAS e taxa lead→venda ficam nulos sem elas).

-- ---------------------------------------------------------------- 1. tabela
create table if not exists public.client_monthly_sales (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  month date not null check (month = date_trunc('month', month)::date),
  sales integer not null check (sales >= 0),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, month)
);

alter table public.client_monthly_sales enable row level security;

drop policy if exists "leitura_client_monthly_sales" on public.client_monthly_sales;
create policy "leitura_client_monthly_sales" on public.client_monthly_sales for select
  using (
    public.current_user_role() in ('admin', 'gestor')
    or (public.current_user_role() = 'cliente' and client_id = public.current_user_client_id())
  );

drop policy if exists "insercao_client_monthly_sales" on public.client_monthly_sales;
create policy "insercao_client_monthly_sales" on public.client_monthly_sales for insert
  with check (
    public.current_user_role() in ('admin', 'gestor')
    or (public.current_user_role() = 'cliente' and client_id = public.current_user_client_id())
  );

drop policy if exists "atualizacao_client_monthly_sales" on public.client_monthly_sales;
create policy "atualizacao_client_monthly_sales" on public.client_monthly_sales for update
  using (
    public.current_user_role() in ('admin', 'gestor')
    or (public.current_user_role() = 'cliente' and client_id = public.current_user_client_id())
  )
  with check (
    public.current_user_role() in ('admin', 'gestor')
    or (public.current_user_role() = 'cliente' and client_id = public.current_user_client_id())
  );

drop policy if exists "admin_gestor_apaga_client_monthly_sales" on public.client_monthly_sales;
create policy "admin_gestor_apaga_client_monthly_sales" on public.client_monthly_sales for delete
  using (public.current_user_role() in ('admin', 'gestor'));

drop trigger if exists set_updated_at on public.client_monthly_sales;
create trigger set_updated_at before update on public.client_monthly_sales
  for each row execute procedure public.set_updated_at();

-- ------------------------------------------------------- 2. metas automáticas
create or replace function public.refresh_smart_goals_internal(p_client_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month_start date := date_trunc('month', now() at time zone 'America/Sao_Paulo')::date;
  v_updated integer;
begin
  with links as (
    select distinct p.client_id, l.connection_id, l.external_campaign_id
    from public.project_campaign_links l
    join public.projects p on p.id = l.project_id
    where p_client_id is null or p.client_id = p_client_id
  ),
  ads as (
    select c.client_id,
           coalesce(sum(s.spend), 0)::numeric as spend,
           coalesce(sum(s.clicks), 0)::numeric as clicks,
           coalesce(sum(s.impressions), 0)::numeric as impressions,
           coalesce(sum(s.conversions), 0)::numeric as conversions
    from (select distinct client_id from links) c
    left join links k on k.client_id = c.client_id
    left join public.campaign_performance_snapshots s
      on s.connection_id = k.connection_id
     and s.external_campaign_id = k.external_campaign_id
     and s.snapshot_date >= v_month_start
    group by c.client_id
  ),
  leads as (
    select x.client_id,
           count(*) filter (where x.status in ('qualificado', 'venda'))::numeric as qualificados
    from (
      select client_id, status, coalesce(submitted_at, created_at) as at from public.form_responses
      union all
      select client_id, status, created_at from public.manual_leads
    ) x
    where (x.at at time zone 'America/Sao_Paulo')::date >= v_month_start
      and (p_client_id is null or x.client_id = p_client_id)
    group by x.client_id
  ),
  computed as (
    select g.id,
      case g.metric_type
        when 'leads_qualificados' then coalesce(ld.qualificados, 0)
        when 'vendas' then ms.sales::numeric
        when 'faturamento' then round(ms.sales * cl.average_ticket, 2)
        when 'roas' then round(ms.sales * cl.average_ticket / nullif(a.spend, 0), 2)
        when 'orcamento' then round(a.spend, 2)
        when 'impressoes' then a.impressions
        when 'cliques' then a.clicks
        when 'leads' then a.conversions
        when 'conversoes' then a.conversions
        when 'cpa' then round(a.spend / nullif(a.conversions, 0), 2)
        when 'cpc' then round(a.spend / nullif(a.clicks, 0), 2)
        when 'ctr' then round(a.clicks / nullif(a.impressions, 0) * 100, 2)
        when 'cpm' then round(a.spend / nullif(a.impressions, 0) * 1000, 2)
        when 'taxa_conversao' then round(a.conversions / nullif(a.clicks, 0) * 100, 2)
      end as value
    from public.smart_goals g
    join public.clients cl on cl.id = g.client_id
    left join ads a on a.client_id = g.client_id
    left join leads ld on ld.client_id = g.client_id
    left join public.client_monthly_sales ms on ms.client_id = g.client_id and ms.month = v_month_start
    where g.status <> 'completed'
      and (p_client_id is null or g.client_id = p_client_id)
      and (
        g.metric_type in ('leads_qualificados', 'vendas', 'faturamento')
        -- ROAS e métricas de anúncio só pra quem tem campanha vinculada: sem
        -- vínculo, "0" seria falso — fica o valor que estiver.
        or (a.client_id is not null and g.metric_type in (
          'orcamento', 'impressoes', 'cliques', 'leads', 'conversoes', 'cpa', 'cpc',
          'ctr', 'cpm', 'taxa_conversao', 'roas'))
      )
  )
  update public.smart_goals g
     set current_value = c.value
    from computed c
   where g.id = c.id
     and g.current_value is distinct from c.value;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke execute on function public.refresh_smart_goals_internal(uuid) from public, anon, authenticated;
grant execute on function public.refresh_smart_goals_internal(uuid) to service_role;

create or replace function public.refresh_smart_goals_from_ads(p_client_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Chamada pelo Portal (sessão de usuário): só admin/gestor. pg_cron roda
  -- sem sessão (auth.uid() nulo) e não passa pelos grants.
  if auth.uid() is not null and coalesce(public.current_user_role()::text, '') not in ('admin', 'gestor') then
    raise exception 'Não autorizado';
  end if;
  return public.refresh_smart_goals_internal(p_client_id);
end;
$$;

revoke execute on function public.refresh_smart_goals_from_ads(uuid) from public, anon;
grant execute on function public.refresh_smart_goals_from_ads(uuid) to authenticated, service_role;

-- --------------------------------------- 3. gatilho ao salvar as vendas do mês
create or replace function public.on_client_monthly_sales_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket numeric;
begin
  perform public.refresh_smart_goals_internal(new.client_id);

  select average_ticket into v_ticket from public.clients where id = new.client_id;
  update public.client_monthly_reports r
     set sales = new.sales,
         revenue = case when v_ticket is not null then new.sales * v_ticket end,
         roas = case when v_ticket is not null and r.spend > 0 then new.sales * v_ticket / r.spend end,
         lead_to_sale_rate = case when r.leads > 0 then new.sales::numeric / r.leads * 100 end,
         generated_at = now()
   where r.client_id = new.client_id and r.ref_month = new.month;

  return new;
end;
$$;

revoke execute on function public.on_client_monthly_sales_change() from public, anon, authenticated;

drop trigger if exists trg_client_monthly_sales_change on public.client_monthly_sales;
create trigger trg_client_monthly_sales_change
  after insert or update of sales on public.client_monthly_sales
  for each row execute procedure public.on_client_monthly_sales_change();

-- ------------------------------------------------- 4. relatório mensal (cron)
create or replace function public.generate_monthly_client_reports(p_ref_month date default null::date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref_month date := date_trunc('month', coalesce(p_ref_month, current_date - interval '1 month'))::date;
  v_next_month date := (v_ref_month + interval '1 month')::date;
  c record;
  agg record;
  v_revenue numeric;
  v_roas numeric;
  v_health_score integer;
  v_average_ticket numeric;
  v_leads bigint;
  v_sales bigint;
  v_cost_per_lead numeric;
  v_lead_to_sale_rate numeric;
begin
  if public.current_user_role() is not null and public.current_user_role() not in ('admin', 'gestor') then
    raise exception 'Não autorizado';
  end if;

  for c in
    select distinct client_id from public.performance_snapshots
    where snapshot_date >= v_ref_month and snapshot_date < v_next_month
  loop
    select
      coalesce(sum(spend), 0) as spend,
      coalesce(sum(clicks), 0) as clicks,
      coalesce(sum(impressions), 0) as impressions,
      coalesce(sum(conversions), 0) as conversions
    into agg
    from public.performance_snapshots
    where client_id = c.client_id and snapshot_date >= v_ref_month and snapshot_date < v_next_month;

    select average_ticket, health_score into v_average_ticket, v_health_score
    from public.clients where id = c.client_id;

    select count(*) into v_leads
    from (
      select id from public.form_responses
      where client_id = c.client_id
        and coalesce(submitted_at, created_at) >= v_ref_month and coalesce(submitted_at, created_at) < v_next_month
      union all
      select id from public.manual_leads
      where client_id = c.client_id
        and created_at >= v_ref_month and created_at < v_next_month
    ) leads_union;

    -- Fase 58: vendas = as informadas pelo cliente pro mês (nulo se ainda
    -- não informou — nada de estimativa).
    select sales into v_sales from public.client_monthly_sales
    where client_id = c.client_id and month = v_ref_month;

    v_cost_per_lead := case when v_leads > 0 then agg.spend / v_leads else null end;
    v_lead_to_sale_rate := case when v_leads > 0 and v_sales is not null then (v_sales::numeric / v_leads) * 100 else null end;
    v_revenue := case when v_sales is not null and v_average_ticket is not null then v_sales * v_average_ticket else null end;
    v_roas := case when v_revenue is not null and agg.spend > 0 then v_revenue / agg.spend else null end;

    insert into public.client_monthly_reports (
      client_id, ref_month, spend, revenue, roas, cpa, ctr, clicks, impressions, conversions, health_score,
      leads, sales, cost_per_lead, lead_to_sale_rate
    ) values (
      c.client_id,
      v_ref_month,
      agg.spend,
      v_revenue,
      v_roas,
      case when agg.conversions > 0 then agg.spend / agg.conversions else null end,
      case when agg.impressions > 0 then (agg.clicks::numeric / agg.impressions) * 100 else null end,
      agg.clicks,
      agg.impressions,
      agg.conversions,
      v_health_score,
      v_leads,
      v_sales,
      v_cost_per_lead,
      v_lead_to_sale_rate
    )
    on conflict (client_id, ref_month) do update set
      spend = excluded.spend,
      revenue = excluded.revenue,
      roas = excluded.roas,
      cpa = excluded.cpa,
      ctr = excluded.ctr,
      clicks = excluded.clicks,
      impressions = excluded.impressions,
      conversions = excluded.conversions,
      health_score = excluded.health_score,
      leads = excluded.leads,
      sales = excluded.sales,
      cost_per_lead = excluded.cost_per_lead,
      lead_to_sale_rate = excluded.lead_to_sale_rate,
      generated_at = now();
  end loop;
end;
$$;

-- ------------------------------------- 5. dados demo também limpam as vendas
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
