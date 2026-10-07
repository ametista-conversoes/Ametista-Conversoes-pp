-- Ametista Conversões — Fase 48.11 (opcional): exclusividade por plano em
-- Workflows do Cliente, replicando o que já existe em Workflow de
-- Atividades desde a Fase 29 (migration-054).
--
-- Como usar: copie todo este arquivo e cole no SQL Editor do painel do
-- Supabase (SQL Editor > New query), depois clique em "Run". Seguro
-- rodar de novo (idempotente).
--
-- Contexto: cada etapa de `client_workflow_templates.steps` (jsonb) ganha
-- um campo `plan_scope` (array de texto, valores de `clients.plan`:
-- 'validacao'/'escala'/'dominacao'). Ao aplicar o Workflow do Cliente
-- (apply_client_workflow), só cria a tarefa se o plano do cliente
-- estiver no plan_scope da etapa. Cliente sem plano definido (null) ou
-- etapa sem plan_scope (dado antigo) continua recebendo todas as
-- etapas — fail open, mesmo comportamento de antes desta fase.

-- =========================================================
-- 1. Backfill: toda etapa já existente passa a ter os 3 planos marcados
--    (equivalente a "vale pra todos", o comportamento que já tinham).
-- =========================================================
update public.client_workflow_templates
set steps = (
  select coalesce(jsonb_agg(
    case
      when step ? 'plan_scope' then step
      else step || jsonb_build_object('plan_scope', '["validacao", "escala", "dominacao"]'::jsonb)
    end
  ), '[]'::jsonb)
  from jsonb_array_elements(steps) as step
)
where steps <> '[]'::jsonb;

-- =========================================================
-- 2. apply_client_workflow — mesma checagem de plan_scope que
--    apply_workflow já faz pros itens de Workflow de Atividades, só que
--    aqui o plano precisa ser buscado DENTRO do loop de clientes (um
--    único modelo pode ser aplicado a vários clientes de planos
--    diferentes de uma vez, via ApplyClientWorkflowDialog).
-- =========================================================
create or replace function public.apply_client_workflow(p_client_ids uuid[], p_template_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
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

      insert into public.client_tasks (title, category, client_id, project_id, status, due_date, recurrence_interval)
      values (step ->> 'title', step ->> 'category', v_client_id, null, 'backlog', v_due_date, step ->> 'recurrence');
    end loop;

    insert into public.audit_logs (action, entity_type, entity_id, client_id, severity)
    values ('Workflow de cliente "' || v_name || '" aplicado', 'client', v_client_id, v_client_id, 'low');
  end loop;
end;
$$;
