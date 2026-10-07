-- Ametista Conversões — Fase 48.9: lembrete pro gestor quando a
-- Análise do Gestor do período corrente ainda não foi publicada —
-- mesma cadência da Fase 48.6 (mensal/quinzenal/semanal por plano, via
-- `meeting_recurrence_interval`), mesmo molde dos outros lembretes por
-- tempo (`detect_new_renewal_reminders_30d`, migration-049).
--
-- Simplificação deliberada (não replica a lógica exata de
-- `resolveAnalysisPeriod`/quinzena-semana em SQL): "vencida" = já
-- passou mais tempo que a cadência do plano desde a ÚLTIMA análise
-- publicada desse cliente (ou desde o cadastro do cliente, se nunca
-- publicou nenhuma) — captura o mesmo problema real (gestor esquecendo
-- de publicar) sem precisar duplicar o cálculo de mês/quinzena/semana
-- que já existe em TypeScript (`src/lib/manager-analysis.ts`).
--
-- Como usar: copie todo este arquivo e cole no SQL Editor do painel do
-- Supabase (SQL Editor > New query), depois clique em "Run".

alter table public.push_notification_log drop constraint if exists push_notification_log_kind_check;
alter table public.push_notification_log add constraint push_notification_log_kind_check
  check (kind in (
    'incident_created', 'alert_created', 'client_at_risk',
    'meeting_reminder_1h', 'meeting_reminder_15m', 'smart_goal_overdue',
    'renewal_reminder_30d', 'renewal_reminder_7d', 'renewal_reminder_1d',
    'manager_analysis_published', 'manager_analysis_overdue'
  ));

create or replace function public.detect_new_manager_analysis_overdue()
returns table(id uuid)
language plpgsql security definer set search_path = public
as $$
begin
  if public.current_user_role() is not null and public.current_user_role() not in ('admin', 'gestor') then
    raise exception 'Não autorizado';
  end if;

  return query
  insert into public.push_notification_log (kind, entity_id)
  select 'manager_analysis_overdue', c.id
  from public.clients c
  where c.plan is not null
    and now() - coalesce(
      (select max(a.published_at) from public.manager_analyses a where a.client_id = c.id and a.status = 'publicada'),
      c.created_at
    ) > public.meeting_recurrence_interval(c.plan)
  on conflict (kind, entity_id) do nothing
  returning push_notification_log.entity_id;
end;
$$;

grant execute on function public.detect_new_manager_analysis_overdue() to authenticated;

-- Limpa o dedup quando uma análise nova é publicada pra esse cliente —
-- senão o lembrete, depois de disparar uma vez, nunca avisaria de novo
-- no próximo ciclo (mesmo padrão de `clear_renewal_reminder_log`).
create or replace function public.clear_manager_analysis_overdue_log()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'publicada' and (old.status is distinct from new.status) then
    delete from public.push_notification_log where kind = 'manager_analysis_overdue' and entity_id = new.client_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_manager_analyses_clear_overdue on public.manager_analyses;
create trigger trg_manager_analyses_clear_overdue
  after update on public.manager_analyses
  for each row execute procedure public.clear_manager_analysis_overdue_log();

-- Pra testar sem esperar o cron de 1 em 1 minuto:
--   select * from public.detect_new_manager_analysis_overdue();
