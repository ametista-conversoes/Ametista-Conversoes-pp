-- Ametista Conversões — Fase 62: revisão dos itens com ⚠️ nos detalhes dos
-- Workflows de Atividades (pedido do usuário: itens 1, 2 e 4).
--
-- Muda SÓ os modelos (`activity_templates.items`) — vale pros workflows
-- aplicados daqui pra frente. As cópias já aplicadas a clientes
-- (`activity_checklist_items`) ficam como estão (histórico).
--
-- 1. Relatórios: o contrato chama de "relatório" (4.2-II e 4.2-VI; Validação
--    "relatório mensal", Escala "análise quinzenal (relatório)"). O termo
--    fica; o detalhe explica que o relatório é a Análise do gestor publicada
--    no app, com o conteúdo mínimo do 4.2-VI. Sai o aviso "Desatualizado".
-- 2. Modelo do site: sai o Lovable (gera app React, não WordPress); o modelo
--    é no Figma e o site é montado no Elementor.
-- 4. Rotina de sexta: o cliente registra a contagem no card "Etiquetas da
--    semana" (Fase 59) — cobre o lead que chega só pelo WhatsApp.

create or replace function pg_temp.set_item(p_template text, p_old_title text, p_new_title text, p_details text)
returns void
language plpgsql
as $$
declare
  v_found integer;
begin
  update public.activity_templates t
     set items = (
           select jsonb_agg(
                    case when e->>'title' = p_old_title
                         then e || jsonb_build_object('title', p_new_title, 'details', p_details)
                         else e end
                    order by ord)
           from jsonb_array_elements(t.items) with ordinality as x(e, ord)
         ),
         updated_at = now()
   where t.name = p_template
     and exists (select 1 from jsonb_array_elements(t.items) e where e->>'title' = p_old_title);
  get diagnostics v_found = row_count;
  if v_found <> 1 then
    raise exception 'Item não encontrado: % / %', p_template, p_old_title;
  end if;
end;
$$;

-- ---------------------------------------------------------- 1. relatórios
select pg_temp.set_item(
  '1.2 — Processo de Conversão e Alinhamento',
  'Definir e comunicar os dias de envio e conteúdo dos relatórios',
  'Definir e comunicar os dias de envio e conteúdo dos relatórios',
  E'O relatório do contrato (4.2-II e 4.2-VI) é a Análise do gestor publicada no app: mensal no Validação, quinzenal no Escala e semanal no Dominação. O dashboard fica sempre disponível para o cliente; o relatório é a leitura do gestor sobre o período.\nCombine no alinhamento o dia em que o relatório sai e registre no Plano de 90 dias.\nConteúdo mínimo (4.2-VI): investimento, impressões, cliques, CTR, CPC, leads, custo por lead, vendas informadas pelo cliente, CPA e ROAS (quando houver vendas), otimizações do período e próximos passos.'
);

select pg_temp.set_item(
  '5.2 — Rotina Mensal',
  'Preparar e enviar relatório mensal',
  'Preparar e enviar o relatório mensal (Análise do gestor)',
  E'Relatório mensal do contrato (4.2-II): publique a Análise do gestor do mês na ficha do cliente. No Escala e no Dominação, é a análise mensal estratégica.\nConteúdo mínimo (4.2-VI): investimento, impressões, cliques, CTR, CPC, leads, custo por lead, vendas informadas pelo cliente, CPA e ROAS (quando houver vendas), otimizações do período e próximos passos. Seções: nota ''Workflows do Cliente e Relatórios''.\nAntes, confira se o cliente informou as vendas do mês (sem elas, receita e ROAS ficam em branco).'
);

select pg_temp.set_item(
  '5.2 — Rotina Mensal',
  'Preparar e enviar o relatório quinzenal',
  'Preparar e enviar o relatório quinzenal (Análise do gestor)',
  E'Plano Escala: "análise quinzenal (relatório)" do contrato. Publique a Análise do gestor das duas últimas semanas, com o conteúdo mínimo do 4.2-VI: o que mudou nos números, o que foi otimizado e os próximos passos.'
);

select pg_temp.set_item(
  '5.2 — Rotina Mensal',
  'Preparar e enviar o relatório semanal',
  'Preparar e enviar o relatório semanal (Análise do gestor)',
  E'Plano Dominação: acompanhamento semanal do contrato. Publique uma Análise do gestor curta da semana, com os indicadores do 4.2-VI, as otimizações feitas e os próximos passos. A leitura estratégica fica no relatório mensal.'
);

-- ------------------------------------------------------ 2. modelo do site
select pg_temp.set_item(
  '3.2 — Site e Formulário',
  'Montar o modelo do site no claude ( baseado em paginad de concorrentes do nicho bem feitas), passar para o lovable, aperfeiçoar o design com modelos bem feitos.',
  'Montar o modelo do site no Figma (baseado em páginas bem feitas de concorrentes do nicho) e aperfeiçoar o design com bons modelos',
  E'Os sites dos clientes são WordPress + Elementor em hospedagem. O cliente aprova o modelo no Figma (Workflow do Cliente 3.2) e só depois o site é montado no Elementor: é isso que permite usar o GTM4WP e o formulário do Elementor ligado ao app.\nO Claude pode ajudar com a estrutura e os textos do rascunho.'
);

-- ------------------------------------------------- 4. rotina de sexta (etiquetas)
select pg_temp.set_item(
  '5.3 — Acompanhamento do Kit de Atendimento',
  'Conferir se o cliente registrou na aba Leads os qualificados do WhatsApp (rotina de sexta — item 4.1-VI)',
  'Conferir se o cliente registrou as etiquetas da semana no app (rotina de sexta — item 4.1-VI)',
  E'Toda sexta o cliente conta as conversas por etiqueta no WhatsApp Business (Novo, Qualificado, Agendado, Venda, Perdido) e digita os números no card "Etiquetas da semana" do Dashboard dele (cerca de 1 minuto). As vendas das semanas viram as "Vendas do mês".\nConfira na ficha do cliente, no card "Etiquetas do WhatsApp". Se a semana não estiver lá, lembre o cliente.\nO lead que chega só pelo WhatsApp entra no funil por essa contagem: não precisa registrar um por um.'
);
