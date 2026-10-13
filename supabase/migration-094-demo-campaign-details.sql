-- Ametista Conversões — Fase 50.C.1: exceção pra "Grupos de Anúncios" e
-- "Campanha" (resumos/insights) em cliente de demonstração. As 2 telas
-- normalmente fazem uma chamada AO VIVO pra API real do Google/Meta
-- (nunca gravam nada no banco) — impossível pra um cliente sem conexão
-- real. Esta tabela guarda um "registro" sintético por campanha, que o
-- Edge Function passa a servir no lugar da chamada real quando o
-- cliente por trás da conexão é `is_demo`.
create table public.demo_campaign_details (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.digital_asset_connections(id) on delete cascade,
  external_campaign_id text not null,
  ad_groups jsonb not null default '[]',
  insights jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (connection_id, external_campaign_id)
);

alter table public.demo_campaign_details enable row level security;

create policy "admin_gestor_full_demo_campaign_details" on public.demo_campaign_details for all
  using (public.current_user_role() in ('admin', 'gestor'))
  with check (public.current_user_role() in ('admin', 'gestor'));
