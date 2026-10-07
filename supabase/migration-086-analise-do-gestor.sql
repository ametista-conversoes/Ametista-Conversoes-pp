-- Ametista Conversões — Fase 48.4: schema da "Análise do Gestor" —
-- texto curto e estruturado que interpreta os números do período,
-- registra otimizações e define próximos passos. Vira o diferencial
-- entre planos (Validação mensal / Escala quinzenal / Dominação
-- semanal + mensal estratégica), já que o cliente consegue ver os
-- números e o PDF sozinho a qualquer momento (Fase 21/48.3).
--
-- Como usar: copie todo este arquivo e cole no SQL Editor do painel do
-- Supabase (SQL Editor > New query), depois clique em "Run".
--
-- Só banco nesta sub-fase — a UI (criar/editar/publicar/histórico)
-- entra na Fase 48.6. Campos comuns (resumo, diagnóstico, otimizações,
-- próximos passos, pendências do cliente) ficam em colunas próprias;
-- os campos específicos por plano/tipo (Validação/Escala/Dominação,
-- periódica/estratégica mensal) ficam dentro de `extra_fields` (jsonb),
-- validados em Zod na UI — evita uma 2ª migration só pra ajuste fino
-- de campo. "Saúde do atendimento" e "Progresso do Plano de 90 dias"
-- NUNCA ficam congelados aqui — são sempre computados ao vivo (de
-- form_responses/manual_leads e de client_90day_milestones, Fase
-- 48.5), pra nunca destoar do dado real.

create table public.manager_analyses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  tipo text not null check (tipo in ('periodica', 'estrategica_mensal')),
  status text not null default 'rascunho' check (status in ('rascunho', 'publicada')),
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  -- Campos comuns (1, 3, 4, 5, 6 da estrutura por plano)
  resumo text,
  status_geral text check (status_geral in ('no_alvo', 'atencao', 'fora_do_alvo')),
  diagnostico text,
  otimizacoes_realizadas text,
  creatives_used_snapshot integer,
  changes_used_snapshot integer,
  proximos_passos jsonb not null default '[]',
  pendencias_cliente_texto text,
  -- Campos específicos por plano/tipo (ver comentário acima)
  extra_fields jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, period_start, period_end, tipo)
);

create index idx_manager_analyses_client_id on public.manager_analyses (client_id);

create trigger set_manager_analyses_updated_at before update on public.manager_analyses
  for each row execute procedure public.set_updated_at();

alter table public.manager_analyses enable row level security;

create policy "cliente_le_analises_publicadas" on public.manager_analyses for select
  using (public.current_user_role() = 'cliente' and client_id = public.current_user_client_id() and status = 'publicada');

create policy "admin_gestor_full_manager_analyses" on public.manager_analyses for all
  using (public.current_user_role() in ('admin', 'gestor'))
  with check (public.current_user_role() in ('admin', 'gestor'));

-- Contador de "alterações" aplicadas no mês (criativos já têm
-- `catalog_entries`, Fase 24/25 — só faltava um registro equivalente
-- pra alterações/otimizações, que hoje não tem nenhum rastro
-- estruturado em lugar nenhum do app). 100% interno — o gestor
-- registra a ação junto de fazê-la; o cliente nunca lê essa tabela
-- direto, só o número agregado dentro de uma Análise publicada, se o
-- gestor decidir expor.
create table public.client_optimization_log (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  description text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_client_optimization_log_client_id_created_at
  on public.client_optimization_log (client_id, created_at);

alter table public.client_optimization_log enable row level security;

create policy "admin_gestor_full_optimization_log" on public.client_optimization_log for all
  using (public.current_user_role() in ('admin', 'gestor'))
  with check (public.current_user_role() in ('admin', 'gestor'));
