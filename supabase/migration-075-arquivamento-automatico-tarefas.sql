-- Ametista Conversões — Fase 36: arquivamento automático de tarefas
-- concluídas (Kanban interno e Tarefas do Cliente).
--
-- Como usar: copie todo este arquivo e cole no SQL Editor do painel do
-- Supabase (SQL Editor > New query), depois clique em "Run". Seguro
-- rodar de novo mesmo se você já rodou uma versão anterior.
--
-- Design: sem cron nenhum (este projeto não tem infraestrutura de job
-- agendado). Em vez disso, `archive_stale_completed_tasks()` roda
-- silenciosamente toda vez que o gestor abre o Kanban ou "Tarefas do
-- Cliente" (chamada pelo frontend, ver useAutoArchiveOldTasks). Arquivar
-- nunca é apagar de verdade — só marca `archived_at`, some da lista
-- padrão, mas continua no banco e pode ser restaurado ou apagado
-- manualmente na tela "Arquivadas". Itens com recorrência
-- (`recurrence_interval` preenchido) NUNCA são arquivados por aqui: o
-- design da Fase 35 já cicla a mesma linha pra sempre, então não têm o
-- problema de acúmulo que essa função resolve.

-- =========================================================
-- 1. Colunas novas.
-- =========================================================
alter table public.tasks add column if not exists archived_at timestamptz;
alter table public.client_tasks add column if not exists archived_at timestamptz;

create index if not exists idx_tasks_archived_at on public.tasks (archived_at);
create index if not exists idx_client_tasks_archived_at on public.client_tasks (archived_at);

-- =========================================================
-- 2. Função que arquiva o que está concluído há mais de 30 dias.
--    `tasks` (Kanban) não tem recorrência nem completed_at (Fase 35
--    deliberadamente não colocou recorrência no Workflow Operacional),
--    então usa `updated_at` (carimbado sozinho a cada troca de status,
--    inclusive pra "done") como proxy de "há quanto tempo terminou".
-- =========================================================
create or replace function public.archive_stale_completed_tasks()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_tasks_count integer;
  v_client_tasks_count integer;
begin
  if public.current_user_role() not in ('admin', 'gestor') then
    raise exception 'Não autorizado';
  end if;

  update public.tasks
    set archived_at = now()
    where status = 'done'
      and archived_at is null
      and updated_at < now() - interval '30 days';
  get diagnostics v_tasks_count = row_count;

  update public.client_tasks
    set archived_at = now()
    where status = 'done'
      and archived_at is null
      and recurrence_interval is null
      and completed_at is not null
      and completed_at < now() - interval '30 days';
  get diagnostics v_client_tasks_count = row_count;

  return v_tasks_count + v_client_tasks_count;
end;
$$;

grant execute on function public.archive_stale_completed_tasks() to authenticated;
