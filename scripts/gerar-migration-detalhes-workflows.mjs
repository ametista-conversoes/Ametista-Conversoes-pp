// Gera supabase/migration-105-detalhes-workflows-dados.sql a partir de
// docs/interno/workflow-detalhes.json (o banco não lê arquivo, então o JSON
// vai embutido no SQL). Rode de novo sempre que editar o JSON:
//
//   node scripts/gerar-migration-detalhes-workflows.mjs
//
// Regras (aplicadas pelo SQL gerado, seguro rodar de novo):
// • Um "match" casa com um item quando o título normalizado COMEÇA com ele
//   (ver workflow-match.mjs / workflow_match_normalize). Pode casar com vários
//   itens do mesmo modelo (variações por plano) — todos recebem o texto.
// • Só preenche `details` vazio/nulo — nunca sobrescreve o que foi editado
//   na tela.
// • `new_items`: insere no modelo logo depois do ÚLTIMO item que casa com
//   `insert_after_match`, só se ainda não existir item com o mesmo título.
// • Backfill das instâncias já aplicadas (activity_checklist_items pelo
//   modelo de origem; client_tasks pelo título, já que não guarda a origem).
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeMatch } from './workflow-match.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const INPUT = join(ROOT, 'docs/interno/workflow-detalhes.json')
const OUTPUT = join(ROOT, 'supabase/migration-105-detalhes-workflows-dados.sql')

const data = JSON.parse(readFileSync(INPUT, 'utf8'))

// Validação básica pra falhar cedo, antes de gerar SQL quebrado.
for (const section of ['activity_templates', 'client_workflow_templates']) {
  for (const [template, entries] of Object.entries(data[section] ?? {})) {
    for (const entry of entries) {
      if (!normalizeMatch(entry.match) || typeof entry.details !== 'string') {
        throw new Error(`${section} › ${template}: entrada sem "match" ou "details" — ${JSON.stringify(entry)}`)
      }
    }
  }
}
for (const item of data.new_items ?? []) {
  if (!item.template || !item.insert_after_match || !item.item?.title) {
    throw new Error(`new_items: entrada incompleta — ${JSON.stringify(item)}`)
  }
}

const payload = JSON.stringify({
  activity_templates: data.activity_templates ?? {},
  client_workflow_templates: data.client_workflow_templates ?? {},
  new_items: data.new_items ?? [],
})
if (payload.includes('$json$')) throw new Error('O JSON não pode conter a sequência $json$')

