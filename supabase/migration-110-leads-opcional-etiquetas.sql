-- Ametista Conversões — Fase 63: marcar o status de cada lead passa a ser
-- OPCIONAL para o cliente (com volume alto, um clique por lead não escala).
--
-- Como usar: rode no SQL Editor do Supabase (ou `npx supabase db query
-- --linked -f`). Seguro rodar de novo.
--
-- 1. Meta "Leads Qualificados": vem da contagem semanal das etiquetas do
--    mês (Qualificado + Agendado + Venda — etapas acumuladas, mesma regra do
--    card "Etiquetas do WhatsApp"; a semana conta no mês da sua sexta). Sem
--    nenhuma semana registrada no mês, continua contando os leads marcados
--    um a um (comportamento anterior).
-- 2. Salvar/apagar uma semana de etiquetas recalcula na hora as metas do
--    cliente (antes só recalculava quando a soma de vendas mudava).
-- 3. RPC `set_form_responses_status` (vários leads de uma vez) — mesmas
--    permissões de `set_form_response_status`.

-- ------------------------------------------------ 1. metas automáticas
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
  -- Fase 63: etiquetas semanais do mês (a semana conta no mês da sexta).
  labels as (
    select w.client_id, sum(w.qualificado + w.agendado + w.venda)::numeric as qualificados
    from public.client_weekly_labels w
    where date_trunc('month', w.week_start + 4)::date = v_month_start
      and (p_client_id is null or w.client_id = p_client_id)
    group by w.client_id
  ),
  computed as (
    select g.id,
      case g.metric_type
        when 'leads_qualificados' then coalesce(lb.qualificados, ld.qualificados, 0)
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
    left join labels lb on lb.client_id = g.client_id
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

-- ------------------------------- 2. etiquetas recalculam as metas na hora
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
  perform public.refresh_smart_goals_internal(coalesce(new.client_id, old.client_id));
  return null;
end;
$$;

revoke execute on function public.on_client_weekly_labels_change() from public, anon, authenticated;

-- --------------------------------------- 3. status de vários leads de uma vez
create or replace function public.set_form_responses_status(p_response_ids uuid[], p_status text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  if p_status not in ('novo', 'qualificado', 'venda', 'perdido') then
    raise exception 'Status inválido';
  end if;
  if coalesce(array_length(p_response_ids, 1), 0) > 500 then
    raise exception 'No máximo 500 leads por vez';
  end if;

  if public.current_user_role() = 'cliente' then
    if exists (
      select 1 from public.form_responses
      where id = any(p_response_ids) and client_id is distinct from public.current_user_client_id()
    ) then
      raise exception 'Não autorizado';
    end if;
  elsif public.current_user_role() not in ('admin', 'gestor') or public.current_user_role() is null then
    raise exception 'Não autorizado';
  end if;

  update public.form_responses set status = p_status where id = any(p_response_ids);
  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke execute on function public.set_form_responses_status(uuid[], text) from public, anon;
grant execute on function public.set_form_responses_status(uuid[], text) to authenticated;
