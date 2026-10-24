-- Ametista Conversões — Fase 55: unidade das metas SMART "Outro".
--
-- Como usar: rode no SQL Editor do Supabase (ou `npx supabase db query
-- --linked -f`). Seguro rodar de novo.
--
-- Metas de tipo conhecido (CPA, CTR, Cliques...) têm a unidade definida pelo
-- próprio tipo (`src/lib/goal-progress.ts`). Meta "Outro" (texto livre, ex:
-- "LTV", "Margem de lucro") passa a guardar como o valor deve ser lido:
-- contagem, porcentagem ou dinheiro. Nulo = definido pelo tipo.

alter table public.smart_goals add column if not exists unit text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'smart_goals_unit_check') then
    alter table public.smart_goals
      add constraint smart_goals_unit_check check (unit is null or unit in ('count', 'percent', 'currency'));
  end if;
end $$;
