-- Ametista Conversões — Kit de Atendimento + Landing Page do Setup
-- (contrato itens 1.6, 1.7, 4.1-IV/VI, 4.2-IV; Anexo I por plano).
--
-- Como usar: copie todo este arquivo e cole no SQL Editor do painel do
-- Supabase (SQL Editor > New query), depois clique em "Run".
-- Seguro rodar de novo: só cria cada modelo se ainda não existir um
-- com o mesmo nome. Não mexe em nenhum Workflow já existente.
--
-- Cria:
--   2 Workflows de Atividades novos (checklist interno do gestor)
--     • "2.4 — Kit de Atendimento (WhatsApp Business)"
--     • "5.3 — Acompanhamento do Kit de Atendimento"
--   + acrescenta 6 itens no fim do 3.2 "Site e Formulário" já existente
--   1 Workflow do Cliente (tarefas que aparecem no Portal Cliente)
--     • "Setup — Tarefas do cliente (Kit + Landing Page)"
--
-- Depois de rodar: em Workflows → Operacional, edite o Workflow
-- Operacional de cada etapa e vincule o Workflow de Atividades novo
-- (2.4 na etapa 2 "Criação da base" e
-- 5.3 na etapa 5 "Otimização e Remarketing"), arrastando pra ordem certa.
--
-- Campos de cada item: title, category, plan_scope (validacao/escala/
-- dominacao), platform_scope (meta/google — só filtra cliente Validação),
-- recurrence (null = única; '7'/'15'/'30'/'cadencia_reuniao'/
-- 'cadencia_otimizacao').

-- =========================================================
-- 1. 2.4 — Kit de Atendimento (WhatsApp Business)
-- =========================================================
insert into public.activity_templates (name, description, items)
select
  '2.4 — Kit de Atendimento (WhatsApp Business)',
  'Contrato item 1.6. Configuração única no Setup, em sessão com o cliente (celular em mãos). Modelo completo: nota "Kit de Atendimento (modelo)".',
  '[
    {"title": "Enviar ao cliente o formulário pré-sessão do Kit (2 dias antes da sessão)", "category": "Kit de Atendimento", "plan_scope": ["validacao","escala","dominacao"], "platform_scope": ["meta","google"], "recurrence": null},
    {"title": "Confirmar pré-requisitos: número dedicado, app WhatsApp Business, backup do WhatsApp antigo, logo e celular em mãos no dia", "category": "Kit de Atendimento", "plan_scope": ["validacao","escala","dominacao"], "platform_scope": ["meta","google"], "recurrence": null},
    {"title": "Preparar textos do perfil, saudação, ausência e as 10 respostas rápidas a partir do formulário", "category": "Kit de Atendimento", "plan_scope": ["validacao","escala","dominacao"], "platform_scope": ["meta","google"], "recurrence": null},
    {"title": "Adaptar o roteiro de atendimento ao nicho do cliente (Google Docs em nome dele)", "category": "Kit de Atendimento", "plan_scope": ["validacao","escala","dominacao"], "platform_scope": ["meta","google"], "recurrence": null},
    {"title": "Agendar a sessão de configuração do Kit (40 min) com o cliente", "category": "Kit de Atendimento", "plan_scope": ["validacao","escala","dominacao"], "platform_scope": ["meta","google"], "recurrence": null},
    {"title": "Configurar perfil comercial: foto, categoria, descrição, horário, endereço, e-mail e links (1.6 a)", "category": "Kit de Atendimento", "plan_scope": ["validacao","escala","dominacao"], "platform_scope": ["meta","google"], "recurrence": null},
    {"title": "Ativar mensagem de saudação e mensagem de ausência fora do horário (1.6 b)", "category": "Kit de Atendimento", "plan_scope": ["validacao","escala","dominacao"], "platform_scope": ["meta","google"], "recurrence": null},
    {"title": "Criar as 10 respostas rápidas padrão: /ola /qualifica /valor /agenda /confirma /endereco /pagamento /lembrete /follow1 /follow2 (1.6 c)", "category": "Kit de Atendimento", "plan_scope": ["validacao","escala","dominacao"], "platform_scope": ["meta","google"], "recurrence": null},
    {"title": "Criar etiquetas Novo, Qualificado, Agendado, Venda e Perdido e apagar as etiquetas padrão do app (1.6 d)", "category": "Kit de Atendimento", "plan_scope": ["validacao","escala","dominacao"], "platform_scope": ["meta","google"], "recurrence": null},
    {"title": "Criar respostas rápidas de pós-venda (/pos /avaliacao /indicacao /retorno /reativa) e etiquetas Cliente ativo e Reativar", "category": "Kit de Atendimento", "plan_scope": ["dominacao"], "platform_scope": ["meta","google"], "recurrence": null},
    {"title": "Gerar links wa.me com mensagem pré-preenchida por origem: landing page, bio do Instagram (1.6 e)", "category": "Kit de Atendimento", "plan_scope": ["validacao","escala","dominacao"], "platform_scope": ["meta","google"], "recurrence": null},
    {"title": "Gerar link wa.me de origem Google Ads (anúncios e extensões)", "category": "Kit de Atendimento", "plan_scope": ["validacao","escala","dominacao"], "platform_scope": ["google"], "recurrence": null},
    {"title": "Vincular o WhatsApp à Página do Facebook no Business Manager (anúncios de clique para WhatsApp)", "category": "Kit de Atendimento", "plan_scope": ["validacao","escala","dominacao"], "platform_scope": ["meta"], "recurrence": null},
    {"title": "Entregar o roteiro de atendimento ao cliente (1.6 f)", "category": "Kit de Atendimento", "plan_scope": ["validacao","escala","dominacao"], "platform_scope": ["meta","google"], "recurrence": null},
    {"title": "Treinar cliente/equipe (até 30 min): atalhos, etiquetas, regra dos 15 minutos e rotina de sexta (1.6 g)", "category": "Kit de Atendimento", "plan_scope": ["validacao","escala","dominacao"], "platform_scope": ["meta","google"], "recurrence": null},
    {"title": "Registrar a entrega do Kit nos Comentários da plataforma (texto-modelo da nota) — comprovante do item 1.5", "category": "Kit de Atendimento", "plan_scope": ["validacao","escala","dominacao"], "platform_scope": ["meta","google"], "recurrence": null}
  ]'::jsonb
