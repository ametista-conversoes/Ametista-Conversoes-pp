-- Ametista Conversões — Fase 49: aprovação tácita de 48h respeitando as
-- 2 exceções do contrato (cláusula 4.1 §4) — achado de auditoria
-- (contrato × app, 10/10/2026): o mecanismo da Fase 7 (migration-026)
-- aprovava QUALQUER item parado 48h CORRIDAS, sem nenhuma das 2
-- exceções que o contrato exige: (a) preço/oferta/promoção/condição
-- comercial NUNCA pode ser aprovado por silêncio, sempre precisa de
-- aprovação expressa; (b) nos primeiros 30 dias de veiculação de
-- anúncios, TODO item precisa de aprovação expressa, não só os com
-- preço. Também corrige "48h" corridas para "48h úteis" (contrato usa
-- "48 (quarenta e oito) horas úteis").
--
-- Como usar: copie todo este arquivo e cole no SQL Editor do painel do
-- Supabase (SQL Editor > New query), depois clique em "Run".

alter table public.approvals add column if not exists requires_explicit_approval boolean not null default false;

comment on column public.approvals.requires_explicit_approval is
  'Marcado pelo gestor quando o item tem preço/oferta/promoção/condição comercial (contrato 4.1 §4) -- nunca entra na aprovação automática por atraso, sempre precisa de decisão expressa do cliente.';

-- Horas ÚTEIS entre 2 timestamps: horas corridas menos 24h pra cada dia
-- de fim de semana (sáb/dom) inteiramente contido no intervalo --
-- simplificação deliberada (não desconta feriado, só fim de semana),
-- mesmo espírito de outras aproximações já documentadas no projeto (ex:
-- detect_new_manager_analysis_overdue, migration-089).
create or replace function public.business_hours_between(start_ts timestamptz, end_ts timestamptz)
returns numeric
language sql
immutable
as $$
  select greatest(0, extract(epoch from (end_ts - start_ts)) / 3600.0
    - coalesce((
        select count(*) * 24.0
        from generate_series(date_trunc('day', start_ts), date_trunc('day', end_ts), interval '1 day') as d
        where extract(isodow from d) in (6, 7)
      ), 0));
$$;

create or replace function public.auto_approve_overdue_approvals()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  overdue_ids uuid[];
begin
  -- Exceção (b): primeiros 30 dias de veiculação. Usa a 1ª
  -- campaign_performance_snapshots.snapshot_date (data real de
  -- veiculação, vinda da sincronização Google/Meta -- não a data de
  -- cadastro do cliente, que inclui o Setup, nem `performance_snapshots`,
  -- tabela mais antiga que muitos clientes reais nunca chegam a
  -- popular) como marco de "começou a rodar de verdade"; sem nenhum
  -- snapshot ainda, trata como dentro da janela obrigatória (nunca
  -- aprova sozinho antes de começar a rodar).
  select array_agg(a.id) into overdue_ids
  from public.approvals a
  join lateral (
    select min(cps.snapshot_date) as first_snapshot_date
    from public.campaign_performance_snapshots cps
    where cps.client_id = a.client_id
  ) fs on true
  where a.status = 'pending'
    and a.requires_explicit_approval = false
    and public.business_hours_between(a.created_at, now()) >= 48
    and fs.first_snapshot_date is not null
    and fs.first_snapshot_date <= (now() - interval '30 days')::date;

  if overdue_ids is null then
    return;
  end if;

  insert into public.file_items (name, client_id, file_url, file_type, status)
  select title, client_id, file_url, file_type, 'approved'
    from public.approvals
    where id = any(overdue_ids);

  update public.approvals
    set status = 'approved', auto_approved = true
    where id = any(overdue_ids);
end;
$$;
