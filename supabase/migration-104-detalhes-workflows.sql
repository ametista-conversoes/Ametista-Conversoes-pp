-- Ametista Conversões — Fase 56: campo "Detalhes" nos itens dos Workflows.
--
-- Como usar: rode no SQL Editor do Supabase (ou `npx supabase db query
-- --linked -f`). Seguro rodar de novo. Rode ANTES da migration-105 (dados).
--
-- 1. `details` (texto puro) nas instâncias: `activity_checklist_items` e
--    `client_tasks`. Nos modelos, `details` é uma chave opcional de cada item
--    do jsonb (`activity_templates.items`, `client_workflow_templates.steps`).
-- 2. `workflow_match_normalize(text)` — minúsculas, sem acento, espaços
--    colapsados (o projeto não tem `unaccent`). Espelha `normalizeMatch` em
--    `scripts/gerar-migration-detalhes-workflows.mjs`.
-- 3. As 3 funções que copiam modelo -> instância (versões mais recentes, sem
--    mudar mais nada no comportamento) passam a copiar `details` também:
--    apply_workflow (6 argumentos — a que o app chama), apply_client_workflow
--    e handle_new_client_activity_template. Editar o modelo depois não muda
--    instâncias já aplicadas (igual ao título).

alter table public.activity_checklist_items add column if not exists details text;
alter table public.client_tasks add column if not exists details text;

create or replace function public.workflow_match_normalize(t text)
returns text
language sql
immutable
set search_path = public
as $$
  select btrim(regexp_replace(lower(translate(coalesce(t, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')), '\s+', ' ', 'g'))
$$;

CREATE OR REPLACE FUNCTION public.apply_workflow(p_client_id uuid, p_project_id uuid, p_workflow_name text, p_steps jsonb, p_activity_template_ids uuid[] DEFAULT '{}'::uuid[], p_target text DEFAULT 'kanban'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  step jsonb;
  v_due_date date;
  v_client_plan text;
  v_activity_template_id uuid;
  v_activity_items jsonb;
  v_activity_name text;
  activity_item jsonb;
  v_item_scope jsonb;
  v_platform_scope text[];
  i int;
begin
  if public.current_user_role() not in ('admin', 'gestor') then
    raise exception 'Não autorizado';
  end if;

  if p_target <> 'kanban' then
    raise exception 'Destino inválido — o Workflow Operacional só cria tarefas internas do Kanban. Pra mandar tarefa pro Portal Cliente, use Workflows do Cliente.';
  end if;

  select plan into v_client_plan from public.clients where id = p_client_id;

  for step in select * from jsonb_array_elements(p_steps)
  loop
    v_due_date := case
      when (step ->> 'due_days') is not null
        then ((now() at time zone 'America/Sao_Paulo')::date + ((step ->> 'due_days')::int))
      else null
    end;

    insert into public.tasks (title, category, client_id, project_id, status, due_date)
    values (step ->> 'title', step ->> 'category', p_client_id, p_project_id, 'backlog', v_due_date);
  end loop;

  insert into public.audit_logs (action, entity_type, entity_id, client_id, severity)
  values ('Workflow "' || p_workflow_name || '" aplicado', 'project', p_project_id, p_client_id, 'low');

  i := 0;
  foreach v_activity_template_id in array p_activity_template_ids
  loop
    select name, items into v_activity_name, v_activity_items
      from public.activity_templates where id = v_activity_template_id;
    if v_activity_items is null then
      continue;
    end if;

    for activity_item in select * from jsonb_array_elements(v_activity_items)
    loop
      v_item_scope := activity_item -> 'plan_scope';
      if v_client_plan is not null and v_item_scope is not null and not (v_item_scope ? v_client_plan) then
        i := i + 1;
        continue;
      end if;

      select coalesce(array_agg(x), array['meta', 'google'])
        into v_platform_scope
        from jsonb_array_elements_text(activity_item -> 'platform_scope') as x;

      insert into public.activity_checklist_items
        (client_id, project_id, title, category, step_order, source_activity_template_id, source_template_name,
         platform_scope, recurrence_interval, details)
      values
        (p_client_id, p_project_id, activity_item ->> 'title', activity_item ->> 'category', i,
         v_activity_template_id, v_activity_name, v_platform_scope, activity_item ->> 'recurrence',
         nullif(btrim(activity_item ->> 'details'), ''));
      i := i + 1;
    end loop;
  end loop;
end;
$function$;

CREATE OR REPLACE FUNCTION public.apply_client_workflow(p_client_ids uuid[], p_template_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_name text;
  v_steps jsonb;
  v_client_id uuid;
  v_client_plan text;
  step jsonb;
  v_due_date date;
  v_step_scope jsonb;
begin
  if public.current_user_role() not in ('admin', 'gestor') then
    raise exception 'Não autorizado';
  end if;

  select name, steps into v_name, v_steps from public.client_workflow_templates where id = p_template_id;
  if v_name is null then
    raise exception 'Modelo não encontrado';
  end if;

  foreach v_client_id in array p_client_ids
  loop
    select plan into v_client_plan from public.clients where id = v_client_id;

    for step in select * from jsonb_array_elements(v_steps)
    loop
      v_step_scope := step -> 'plan_scope';
      if v_client_plan is not null and v_step_scope is not null and not (v_step_scope ? v_client_plan) then
        continue;
      end if;

      v_due_date := case
        when (step ->> 'due_days') is not null
          then ((now() at time zone 'America/Sao_Paulo')::date + ((step ->> 'due_days')::int))
        else null
      end;

      insert into public.client_tasks (title, category, client_id, project_id, status, due_date, recurrence_interval, details)
      values (step ->> 'title', step ->> 'category', v_client_id, null, 'backlog', v_due_date, step ->> 'recurrence',
              nullif(btrim(step ->> 'details'), ''));
    end loop;

    insert into public.audit_logs (action, entity_type, entity_id, client_id, severity)
    values ('Workflow de cliente "' || v_name || '" aplicado', 'client', v_client_id, v_client_id, 'low');
  end loop;
end;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_client_activity_template()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_template_id uuid;
  v_name text;
  v_items jsonb;
  item jsonb;
  v_item_scope jsonb;
  v_platform_scope text[];
  i int := 0;
begin
  select id, name, items into v_template_id, v_name, v_items
    from public.activity_templates where is_default limit 1;

  if v_template_id is null then
    return new;
  end if;

  for item in select * from jsonb_array_elements(v_items)
  loop
    v_item_scope := item -> 'plan_scope';
    if new.plan is not null and v_item_scope is not null and not (v_item_scope ? new.plan) then
      i := i + 1;
      continue;
    end if;

    select coalesce(array_agg(x), array['meta', 'google'])
      into v_platform_scope
      from jsonb_array_elements_text(item -> 'platform_scope') as x;

    insert into public.activity_checklist_items
      (client_id, project_id, title, category, step_order, source_activity_template_id, source_template_name,
       platform_scope, recurrence_interval, details)
    values
      (new.id, null, item ->> 'title', item ->> 'category', i, v_template_id, v_name, v_platform_scope, item ->> 'recurrence',
       nullif(btrim(item ->> 'details'), ''));
    i := i + 1;
  end loop;

  return new;
end;
$function$;
