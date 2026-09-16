-- Ametista Conversões — Fase 37: redesenho da definição do funil de lead.
--
-- Como usar: copie todo este arquivo e cole no SQL Editor do painel do
-- Supabase (SQL Editor > New query), depois clique em "Run". Seguro
-- rodar de novo mesmo se você já rodou uma versão anterior.
--
-- Contexto (pedido do usuário): marcar status de lead resposta por
-- resposta não escala — o usuário tem formulários com função fixa por
-- cliente (um de "cliente-comprador" = fecha venda, outro de "objeções"
-- = registra por que não comprou/cancelou; não existe formulário de
-- "leads"/"qualificado" de propósito, porque um formulário na frente do
-- prospect atrapalharia a conversão). Daqui em diante:
--   - Novo (bruto)  → segue vindo de QUALQUER resposta de formulário
--     sincronizada, como sempre (Fase 35), sem mudança.
--   - Venda/Perdido → passam a poder ser classificados SOZINHOS na hora
--     da sincronização, a partir do "propósito" configurado no
--     formulário conectado (bloco 1 abaixo) — continua editável na mão
--     depois, nunca trava.
--   - Qualificado   → ganha uma via de registro manual (bloco 2 abaixo),
--     pra cobrir quem qualifica por um canal que o app não rastreia
--     ainda (ex: respondeu no WhatsApp) — com busca nas respostas de
--     formulário já existentes antes de criar um registro novo, pra não
--     duplicar quem já tem uma linha de formulário.

-- =========================================================
-- 1. Propósito do formulário conectado (Venda/Perdido) — Google Forms
--    só, mesmo escopo de tudo que já é exclusivo desse provider.
-- =========================================================
alter table public.digital_asset_connections
  add column if not exists form_purpose text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'digital_asset_connections_form_purpose_check'
  ) then
    alter table public.digital_asset_connections
      add constraint digital_asset_connections_form_purpose_check
      check (form_purpose is null or form_purpose in ('vendas', 'perdido'));
  end if;
end $$;

create or replace function public.set_form_purpose(p_connection_id uuid, p_purpose text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if public.current_user_role() not in ('admin', 'gestor') then
    raise exception 'Não autorizado';
  end if;
  if p_purpose is not null and p_purpose not in ('vendas', 'perdido') then
    raise exception 'Propósito inválido';
  end if;

  update public.digital_asset_connections
  set form_purpose = p_purpose
  where id = p_connection_id and provider = 'google_forms';
end;
$$;

grant execute on function public.set_form_purpose(uuid, text) to authenticated;

-- =========================================================
-- 2. Leads manuais — registro de lead qualificado sem resposta de
--    formulário (ex: respondeu no WhatsApp). Mesmo funil de status de
--    `form_responses` (Novo/Qualificado/Venda/Perdido), nasce
--    "qualificado" (é por isso que está sendo registrado), editável
--    depois pelo mesmo caminho. Gestor/admin mexe em qualquer cliente;
--    cliente só nos próprios (mesmo padrão de `client_tasks`).
-- =========================================================
create table if not exists public.manual_leads (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  name text not null,
  contact text,
  note text,
  status text not null default 'qualificado' check (status in ('novo', 'qualificado', 'venda', 'perdido')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_manual_leads_client_id on public.manual_leads (client_id);

alter table public.manual_leads enable row level security;

drop policy if exists "admin_gestor_full_manual_leads" on public.manual_leads;
create policy "admin_gestor_full_manual_leads" on public.manual_leads for all
  using (public.current_user_role() in ('admin', 'gestor'))
  with check (public.current_user_role() in ('admin', 'gestor'));

drop policy if exists "cliente_le_proprios_manual_leads" on public.manual_leads;
create policy "cliente_le_proprios_manual_leads" on public.manual_leads for select
  using (public.current_user_role() = 'cliente' and client_id = public.current_user_client_id());

drop policy if exists "cliente_cria_proprios_manual_leads" on public.manual_leads;
create policy "cliente_cria_proprios_manual_leads" on public.manual_leads for insert
  with check (public.current_user_role() = 'cliente' and client_id = public.current_user_client_id());

create or replace function public.set_manual_lead_status(p_lead_id uuid, p_status text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_client_id uuid;
begin
  if p_status not in ('novo', 'qualificado', 'venda', 'perdido') then
    raise exception 'Status inválido';
  end if;

  select client_id into v_client_id from public.manual_leads where id = p_lead_id;
  if v_client_id is null then
    raise exception 'Lead não encontrado';
  end if;

  if public.current_user_role() = 'cliente' and v_client_id <> public.current_user_client_id() then
    raise exception 'Não autorizado';
  elsif public.current_user_role() not in ('admin', 'gestor', 'cliente') then
    raise exception 'Não autorizado';
  end if;

  update public.manual_leads set status = p_status where id = p_lead_id;
end;
$$;

grant execute on function public.set_manual_lead_status(uuid, text) to authenticated;