const sql = `-- Ametista Conversões — Fase 56: textos do campo "Detalhes" dos Workflows.
--
-- GERADO por scripts/gerar-migration-detalhes-workflows.mjs a partir de
-- docs/interno/workflow-detalhes.json — não edite à mão: edite o JSON e rode
-- o script de novo.
--
-- Como usar: rode no SQL Editor do Supabase (ou \`npx supabase db query
-- --linked -f\`) DEPOIS da migration-104. Seguro rodar de novo: só preenche
-- \`details\` vazio e só insere item novo que ainda não existe.

do $mig$
declare
  d jsonb := $json$${payload}$json$::jsonb;
  t_name text;
  entries jsonb;
  ni jsonb;
  v_items jsonb;
  v_pos int;
begin
  -- 1. Itens novos (antes dos textos, pra eles entrarem já com details).
  for ni in select * from jsonb_array_elements(d -> 'new_items')
  loop
    select items into v_items from public.activity_templates where name = ni ->> 'template';
    continue when v_items is null;
    continue when exists (
      select 1 from jsonb_array_elements(v_items) it
      where public.workflow_match_normalize(it ->> 'title') = public.workflow_match_normalize(ni -> 'item' ->> 'title')
    );
    select max(ord) into v_pos
      from jsonb_array_elements(v_items) with ordinality x(it, ord)
     where starts_with(public.workflow_match_normalize(it ->> 'title'),
                       public.workflow_match_normalize(ni ->> 'insert_after_match'));
    v_pos := coalesce(v_pos, jsonb_array_length(v_items));
    update public.activity_templates
       set items = (
         select coalesce(jsonb_agg(it order by ord), '[]'::jsonb)
           from (
             select it, ord::numeric as ord from jsonb_array_elements(v_items) with ordinality x(it, ord)
             union all
             select ni -> 'item', v_pos + 0.5
           ) s
       )
     where name = ni ->> 'template';
  end loop;

  -- 2. Workflows de Atividades.
  for t_name, entries in select key, value from jsonb_each(d -> 'activity_templates')
  loop
    update public.activity_templates t
       set items = (
         select jsonb_agg(
                  case when coalesce(btrim(it ->> 'details'), '') = '' and m.details is not null
                       then it || jsonb_build_object('details', m.details)
                       else it end
                  order by ord)
           from jsonb_array_elements(t.items) with ordinality x(it, ord)
           left join lateral (
             select en ->> 'details' as details
               from jsonb_array_elements(entries) en
              where starts_with(public.workflow_match_normalize(it ->> 'title'),
                                public.workflow_match_normalize(en ->> 'match'))
              order by length(en ->> 'match') desc
              limit 1
           ) m on true
       )
     where t.name = t_name and jsonb_array_length(t.items) > 0;
  end loop;

  -- 3. Workflows do Cliente.
  for t_name, entries in select key, value from jsonb_each(d -> 'client_workflow_templates')
  loop
    update public.client_workflow_templates t
       set steps = (
         select jsonb_agg(
                  case when coalesce(btrim(st ->> 'details'), '') = '' and m.details is not null
                       then st || jsonb_build_object('details', m.details)
                       else st end
                  order by ord)
           from jsonb_array_elements(t.steps) with ordinality x(st, ord)
           left join lateral (
             select en ->> 'details' as details
               from jsonb_array_elements(entries) en
              where starts_with(public.workflow_match_normalize(st ->> 'title'),
                                public.workflow_match_normalize(en ->> 'match'))
              order by length(en ->> 'match') desc
              limit 1
           ) m on true
       )
     where t.name = t_name and jsonb_array_length(t.steps) > 0;
  end loop;

  -- 4. Backfill: itens de atividade já aplicados (pelo modelo de origem —
  --    nome atual do modelo, ou o nome guardado na instância).
  update public.activity_checklist_items aci
     set details = sub.details
    from (
      select a.id,
             (select en ->> 'details'
                from jsonb_array_elements(
                       coalesce(d -> 'activity_templates' -> t.name,
                                d -> 'activity_templates' -> a.source_template_name, '[]'::jsonb)) en
               where starts_with(public.workflow_match_normalize(a.title),
                                 public.workflow_match_normalize(en ->> 'match'))
               order by length(en ->> 'match') desc
               limit 1) as details
        from public.activity_checklist_items a
        left join public.activity_templates t on t.id = a.source_activity_template_id
       where coalesce(btrim(a.details), '') = ''
    ) sub
   where aci.id = sub.id and sub.details is not null;

  -- 5. Backfill: tarefas do cliente já aplicadas (client_tasks não guarda o
  --    modelo de origem — casa pelo título contra todos os Workflows do
  --    Cliente; o match mais específico ganha).
  update public.client_tasks ct
     set details = sub.details
    from (
      select c.id,
             (select en ->> 'details'
                from jsonb_each(d -> 'client_workflow_templates') tpl,
                     jsonb_array_elements(tpl.value) en
               where starts_with(public.workflow_match_normalize(c.title),
                                 public.workflow_match_normalize(en ->> 'match'))
               order by length(en ->> 'match') desc
               limit 1) as details
        from public.client_tasks c
       where coalesce(btrim(c.details), '') = ''
    ) sub
   where ct.id = sub.id and sub.details is not null;
end;
$mig$;

-- Conferência: itens de cada modelo com e sem details.
select 'Workflow de Atividades' as tipo, t.name as modelo,
       count(*) filter (where coalesce(btrim(it ->> 'details'), '') <> '') as com_details,
       count(*) filter (where coalesce(btrim(it ->> 'details'), '') = '') as sem_details
  from public.activity_templates t, jsonb_array_elements(t.items) it
 group by t.name
union all
select 'Workflow do Cliente', t.name,
       count(*) filter (where coalesce(btrim(st ->> 'details'), '') <> ''),
       count(*) filter (where coalesce(btrim(st ->> 'details'), '') = '')
  from public.client_workflow_templates t, jsonb_array_elements(t.steps) st
 group by t.name
 order by 1, 2;
`

writeFileSync(OUTPUT, sql, 'utf8')
console.log(`Gerado: ${OUTPUT}`)