where not exists (
  select 1 from public.activity_templates where name = '2.4 — Kit de Atendimento (WhatsApp Business)'
);

-- =========================================================
-- 2. Complementa o 3.2 "Site e Formulário" JÁ EXISTENTE (não cria
--    workflow novo). Acrescenta no fim da lista só o que o item 1.7 do
--    contrato exige e o 3.2 ainda não tinha. Cada item só entra se ainda
--    não existir um com o mesmo título (seguro rodar de novo).
-- =========================================================
update public.activity_templates t
set items = t.items || (
  select coalesce(jsonb_agg(novo), '[]'::jsonb)
  from jsonb_array_elements('[
    {"title": "Aplicar ajustes pedidos pelo cliente — até 2 rodadas antes da publicação (o que passar disso é orçamento à parte)", "category": "Landing Page", "plan_scope": ["validacao","escala","dominacao"], "platform_scope": ["meta","google"], "recurrence": null},
    {"title": "Colocar na página o botão de WhatsApp (link wa.me de origem landing page do Kit)", "category": "Landing Page", "plan_scope": ["validacao","escala","dominacao"], "platform_scope": ["meta","google"], "recurrence": null},
    {"title": "Conferir o Pixel do Meta e os eventos disparando na página publicada", "category": "Landing Page", "plan_scope": ["validacao","escala","dominacao"], "platform_scope": ["meta"], "recurrence": null},
    {"title": "Conferir a Tag do Google Ads e as conversões disparando na página publicada", "category": "Landing Page", "plan_scope": ["validacao","escala","dominacao"], "platform_scope": ["google"], "recurrence": null},
    {"title": "Testar formulário e botão de WhatsApp no celular e no computador", "category": "Landing Page", "plan_scope": ["validacao","escala","dominacao"], "platform_scope": ["meta","google"], "recurrence": null},
    {"title": "Publicar a página dentro do prazo do Setup e registrar em Ativos Digitais", "category": "Landing Page", "plan_scope": ["validacao","escala","dominacao"], "platform_scope": ["meta","google"], "recurrence": null}
  ]'::jsonb) as novo
  where not exists (
    select 1 from jsonb_array_elements(t.items) as atual
    where atual ->> 'title' = novo ->> 'title'
  )
)
where t.name = '3.2 — Site e Formulário';

