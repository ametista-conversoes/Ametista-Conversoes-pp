-- Ametista Conversões — Fase 48.8: notificação push ao cliente quando
-- uma Análise do Gestor é publicada.
--
-- ATENÇÃO — ESTA MIGRATION PRECISA SER COLADA NO SQL EDITOR DO PAINEL
-- DO SUPABASE (SQL Editor > New query), NÃO via CLI: ela contém o
-- segredo `X-Notifications-Secret` que protege o endpoint `/dispatch`
-- (mesmo valor configurado como secret da Edge Function
-- `notifications`, `NOTIFICATIONS_CRON_SECRET`) — troque o placeholder
-- abaixo pelo valor real antes de rodar, igual já foi feito nos outros
-- gatilhos de notificação (migration-038). Não commitar o valor real.

-- Lista completa inclui 'manager_analysis_overdue' também (migration-089,
-- Fase 48.9) pra este arquivo continuar seguro de rodar sozinho em
-- qualquer ordem relativa à 089 — sem isso, reaplicar esta migration
-- depois da 089 derruba o constraint e quebra linhas já existentes
-- com kind='manager_analysis_overdue'.
alter table public.push_notification_log drop constraint if exists push_notification_log_kind_check;
alter table public.push_notification_log add constraint push_notification_log_kind_check
  check (kind in (
    'incident_created', 'alert_created', 'client_at_risk',
    'meeting_reminder_1h', 'meeting_reminder_15m', 'smart_goal_overdue',
    'renewal_reminder_30d', 'renewal_reminder_7d', 'renewal_reminder_1d',
    'manager_analysis_published', 'manager_analysis_overdue'
  ));

create or replace function public.notify_manager_analysis_published()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'publicada' and (old.status is distinct from new.status) then
    perform net.http_post(
      url := 'https://ktexhzcpqrqjdgzgxisx.supabase.co/functions/v1/notifications/dispatch',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Notifications-Secret', '<COLE_AQUI_O_VALOR_DO_NOTIFICATIONS_CRON_SECRET>'
      ),
      body := jsonb_build_object('kind', 'manager_analysis_published', 'entity_id', new.id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_manager_analyses_notify on public.manager_analyses;
create trigger trg_manager_analyses_notify
  after update on public.manager_analyses
  for each row execute procedure public.notify_manager_analysis_published();
