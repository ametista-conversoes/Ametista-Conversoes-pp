-- Ametista Conversões — Fase 48.5: registro leve de progresso do
-- Plano de 90 dias (decisão do usuário: nem texto livre solto, nem o
-- documento completo de 10 seções do modelo real — só um histórico de
-- marcos datados, gestor lança, cliente vê). O documento completo em
-- si continua um processo manual fora do app (preenchido no modelo do
-- Obsidian, exportado em PDF e subido na aba Arquivos do cliente).
--
-- Como usar: copie todo este arquivo e cole no SQL Editor do painel do
-- Supabase (SQL Editor > New query), depois clique em "Run".

create table public.client_90day_milestones (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  -- Dia 0 do plano (data de início) — por linha, não por cliente, pra
  -- não exigir uma coluna nova em `clients`; se repetitivo, o gestor
  -- só repete o mesmo valor em toda entrada do mesmo cliente.
  start_date date,
  entry_date date not null,
  title text not null,
  status text not null default 'pendente' check (status in ('pendente', 'em_andamento', 'concluido', 'atrasado')),
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_client_90day_milestones_client_id_entry_date
  on public.client_90day_milestones (client_id, entry_date);

create trigger set_client_90day_milestones_updated_at before update on public.client_90day_milestones
  for each row execute procedure public.set_updated_at();

alter table public.client_90day_milestones enable row level security;

create policy "cliente_le_proprios_milestones_90dias" on public.client_90day_milestones for select
  using (public.current_user_role() = 'cliente' and client_id = public.current_user_client_id());

create policy "admin_gestor_full_milestones_90dias" on public.client_90day_milestones for all
  using (public.current_user_role() in ('admin', 'gestor'))
  with check (public.current_user_role() in ('admin', 'gestor'));
