-- Ametista Conversões — Rastreamento GA4 + Tag Manager (Setup) e Rotina do GA4.
--
-- Como usar: copie todo este arquivo e cole no SQL Editor do painel do
-- Supabase (SQL Editor > New query), depois clique em "Run".
-- Seguro rodar de novo: só cria cada modelo se ainda não existir um
-- com o mesmo nome. Não mexe em nenhum Workflow já existente.
--
-- Cria:
--   2 Workflows de Atividades novos (checklist interno do gestor)
--     • "2.5 — Rastreamento GA4 + Tag Manager"   (Setup, única vez)
--     • "5.4 — Rotina do GA4 (recorrente)"        (depois que os anúncios rodam)
--   1 Workflow do Cliente (tarefas que aparecem no Portal Cliente)
--     • "2.4 — Acessos do Google Analytics e Tag Manager"
--
-- Depois de rodar: em Workflows → Operacional, edite o Workflow
-- Operacional de cada etapa e vincule o Workflow de Atividades novo
-- (2.5 na etapa 2 "Criação da base", logo depois do 2.4, e
-- 5.4 na etapa 5 "Otimização e Remarketing").
-- Versão enxuta. Guia de cada item: nota do Obsidian "Rastreamento GA4 + Tag Manager (modelo)".
--
-- Campos de cada item: title, category, plan_scope (validacao/escala/
-- dominacao), platform_scope (meta/google — só filtra cliente Validação),
-- recurrence (null = única; '7'/'15'/'30'/'cadencia_reuniao'/
-- 'cadencia_otimizacao').

