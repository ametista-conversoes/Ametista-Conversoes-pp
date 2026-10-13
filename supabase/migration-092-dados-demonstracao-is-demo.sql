-- Ametista Conversões — Fase 50.A: base para dados de demonstração
-- (prospects). `is_demo` marca um cliente fictício usado só pra
-- demonstração ao vivo da plataforma — nunca entra nos KPIs da
-- agência, nunca é tocado por sincronização real, nunca dispara
-- notificação push.

alter table public.clients add column if not exists is_demo boolean not null default false;

-- `capture_executive_kpi_snapshot` (migration-050, Fase 23) recalculada
-- pra excluir clientes demo de toda agregação — mesma regra que o
-- front-end (`computeExecutiveKpis`/DashboardExecutivo.tsx) passa a
-- aplicar também, filtrando os arrays antes de calcular.
create or replace function public.capture_executive_kpi_snapshot()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_total_clients integer;
  v_active_clients integer;
  v_churned_clients integer;
  v_mrr numeric;
  v_at_risk integer;
  v_open_incidents integer;
  v_total_tasks integer;
  v_open_tasks integer;
  v_done_tasks integer;
  v_managed_budget numeric;
begin
  if public.current_user_role() is not null and public.current_user_role() not in ('admin', 'gestor') then
    raise exception 'Não autorizado';
  end if;

  select
    count(*),
    count(*) filter (where status = 'active'),
    count(*) filter (where status = 'churned'),
    coalesce(sum(monthly_fee) filter (where status = 'active'), 0),
    count(*) filter (where coalesce(health_score, 100) < 50)
  into v_total_clients, v_active_clients, v_churned_clients, v_mrr, v_at_risk
  from public.clients
  where is_demo = false;

  select count(*) into v_open_incidents
  from public.incidents i
  join public.clients c on c.id = i.client_id
  where i.status in ('open', 'in_progress') and c.is_demo = false;

  select
    count(*),
    count(*) filter (where t.status in ('backlog', 'todo', 'in_progress', 'review')),
    count(*) filter (where t.status = 'done')
  into v_total_tasks, v_open_tasks, v_done_tasks
  from public.tasks t
  join public.clients c on c.id = t.client_id
  where c.is_demo = false;

  select coalesce(sum(p.spend), 0) into v_managed_budget
  from public.projects p
  join public.clients c on c.id = p.client_id
  where p.status = 'active' and c.is_demo = false;

  insert into public.executive_kpi_snapshots (
    snapshot_date, mrr_total, active_clients, churn_rate, open_incidents, at_risk_clients, workload, productivity, managed_budget
  ) values (
    current_date,
    v_mrr,
    v_active_clients,
    case when v_total_clients > 0 then (v_churned_clients::numeric / v_total_clients) * 100 else null end,
    v_open_incidents,
    v_at_risk,
    v_open_tasks,
    case when v_total_tasks > 0 then (v_done_tasks::numeric / v_total_tasks) * 100 else null end,
    v_managed_budget
  )
  on conflict (snapshot_date) do update set
    mrr_total = excluded.mrr_total,
    active_clients = excluded.active_clients,
    churn_rate = excluded.churn_rate,
    open_incidents = excluded.open_incidents,
    at_risk_clients = excluded.at_risk_clients,
    workload = excluded.workload,
    productivity = excluded.productivity,
    managed_budget = excluded.managed_budget;
end;
$$;

select public.capture_executive_kpi_snapshot();

-- `check_metric_alert_thresholds` (migration-047) passa a pular
-- cliente demo — sem isso, o cron geraria alerta de verdade (e
-- dispararia push, já bloqueado em dispatchAlert) em cima do dado
-- sintético do seed, toda vez que ele ficasse fora da faixa esperada.
create or replace function public.check_metric_alert_thresholds()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  t record;
  agg record;
  metric_value numeric;
  metric_label text;
  v_title text;
  already_alerted boolean;
begin
  if public.current_user_role() is not null and public.current_user_role() not in ('admin', 'gestor') then
    raise exception 'Não autorizado';
  end if;

  for t in
    select mat.* from public.metric_alert_thresholds mat
    join public.clients c on c.id = mat.client_id
    where mat.enabled and c.is_demo = false
  loop
    select
      coalesce(sum(spend), 0) as spend,
      coalesce(sum(clicks), 0) as clicks,
      coalesce(sum(impressions), 0) as impressions,
      coalesce(sum(conversions), 0) as conversions
    into agg
    from public.performance_snapshots
    where client_id = t.client_id
      and snapshot_date >= (current_date - interval '7 days');

    metric_value := case t.metric
      when 'spend' then agg.spend
      when 'cpa' then case when agg.conversions > 0 then agg.spend / agg.conversions else null end
      when 'ctr' then case when agg.impressions > 0 then (agg.clicks::numeric / agg.impressions) * 100 else null end
      when 'revenue' then (
        select case
          when c.leads_to_close is not null and c.leads_to_close > 0 and c.average_ticket is not null
          then (agg.conversions / c.leads_to_close) * c.average_ticket
          else null
        end
        from public.clients c where c.id = t.client_id
      )
      when 'roas' then (
        select case
          when c.leads_to_close is not null and c.leads_to_close > 0 and c.average_ticket is not null and agg.spend > 0
          then ((agg.conversions / c.leads_to_close) * c.average_ticket) / agg.spend
          else null
        end
        from public.clients c where c.id = t.client_id
      )
      else null
    end;

    if metric_value is null then continue; end if;

    if not (
      (t.comparison = 'above' and metric_value > t.threshold_value) or
      (t.comparison = 'below' and metric_value < t.threshold_value)
    ) then
      continue;
    end if;

    metric_label := case t.metric
      when 'cpa' then 'CPA'
      when 'roas' then 'ROAS'
      when 'ctr' then 'CTR'
      when 'spend' then 'Investimento'
      when 'revenue' then 'Receita'
      else t.metric
    end;
    v_title := metric_label || ' ' || (case t.comparison when 'above' then 'acima' else 'abaixo' end) || ' do limite configurado';

    select exists(
      select 1 from public.alerts
      where client_id = t.client_id and category = 'limiar_metrica' and resolved = false and title = v_title
    ) into already_alerted;

    if already_alerted then continue; end if;

    insert into public.alerts (title, message, client_id, severity, category)
    values (
      v_title,
      metric_label || ' nos últimos 7 dias: ' || round(metric_value, 2) ||
        ' (limite: ' || (case t.comparison when 'above' then 'acima de ' else 'abaixo de ' end) || t.threshold_value || ')',
      t.client_id,
      'medium'::public.severity_level,
      'limiar_metrica'
    );
  end loop;
end;
$$;

-- `check_campaign_state_changes` (migration-067/079/080) passa a
-- pular vínculo de cliente demo, pelo mesmo motivo acima.
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
  v_is_demo boolean;
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

    select c.is_demo into v_is_demo from public.clients c where c.id = latest.client_id;
    if coalesce(v_is_demo, false) then continue; end if;

    v_key := link.connection_id::text || '|' || link.external_campaign_id;

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
        last_known_budget = coalesce(latest.budget_amount, last_known_budget),
        problem_status_since = case
          when latest.campaign_status is not null and link.last_known_status is distinct from latest.campaign_status then
            case when latest.campaign_status in ('PAUSED', 'REMOVED') then now() else null end
          else problem_status_since
        end,
        problem_dismissed_at = case
          when latest.campaign_status is not null and link.last_known_status is distinct from latest.campaign_status then null
          else problem_dismissed_at
        end
    where id = link.id;
  end loop;
end;
$$;
