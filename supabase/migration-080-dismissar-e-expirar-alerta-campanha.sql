-- Ametista Conversões — pedido do usuário depois de ver o alerta de
-- campanha pausada/removida (Fase 40) exibido em Projetos/Integrações:
-- (1) a mensagem não pode ficar aparecendo pra sempre — precisa expirar
--     sozinha depois de um tempo (telas do GESTOR: Integrações, Projeto,
--     Central de Informações do cliente);
-- (2) o gestor tem que poder "apagar" a mensagem de UMA campanha
--     específica, quando já sabe que ela foi pausada/removida de
--     propósito;
-- (3) o Portal do Cliente ganha o mesmo aviso "Projeto com problemas",
--     mas esse NÃO expira sozinho — só some quando o gestor apaga a
--     mensagem OU a campanha volta a ficar ativa (o cliente não deve
--     perder a visibilidade de um problema real só porque passou tempo).
--
-- Como usar: copie todo este arquivo e cole no SQL Editor do painel do
-- Supabase (SQL Editor > New query), depois clique em "Run". Seguro
-- rodar de novo.

-- =========================================================
-- 1. 2 colunas novas em project_campaign_links:
--    - problem_status_since: desde quando o status ATUAL (se Pausada/
--      Removida) está assim — é o que a tela do gestor usa pra saber
--      se já passou do prazo de expiração.
--    - problem_dismissed_at: quando o gestor apagou a mensagem dessa
--      campanha especificamente — null de novo automaticamente na
--      próxima vez que o status mudar (uma transição NOVA sempre
--      aparece, mesmo que uma transição antiga tenha sido dispensada).
-- =========================================================
alter table public.project_campaign_links
  add column if not exists problem_status_since timestamptz,
  add column if not exists problem_dismissed_at timestamptz;

-- Backfill: campanha que já está pausada/removida AGORA (de antes desta
-- migration) começa a contar o prazo de expiração a partir de agora, não
-- de uma data desconhecida no passado (evita que já nasça "expirada").
update public.project_campaign_links
set problem_status_since = now()
where last_known_status in ('PAUSED', 'REMOVED') and problem_status_since is null;

-- =========================================================
-- 2. check_campaign_state_changes() — mesma lógica de sempre, só o
--    UPDATE final ganha o controle de problem_status_since/
--    problem_dismissed_at: toda vez que o status É DIFERENTE do
--    conhecido (uma transição de verdade aconteceu nesta rodada), reseta
--    os dois — vira "problema novo" (now(), não dispensado) se a
--    campanha ficou Pausada/Removida, ou some (null, null) se voltou a
--    ficar Ativa. Sem transição nesta rodada, os dois ficam como estão
--    (não apaga um "dispensado" só por rodar de novo sem mudança).
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

-- =========================================================
-- 3. Cliente enxerga o próprio project_campaign_links (só leitura) —
--    precisa pro Portal do Cliente saber se algum projeto seu tem
--    campanha com problema. Sem coluna client_id direto na tabela
--    (é por project_id), então o join é via EXISTS em projects.
-- =========================================================
drop policy if exists "cliente_le_proprios_project_campaign_links" on public.project_campaign_links;
create policy "cliente_le_proprios_project_campaign_links" on public.project_campaign_links for select
  using (
    public.current_user_role() = 'cliente'
    and exists (
      select 1 from public.projects p
      where p.id = project_campaign_links.project_id
        and p.client_id = public.current_user_client_id()
    )
  );