-- =========================================================
-- 1. 2.5 — Rastreamento GA4 + Tag Manager (Setup)
-- =========================================================
insert into public.activity_templates (name, description, items)
select
  '2.5 — Rastreamento GA4 + Tag Manager',
  'Entrega (a) do Setup (2.1.2): contas no nome do cliente, Tag Manager na landing page, eventos de lead, integração com o Google Ads e validação. Contas no D1–D2; instalação e testes junto da landing page (D6–D8). Guia: nota Rastreamento GA4 + Tag Manager (modelo).',
  '[
    {"title": "Criar a conta do GA4 e do Tag Manager no e-mail Google do cliente (cliente dono, agência como Administrador)", "category": "GA4 — Contas", "plan_scope": ["validacao", "escala", "dominacao"], "platform_scope": ["meta", "google"], "recurrence": null},
    {"title": "Criar a propriedade GA4 com o nome do cliente, fuso horário dele e moeda BRL", "category": "GA4 — Contas", "plan_scope": ["validacao", "escala", "dominacao"], "platform_scope": ["meta", "google"], "recurrence": null},
    {"title": "Criar o fluxo de dados Web com o domínio da landing page e registrar o ID G-XXXX em Ativos Digitais", "category": "GA4 — Contas", "plan_scope": ["validacao", "escala", "dominacao"], "platform_scope": ["meta", "google"], "recurrence": null},
    {"title": "Retenção de dados em 14 meses e Medição otimizada ligada", "category": "GA4 — Contas", "plan_scope": ["validacao", "escala", "dominacao"], "platform_scope": ["meta", "google"], "recurrence": null},
    {"title": "Excluir visitas internas: cadastrar o IP da recepção do cliente em Definir tráfego interno e ativar o filtro Internal Traffic", "category": "GA4 — Contas", "plan_scope": ["validacao", "escala", "dominacao"], "platform_scope": ["meta", "google"], "recurrence": null},
    {"title": "Criar o contêiner Web do Tag Manager e registrar o ID GTM-XXXX em Ativos Digitais", "category": "Tag Manager", "plan_scope": ["validacao", "escala", "dominacao"], "platform_scope": ["meta", "google"], "recurrence": null},
    {"title": "Instalar o Tag Manager na landing page (WordPress: plugin GTM4WP) — sem GA4 ou tag do Ads colados direto no código", "category": "Tag Manager", "plan_scope": ["validacao", "escala", "dominacao"], "platform_scope": ["meta", "google"], "recurrence": null},
    {"title": "Tag Manager: Google tag com o ID G-XXXX e Vinculador de conversões em todas as páginas", "category": "Tag Manager", "plan_scope": ["validacao", "escala", "dominacao"], "platform_scope": ["meta", "google"], "recurrence": null},
    {"title": "Tag Manager: ativar as variáveis integradas de Cliques e de Formulários", "category": "Tag Manager", "plan_scope": ["validacao", "escala", "dominacao"], "platform_scope": ["meta", "google"], "recurrence": null},
    {"title": "Tag Manager: evento generate_lead só no envio com sucesso do formulário", "category": "Eventos", "plan_scope": ["validacao", "escala", "dominacao"], "platform_scope": ["meta", "google"], "recurrence": null},
    {"title": "Tag Manager: eventos whatsapp_click (link wa.me) e phone_click (link tel:)", "category": "Eventos", "plan_scope": ["validacao", "escala", "dominacao"], "platform_scope": ["meta", "google"], "recurrence": null},
    {"title": "Passar o Pixel do Meta para dentro do Tag Manager e tirar o código colado na página (evita contar em dobro)", "category": "Eventos", "plan_scope": ["validacao", "escala", "dominacao"], "platform_scope": ["meta"], "recurrence": null},
    {"title": "Meta: usar utm_content={{ad.name}} e utm_source/utm_medium padrão nos anúncios (Dicionário de Nomenclatura)", "category": "Eventos", "plan_scope": ["validacao", "escala", "dominacao"], "platform_scope": ["meta"], "recurrence": null},
    {"title": "GA4: marcar como evento-chave só generate_lead, whatsapp_click e phone_click", "category": "Eventos", "plan_scope": ["validacao", "escala", "dominacao"], "platform_scope": ["meta", "google"], "recurrence": null},
    {"title": "Vincular o GA4 ao Google Ads (pela MCC da agência) e confirmar o Autotag ligado", "category": "Google Ads", "plan_scope": ["validacao", "escala", "dominacao"], "platform_scope": ["google"], "recurrence": null},
    {"title": "Google Ads: conversão principal Lead – Formulário, com a tag do Ads no Tag Manager no mesmo acionador do generate_lead", "category": "Google Ads", "plan_scope": ["validacao", "escala", "dominacao"], "platform_scope": ["google"], "recurrence": null},
    {"title": "Google Ads: Clique WhatsApp como conversão secundária", "category": "Google Ads", "plan_scope": ["validacao", "escala", "dominacao"], "platform_scope": ["google"], "recurrence": null},
    {"title": "Google Ads: ativar as Conversões otimizadas na conversão de formulário (não importar eventos do GA4 como conversão)", "category": "Google Ads", "plan_scope": ["validacao", "escala", "dominacao"], "platform_scope": ["google"], "recurrence": null},
    {"title": "Publicar a política de privacidade na landing page citando GA4, Google Ads e Pixel do Meta", "category": "LGPD", "plan_scope": ["validacao", "escala", "dominacao"], "platform_scope": ["meta", "google"], "recurrence": null},
    {"title": "Testar no modo Visualizar do Tag Manager e no DebugView do GA4, no celular e no computador: formulário, WhatsApp e telefone", "category": "Validação", "plan_scope": ["validacao", "escala", "dominacao"], "platform_scope": ["meta", "google"], "recurrence": null},
    {"title": "Publicar a versão do Tag Manager com nome descritivo (ex.: v1 — Setup GA4 + eventos de lead)", "category": "Validação", "plan_scope": ["validacao", "escala", "dominacao"], "platform_scope": ["meta", "google"], "recurrence": null},
    {"title": "Conferir em 24–48h os eventos-chave no GA4 e o status Gravando conversões no Google Ads", "category": "Validação", "plan_scope": ["validacao", "escala", "dominacao"], "platform_scope": ["meta", "google"], "recurrence": null},
    {"title": "Registrar nos Comentários a entrega do rastreamento (entrega a do Setup) com os IDs G- e GTM-", "category": "Validação", "plan_scope": ["validacao", "escala", "dominacao"], "platform_scope": ["meta", "google"], "recurrence": null}
  ]'::jsonb
