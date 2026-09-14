-- Ametista Conversões — Fase 36.1: estende o arquivamento automático
-- (Fase 36) pra `activity_checklist_items` (aba Atividades do Gestor).
--
-- Como usar: copie todo este arquivo e cole no SQL Editor do painel do
-- Supabase (SQL Editor > New query), depois clique em "Run". Seguro
-- rodar de novo mesmo se você já rodou uma versão anterior.
--
-- Por que Atividades precisava de tratamento à parte, não só entrar na
-- mesma regra de `tasks`/`client_tasks`: o usuário notou que Atividades
-- acumula MAIS que o Kanban (um cliente recebe dezenas de itens de
-- workflow, e a lista nunca esconde nada, nem separa "concluído" numa
-- coluna própria como o Kanban faz) — mas também notou o risco de
-- arquivar um item RECORRENTE do mesmo jeito que um não-recorrente: a
-- Fase 35 cicla a MESMA linha pra sempre, então arquivar de verdade (e
-- sumir da consulta padrão) quebraria a recorrência — o item nunca mais
-- voltaria a aparecer sozinho quando vencesse de novo, porque ninguém
-- chamaria "restaurar" nele. Por isso aqui são DUAS coisas diferentes:
--
-- 1. Arquivamento de verdade (esta migration) — só pra item SEM
--    recorrência, concluído há mais de 30 dias, exatamente como
--    `tasks`/`client_tasks` na Fase 36. Some da consulta padrão, mas
--    fica recuperável na tela "Arquivadas".
-- 2. Colapso visual (só frontend, sem migration nenhuma) — QUALQUER
--    item concluído (recorrente ou não) fica visível só por 1 dia,
--    depois entra numa seção colapsável "Concluídas" — pro item
--    recorrente, isso é 100% calculado a cada carregamento a partir de
--    `completed_at`/`recurrence_interval` (mesma lógica que já decide
--    se venceu), então ele sai do colapso sozinho no instante em que a
--    recorrência vence, sem precisar de nenhuma ação de "restaurar".

-- =========================================================
-- 1. Coluna nova.
-- =========================================================
alter table public.activity_checklist_items add column if not exists archived_at timestamptz;
create index if not exists idx_activity_checklist_items_archived_at on public.activity_checklist_items (archived_at);

-- =========================================================
-- 2. `archive_stale_completed_tasks()` ganha um 3º bloco, mesmo padrão
--    exato do bloco de `client_tasks` (Fase 36): só item SEM
--    recorrência, concluído há mais de 30 dias.
-- =========================================================
create or replace function public.archive_stale_completed_tasks()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_tasks_count integer;
  v_client_tasks_count integer;
  v_activity_items_count integer;
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

  update public.activity_checklist_items
    set archived_at = now()
    where completed = true
      and archived_at is null
      and recurrence_interval is null
      and completed_at is not null
      and completed_at < now() - interval '30 days';
  get diagnostics v_activity_items_count = row_count;

  return v_tasks_count + v_client_tasks_count + v_activity_items_count;
end;
$$;

grant execute on function public.archive_stale_completed_tasks() to authenticated;
