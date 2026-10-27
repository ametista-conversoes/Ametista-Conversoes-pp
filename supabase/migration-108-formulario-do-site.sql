-- Ametista Conversões — Fase 60: formulário do site (WordPress/Elementor)
-- virando lead no app.
--
-- Como usar: rode no SQL Editor do Supabase (ou `npx supabase db query
-- --linked -f`). Seguro rodar de novo.
--
-- Escolha de desenho: o lead do site vai pra MESMA tabela dos leads de
-- formulário (`form_responses` + `form_answers` + `form_questions`), por uma
-- conexão do provider novo 'site_form' (sem OAuth). Assim a aba Leads, o
-- status (RPC `set_form_response_status`), o funil, as metas e o relatório
-- mensal contam esse lead sem mudar nada da lógica deles.
--
-- 1. Provider 'site_form' + coluna `webhook_key` na conexão. A RLS de
--    `digital_asset_connections` já só deixa admin/gestor lerem — a chave
--    nunca chega ao Portal do Cliente.
-- 2. Colunas novas em `form_responses`: origem (`source`), UTM, gclid,
--    fbclid, page_url, corpo bruto (depuração do 1º envio real) e
--    `contact_key` (telefone/e-mail normalizado, pra deduplicar).
-- 3. Gatilho: Ativo Digital do tipo 'site_form' cria sozinho a conexão com
--    uma chave aleatória (32 bytes, base64url).
-- 4. RPC `rotate_site_form_key` (admin/gestor): gera nova chave e invalida
--    a anterior.

-- --------------------------------------------- 1. provider e chave do webhook
alter table public.digital_asset_connections drop constraint if exists digital_asset_connections_provider_check;
alter table public.digital_asset_connections add constraint digital_asset_connections_provider_check
  check (provider = any (array['google_ads', 'google_forms', 'meta_ads', 'site_form']));

alter table public.digital_asset_connections add column if not exists webhook_key text;
create unique index if not exists digital_asset_connections_webhook_key_idx
  on public.digital_asset_connections (webhook_key) where webhook_key is not null;

create or replace function public.new_site_form_key()
returns text
language sql
volatile
set search_path = public, extensions
as $$
  select translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
$$;

revoke execute on function public.new_site_form_key() from public, anon, authenticated;

-- ------------------------------------------------ 2. colunas do lead do site
alter table public.form_responses
  add column if not exists source text not null default 'google_forms',
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content text,
  add column if not exists utm_term text,
  add column if not exists gclid text,
  add column if not exists fbclid text,
  add column if not exists page_url text,
  add column if not exists contact_key text,
  add column if not exists raw_payload jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'form_responses_source_check') then
    alter table public.form_responses
      add constraint form_responses_source_check check (source in ('google_forms', 'site_form'));
  end if;
end $$;

create index if not exists form_responses_dedupe_idx
  on public.form_responses (connection_id, contact_key, created_at desc)
  where contact_key is not null;

-- ------------------------------- 3. ativo "Formulário do site" cria a conexão
create or replace function public.ensure_site_form_connection()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.type = 'site_form' then
    insert into public.digital_asset_connections (digital_asset_id, provider, status, webhook_key)
    values (new.id, 'site_form', 'connected', public.new_site_form_key())
    on conflict (digital_asset_id, provider) do nothing;
  end if;
  return new;
end;
$$;

revoke execute on function public.ensure_site_form_connection() from public, anon, authenticated;

drop trigger if exists trg_ensure_site_form_connection on public.digital_assets;
create trigger trg_ensure_site_form_connection
  after insert or update of type on public.digital_assets
  for each row execute procedure public.ensure_site_form_connection();

-- ------------------------------------------------------ 4. gerar nova chave
create or replace function public.rotate_site_form_key(p_connection_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := public.new_site_form_key();
begin
  if coalesce(public.current_user_role()::text, '') not in ('admin', 'gestor') then
    raise exception 'Não autorizado';
  end if;

  update public.digital_asset_connections
     set webhook_key = v_key, updated_at = now()
   where id = p_connection_id and provider = 'site_form';
  if not found then
    raise exception 'Conexão de formulário do site não encontrada';
  end if;

  return v_key;
end;
$$;

revoke execute on function public.rotate_site_form_key(uuid) from public, anon;
grant execute on function public.rotate_site_form_key(uuid) to authenticated;
