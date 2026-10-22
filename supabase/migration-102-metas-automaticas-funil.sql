-- Ametista Conversões — Fase 54: Metas SMART com progresso automático.
--
-- 1. `smart_goals.funnel` — marca as metas criadas/adotadas pelo "Montar
--    funil" (Metas SMART). Elas aparecem numa lista única por cliente em vez
--    de um card por meta.
-- 2. `refresh_smart_goals_from_ads(p_client_id)` — recalcula o valor atual
--    das metas cujas métricas o app mede, sempre no MÊS CORRENTE (dia 1 até
--    hoje, fuso de São Paulo):
--      • das campanhas vinculadas aos projetos do cliente
--        (`campaign_performance_snapshots`): Orçamento mensal (investimento),
--        Impressões, Cliques, Leads e Conversões (conversões do pixel/tag),
--        CPA, CPC, CTR, CPM, Taxa de Conversão, Faturamento e ROAS (receita
--        estimada = conversões ÷ leads p/ fechar 1 venda × ticket médio, igual
--        ao card de Performance — `src/lib/metrics.ts`);
--      • dos status de lead (formulários + leads manuais): Leads Qualificados
--        (qualificado + venda) e Vendas.
--    Métricas que o app não mede (Ticket Médio, "Outro") continuam manuais.
--    Meta concluída não é mexida. Fórmulas espelham `src/lib/goal-progress.ts`
--    / `src/lib/metrics.ts` — mudar lá exige mudar aqui.
-- 3. pg_cron às :10 de cada hora (a sincronização roda às :00).
--
-- Seguro rodar de novo.

alter table public.smart_goals add column if not exists funnel boolean not null default false;

-- Metas já criadas pelo "Montar funil" antes desta coluna existir (todas
-- nascem com o título "Funil — <métrica>").
update public.smart_goals set funnel = true where title like 'Funil — %' and not funnel;

create or replace function public.refresh_smart_goals_from_ads(p_client_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month_start date := date_trunc('month', now() at time zone 'America/Sao_Paulo')::date;
  v_updated integer;
begin
  -- Chamada pelo Portal (sessão de usuário): só admin/gestor. pg_cron roda
  -- sem sessão (auth.uid() nulo) e não passa pelos grants abaixo.
  if auth.uid() is not null and coalesce(public.current_user_role()::text, '') not in ('admin', 'gestor') then
    raise exception 'Não autorizado';
  end if;

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
           count(*) filter (where x.status in ('qualificado', 'venda'))::numeric as qualificados,
           count(*) filter (where x.status = 'venda')::numeric as vendas
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
        when 'vendas' then coalesce(ld.vendas, 0)
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
        when 'faturamento' then
          round(a.conversions / nullif(cl.leads_to_close, 0) * cl.average_ticket, 2)
        when 'roas' then
          round(a.conversions / nullif(cl.leads_to_close, 0) * cl.average_ticket / nullif(a.spend, 0), 2)
      end as value
    from public.smart_goals g
    join public.clients cl on cl.id = g.client_id
    left join ads a on a.client_id = g.client_id
    left join leads ld on ld.client_id = g.client_id
    where g.status <> 'completed'
      and (p_client_id is null or g.client_id = p_client_id)
      and (
        g.metric_type in ('leads_qualificados', 'vendas')
        -- Métricas de anúncio só pra quem tem campanha vinculada: sem vínculo,
        -- "0" seria falso — fica o valor que estiver.
        or (a.client_id is not null and g.metric_type in (
          'orcamento', 'impressoes', 'cliques', 'leads', 'conversoes', 'cpa', 'cpc',
          'ctr', 'cpm', 'taxa_conversao', 'faturamento', 'roas'))
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

revoke execute on function public.refresh_smart_goals_from_ads(uuid) from public, anon;
grant execute on function public.refresh_smart_goals_from_ads(uuid) to authenticated, service_role;

select cron.unschedule('refresh-smart-goals') where exists (select 1 from cron.job where jobname = 'refresh-smart-goals');
select cron.schedule('refresh-smart-goals', '10 * * * *', $$select public.refresh_smart_goals_from_ads()$$);