where not exists (
  select 1 from public.activity_templates where name = '2.5 — Rastreamento GA4 + Tag Manager'
);

-- =========================================================
-- 2. 5.4 — Rotina do GA4 (recorrente)
--    7 dias = saúde da medição · cadência de otimização = leitura para a
--    Análise do gestor · 30 dias = auditoria e públicos.
-- =========================================================
insert into public.activity_templates (name, description, items)
select
  '5.4 — Rotina do GA4 (recorrente)',
  'Versão enxuta: saúde da medição toda semana, 1 leitura do GA4 por ciclo de otimização e auditoria rápida mensal. Alimenta a Análise do gestor e os Incidentes.',
  '[
    {"title": "Conferir se os eventos de lead registraram nos últimos 7 dias — se zerou com campanha ativa, abrir Incidente", "category": "Monitoramento", "plan_scope": ["validacao", "escala", "dominacao"], "platform_scope": ["meta", "google"], "recurrence": "7"},
    {"title": "Conferir o status das conversões no Google Ads (Gravando / Sem conversões recentes / Inativa)", "category": "Monitoramento", "plan_scope": ["validacao", "escala", "dominacao"], "platform_scope": ["google"], "recurrence": "7"},
    {"title": "GA4: taxa de evento-chave por dispositivo (celular x computador) e por origem — levar 1 conclusão para a Análise do gestor", "category": "Análise", "plan_scope": ["validacao", "escala", "dominacao"], "platform_scope": ["meta", "google"], "recurrence": "cadencia_otimizacao"},
    {"title": "Auditoria rápida: filtro de tráfego interno ativo, IP do cliente atual, eventos-chave e versão do Tag Manager com nome", "category": "Auditoria", "plan_scope": ["validacao", "escala", "dominacao"], "platform_scope": ["meta", "google"], "recurrence": "30"}
  ]'::jsonb
where not exists (
  select 1 from public.activity_templates where name = '5.4 — Rotina do GA4 (recorrente)'
);

-- =========================================================
-- 3. Workflow do Cliente — tarefas que aparecem no Portal Cliente.
--    due_days = prazo em dias corridos a partir de quando você aplicar.
-- =========================================================
insert into public.client_workflow_templates (name, description, steps)
select
  '2.4 — Acessos do Google Analytics e Tag Manager',
  'O que o cliente faz para o rastreamento ficar pronto no prazo do Setup (contas no nome dele, agência como Administrador).',
  '[
    {"title": "Informar o e-mail Google do negócio para criarmos nele o Google Analytics e o Tag Manager (você fica como dono)", "category": "Rastreamento", "due_days": 2, "recurrence": null, "plan_scope": ["validacao", "escala", "dominacao"]},
    {"title": "Aceitar o convite e manter o e-mail da agência como Administrador no Google Analytics e no Tag Manager", "category": "Rastreamento", "due_days": 3, "recurrence": null, "plan_scope": ["validacao", "escala", "dominacao"]},
    {"title": "Mandar o IP da internet da recepção: pesquise qual é meu ip no computador de lá e envie um print", "category": "Rastreamento", "due_days": 3, "recurrence": null, "plan_scope": ["validacao", "escala", "dominacao"]},
    {"title": "Avisar se o site usa outros sistemas que precisam ser medidos (agenda online, chat, checkout)", "category": "Rastreamento", "due_days": 3, "recurrence": null, "plan_scope": ["validacao", "escala", "dominacao"]}
  ]'::jsonb
where not exists (
  select 1 from public.client_workflow_templates where name = '2.4 — Acessos do Google Analytics e Tag Manager'
);
