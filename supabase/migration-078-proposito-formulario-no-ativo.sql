-- Ametista Conversões — Fase 38: propósito do formulário escolhido na
-- criação/edição do Ativo Digital (em vez de só dentro de "Ver respostas").
--
-- Como usar: copie todo este arquivo e cole no SQL Editor do painel do
-- Supabase (SQL Editor > New query), depois clique em "Run". Seguro
-- rodar de novo mesmo se você já rodou antes.
--
-- Contexto (pedido do usuário): a Fase 37 (migration-077) só deixava
-- escolher o "propósito do formulário" (Venda/Perdido/Genérico) depois
-- de já ter conectado a integração, dentro do diálogo "Ver respostas" —
-- pouco intuitivo. Agora o Ativo Digital ganha um Tipo novo
-- ("Formulário (Google Forms)") e, quando esse tipo é escolhido, o
-- próprio formulário de criação/edição do Ativo já pergunta o
-- propósito, antes mesmo de existir qualquer conexão.
--
-- `digital_asset_connections.form_purpose` (migration-077) CONTINUA
-- existindo e é o que a sincronização de fato lê (Edge Function
-- `integrations`, syncFormsConnection) — sem mudança nenhuma aí. Este
-- novo campo em `digital_assets` é o valor combinado no cadastro do
-- Ativo; ele é copiado pra dentro da conexão no momento em que ela é
-- criada (`/connect`) e mantido em sincronia depois via
-- `set_asset_form_purpose` (chamada pelo app sempre que o Ativo é
-- editado com Tipo = Formulário).

alter table public.digital_assets
  add column if not exists form_purpose text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'digital_assets_form_purpose_check'
  ) then
    alter table public.digital_assets
      add constraint digital_assets_form_purpose_check
      check (form_purpose is null or form_purpose in ('vendas', 'perdido'));
  end if;
end $$;

-- Mesma checagem/escopo de `set_form_purpose` (migration-077), só que
-- por Ativo Digital em vez de por conexão — atualiza o Ativo E, se já
-- existir, propaga pra conexão google_forms vinculada (nunca cria
-- conexão nova, só mantém as duas em sincronia).
create or replace function public.set_asset_form_purpose(p_asset_id uuid, p_purpose text)
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

  update public.digital_assets
  set form_purpose = p_purpose
  where id = p_asset_id;

  update public.digital_asset_connections
  set form_purpose = p_purpose
  where digital_asset_id = p_asset_id and provider = 'google_forms';
end;
$$;

grant execute on function public.set_asset_form_purpose(uuid, text) to authenticated;

-- Backfill: quem já tinha propósito configurado só na conexão (fluxo
-- antigo da Fase 37) ganha o mesmo valor refletido no Ativo, pra
-- aparecer certo assim que reabrir o formulário de editar o Ativo.
update public.digital_assets a
set form_purpose = c.form_purpose
from public.digital_asset_connections c
where c.digital_asset_id = a.id
  and c.provider = 'google_forms'
  and c.form_purpose is not null
  and a.form_purpose is distinct from c.form_purpose;
