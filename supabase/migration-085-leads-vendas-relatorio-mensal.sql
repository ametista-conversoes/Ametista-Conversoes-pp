-- Ametista Conversões — Fase 48.2: estende o fechamento mensal
-- (client_monthly_reports) com contagem real de leads/vendas do mês,
-- pra alimentar tanto o PDF do relatório (Fase 48.3) quanto o bloco
-- automático de números da Análise do Gestor (Fase 48.6).
--
-- Como usar: copie todo este arquivo e cole no SQL Editor do painel do
-- Supabase (SQL Editor > New query), depois clique em "Run". Seguro
-- rodar de novo.
--
-- "Leads" do mês = form_responses + manual_leads somados (volume real
-- que entrou no funil naquele mês, pra custo-por-lead fazer sentido —
-- diferente do "bruto" que a tela /leads do cliente já mostra, que não
-- muda). "Vendas" = mesma união filtrando status = 'venda', pelo
-- status NO MOMENTO em que esta função roda (mesma limitação que o
-- resto da função já tem com performance_snapshots — não é histórico
-- retroativo; um lead que vira Venda semanas depois do fechamento do
-- mês só reflete se a função rodar de novo pra aquele mês).

alter table public.client_monthly_reports
  add column if not exists leads bigint,
  add column if not exists sales bigint,
  add column if not exists cost_per_lead numeric,
  add column if not exists lead_to_sale_rate numeric;

create or replace function public.generate_monthly_client_reports(p_ref_month date default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_ref_month date := date_trunc('month', coalesce(p_ref_month, current_date - interval '1 month'))::date;
  v_next_month date := (v_ref_month + interval '1 month')::date;
  c record;
  agg record;
  v_revenue numeric;
  v_roas numeric;
  v_health_score integer;
  v_leads_to_close numeric;
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

    select leads_to_close, average_ticket, health_score into v_leads_to_close, v_average_ticket, v_health_score
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

    select count(*) into v_sales
    from (
      select id from public.form_responses
      where client_id = c.client_id and status = 'venda'
        and coalesce(submitted_at, created_at) >= v_ref_month and coalesce(submitted_at, created_at) < v_next_month
      union all
      select id from public.manual_leads
      where client_id = c.client_id and status = 'venda'
        and created_at >= v_ref_month and created_at < v_next_month
    ) sales_union;

    v_cost_per_lead := case when v_leads > 0 then agg.spend / v_leads else null end;
    v_lead_to_sale_rate := case when v_leads > 0 then (v_sales::numeric / v_leads) * 100 else null end;

    v_revenue := case
      when v_leads_to_close is not null and v_leads_to_close > 0 and v_average_ticket is not null
      then (agg.conversions / v_leads_to_close) * v_average_ticket
      else null
    end;
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

-- Pra testar na hora, sem esperar o cron (mês pedido é opcional, usa o mês anterior por padrão):
--   select public.generate_monthly_client_reports('2026-09-01');
--   select client_id, ref_month, leads, sales, cost_per_lead, lead_to_sale_rate from public.client_monthly_reports order by ref_month desc;
