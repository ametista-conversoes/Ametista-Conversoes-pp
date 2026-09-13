-- Ametista Conversões — Fase 35.2: desconectar integração de um Ativo
-- Digital (antes só dava pra conectar, nunca desfazer), nome real do
-- Google Forms conectado (pra distinguir do nome do Ativo Digital, que
-- é só um rótulo escolhido por quem cadastrou) e validação de verdade
-- do link colado ao conectar um Google Forms.
--
-- Como usar: copie todo este arquivo e cole no SQL Editor do painel do
-- Supabase (SQL Editor > New query), depois clique em "Run".

alter table public.digital_asset_connections
  add column if not exists external_account_name text;