-- =========================================================
-- 3. 5.3 — Acompanhamento do Kit de Atendimento (pós-entrega)
-- =========================================================
insert into public.activity_templates (name, description, items)
select
  '5.3 — Acompanhamento do Kit de Atendimento',
  'Contrato itens 1.6.1 (ajuste incluso até o mês 2), 4.1-IV/VI (resposta em 15 min e status de leads) e Anexo I (revisão no Escala, pós-venda no Dominação).',
  '[
    {"title": "Conferir se o cliente registrou na aba Leads os qualificados do WhatsApp (rotina de sexta — item 4.1-VI)", "category": "Acompanhamento", "plan_scope": ["validacao","escala","dominacao"], "platform_scope": ["meta","google"], "recurrence": "7"},
    {"title": "Checar leads parados em Novo e tempo de resposta (regra dos 15 min) e levar para a reunião", "category": "Acompanhamento", "plan_scope": ["validacao","escala","dominacao"], "platform_scope": ["meta","google"], "recurrence": "cadencia_reuniao"},
    {"title": "Aplicar o ajuste incluso do Kit — até o fim do mês 2 (item 1.6.1)", "category": "Acompanhamento", "plan_scope": ["validacao","escala","dominacao"], "platform_scope": ["meta","google"], "recurrence": null},
    {"title": "Calcular conversão do mês 1 pelas etiquetas: leads → qualificados → agendados → vendas", "category": "Acompanhamento", "plan_scope": ["escala","dominacao"], "platform_scope": ["meta","google"], "recurrence": null},
    {"title": "Revisar o roteiro de atendimento na etapa em que a conversão mais cai (versão 2) e registrar na plataforma", "category": "Acompanhamento", "plan_scope": ["escala","dominacao"], "platform_scope": ["meta","google"], "recurrence": null},
    {"title": "Revisar mensagens de pós-venda e reativação com base nos clientes ativos e inativos", "category": "Pós-venda", "plan_scope": ["dominacao"], "platform_scope": ["meta","google"], "recurrence": "30"}
  ]'::jsonb
where not exists (
  select 1 from public.activity_templates where name = '5.3 — Acompanhamento do Kit de Atendimento'
);

-- =========================================================
-- 4. Workflow do Cliente — tarefas que aparecem no Portal Cliente.
--    (client_workflow_templates não tem plan_scope: vale pra todos.)
--    due_days = prazo em dias corridos a partir de quando você aplicar.
-- =========================================================
insert into public.client_workflow_templates (name, description, steps)
select
  'Setup — Tarefas do cliente (Kit + Landing Page)',
  'O que o cliente precisa fazer para o Kit de Atendimento e a landing page ficarem prontos no prazo do Setup.',
  '[
    {"title": "Responder o formulário pré-sessão do Kit de Atendimento", "category": "Kit de Atendimento", "due_days": 2, "recurrence": null},
    {"title": "Separar número dedicado com WhatsApp Business instalado e fazer backup do WhatsApp antigo", "category": "Kit de Atendimento", "due_days": 2, "recurrence": null},
    {"title": "Enviar a logo em boa resolução", "category": "Kit de Atendimento", "due_days": 2, "recurrence": null},
    {"title": "Participar da sessão de configuração do Kit com o celular em mãos", "category": "Kit de Atendimento", "due_days": 5, "recurrence": null},
    {"title": "Enviar textos, fotos e informações para a landing page", "category": "Landing Page", "due_days": 3, "recurrence": null},
    {"title": "Contratar/informar domínio e hospedagem no seu nome (orientado pelo gestor)", "category": "Landing Page", "due_days": 3, "recurrence": null},
    {"title": "Aprovar o modelo visual da landing page na plataforma (sem resposta em 48h = aprovado)", "category": "Landing Page", "due_days": 7, "recurrence": null},
    {"title": "Responder todo lead novo em até 15 minutos no horário comercial", "category": "Atendimento", "due_days": null, "recurrence": "7"},
    {"title": "Toda sexta: registrar na aba Leads os leads que qualificaram pelo WhatsApp (etiqueta Qualificado)", "category": "Atendimento", "due_days": null, "recurrence": "7"}
  ]'::jsonb
where not exists (
  select 1 from public.client_workflow_templates where name = 'Setup — Tarefas do cliente (Kit + Landing Page)'
);
