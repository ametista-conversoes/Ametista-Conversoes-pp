-- Ametista Conversões — usuário reportou que o "Arquivada em" das
-- tarefas concluídas (Kanban/Tarefas do Cliente/Atividades) não reflete
-- o tempo real de quando isso deveria ter acontecido. Causa raiz: SEM
-- CRON, `archive_stale_completed_tasks()` só rodava quando alguém abria
-- a tela de Kanban/Tarefas do Cliente (`useAutoArchiveOldTasks`,
-- disparado 1x por carregamento de página) — então `archived_at` ficava
-- "certo" (é de fato quando a função rodou), mas o MOMENTO em que ela
-- rodou podia ficar dias/semanas atrasado em relação aos 30 dias reais,
-- se ninguém abrisse aquela tela nesse meio tempo. Confirmado no banco:
-- 2 tarefas concluídas em datas bem diferentes (04/08 e 06/08) tinham o
-- EXATO mesmo `archived_at` (26/09, à hora em que o usuário abriu o
-- Kanban) — prova de que ficaram "acumuladas" esperando alguém abrir a
-- tela, em vez de arquivar perto da hora certa.
--
-- Como usar: copie todo este arquivo e cole no SQL Editor do painel do
-- Supabase (SQL Editor > New query), depois clique em "Run". Seguro
-- rodar de novo.

-- Chamada direta via SQL (não precisa de net.http_post/Edge Function —
-- archive_stale_completed_tasks() já é uma function do Postgres).
-- Rodando 1x por dia, de madrugada (não precisa de mais frequência —
-- o critério é "há mais de 30 dias", 1 dia de atraso no pior caso é
-- irrelevante).
select cron.schedule(
  'archive-stale-tasks',
  '0 4 * * *',
  $$ select public.archive_stale_completed_tasks(); $$
);

-- Pra conferir que o job ficou agendado certinho:
--   select * from cron.job where jobname = 'archive-stale-tasks';
-- Pra ver as últimas execuções (sucesso/erro):
--   select * from cron.job_run_details where jobname = 'archive-stale-tasks' order by start_time desc limit 10;
-- Pra cancelar o agendamento, se precisar:
--   select cron.unschedule('archive-stale-tasks');
