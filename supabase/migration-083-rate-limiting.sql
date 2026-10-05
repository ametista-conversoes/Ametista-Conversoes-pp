-- Fase 46 — rate limiting por usuário nas rotas que chamam API paga/com
-- quota compartilhada (OpenAI via Cassie, Google Ads/Meta via
-- integrations). Sem estado em memória confiável entre invocações do
-- Deno (cada chamada pode cair num isolate/cold start diferente) — o
-- contador vive no Postgres, a única coisa realmente compartilhada
-- entre todas as invocações.
--
-- Janela fixa (fixed window), não deslizante: mais barata (1 upsert
-- atômico por chamada, sem precisar de COUNT em cima de um log de
-- eventos) e suficiente pro objetivo real aqui (travar um loop/bug/abuso,
-- não garantir justiça milimétrica entre usuários).
create table public.rate_limit_hits (
  user_id uuid not null,
  bucket text not null,
  window_start timestamptz not null,
  hit_count integer not null default 0,
  primary key (user_id, bucket, window_start)
);

alter table public.rate_limit_hits enable row level security;
-- De propósito, nenhuma policy criada aqui — só o service-role (chamado
-- de dentro das Edge Functions) toca essa tabela, mesmo padrão já usado
-- em oauth_tokens/agency_oauth_tokens/form_response_events/
-- push_notification_log. Não existe motivo legítimo pro frontend
-- consultar ou alterar isso direto.

create or replace function public.check_rate_limit(
  p_user_id uuid,
  p_bucket text,
  p_window_seconds integer,
  p_max_hits integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  v_window_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.rate_limit_hits (user_id, bucket, window_start, hit_count)
  values (p_user_id, p_bucket, v_window_start, 1)
  on conflict (user_id, bucket, window_start)
  do update set hit_count = public.rate_limit_hits.hit_count + 1
  returning hit_count into v_count;

  return v_count <= p_max_hits;
end;
$$;

-- Limpeza diária — mesmo padrão de cron já usado pro arquivamento
-- automático de tarefas (migration-081). As linhas são pequenas e
-- poucas nessa escala, mas não há motivo pra acumular pra sempre.
select cron.schedule(
  'cleanup-rate-limit-hits',
  '0 3 * * *',
  $$ delete from public.rate_limit_hits where window_start < now() - interval '2 days'; $$
);
