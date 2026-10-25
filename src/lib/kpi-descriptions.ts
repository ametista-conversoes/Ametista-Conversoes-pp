// Textos exibidos no tooltip de "?" dos KpiCard (src/components/dashboard/KpiCard.tsx).
// Formato: nome/sigla, o que o indicador mostra, e a fórmula usada no app.

export const kpiDescriptions = {
  // ---------- Portal Cliente (Dashboard, Performance, Relatórios) ----------
  investimento:
    'Investimento = Valor total aplicado em mídia paga\n\n' +
    'Quanto foi gasto em anúncios nas plataformas conectadas (Google Ads/Meta Ads), sincronizado automaticamente.\n\n' +
    'Cálculo: soma do gasto sincronizado dos últimos 30 dias. Sem integração conectada, aparece "—".',

  receita:
    'Receita (mês corrente) = Vendas do mês informadas pelo cliente × Ticket médio\n\n' +
    'Nenhuma plataforma de anúncio reporta faturamento: o cliente informa no Portal quantas vendas fez no mês, e o app multiplica pelo "Ticket médio" da Central de Informações. Enquanto as vendas do mês não forem informadas, aparece "—".\n\n' +
    'Cálculo: Vendas informadas do mês × Ticket médio.',

  gastoTotal:
    'Gasto Total = Investimento em mídia + Mensalidade da agência\n\n' +
    'Tudo que o cliente gasta no período: o que foi investido em anúncios mais a mensalidade paga pela gestão da agência.\n\n' +
    'Cálculo: Investimento + Mensalidade, no mesmo período.',

  lucro:
    'Resultado (mês corrente) = Receita menos Gasto Total do mês\n\n' +
    'Quanto sobrou depois de descontar da Receita (vendas informadas × ticket) o investimento em mídia do mês e a mensalidade da agência — mesma fórmula do "Resumo financeiro". Sem as vendas do mês informadas, aparece "—".\n\n' +
    'Cálculo: Receita do mês − (Investimento do mês + Mensalidade).',

  roas:
    'ROAS = Retorno sobre Investimento em Anúncios (Return on Ad Spend)\n\n' +
    'Mostra quanto foi gerado em receita para cada real investido em anúncios. Um ROAS de 4x significa que cada R$ 1 investido gerou R$ 4 em receita. Cruza a Receita do mês (vendas informadas pelo cliente × ticket médio) com o Investimento real sincronizado do mês.\n\n' +
    'Cálculo: Receita do mês ÷ Investimento do mês (dia 1 até hoje). Sem vendas informadas, aparece "—".',

  cpa:
    'CPA = Custo por Aquisição\n\n' +
    'Quanto custa, em média, conseguir uma conversão (venda, lead, etc.), segundo o que a própria plataforma de anúncio reportou. Quanto menor, mais eficiente a campanha.\n\n' +
    'Cálculo: Investimento ÷ Conversões, ambos sincronizados dos últimos 30 dias.',

  conversoes:
    'Conversões = Número de resultados gerados\n\n' +
    'Quantidade de ações (vendas, leads, cadastros) que a própria plataforma de anúncio atribuiu às campanhas.\n\n' +
    'Cálculo: soma das conversões sincronizadas dos últimos 30 dias.',

  ctrMedio:
    'CTR = Taxa de Cliques (Click-Through Rate)\n\n' +
    'Percentual de pessoas que clicaram no anúncio em relação a quantas o visualizaram — indica o quão atrativo é o criativo.\n\n' +
    'Cálculo: cliques ÷ impressões dos últimos 30 dias, sincronizados automaticamente.',

  healthScoreMedio:
    'Health Score = Nota de saúde do cliente\n\n' +
    'Pontuação de 0 a 100 que resume o desempenho geral (performance, financeiro, entrega e relacionamento) — a mesma nota mostrada no Dashboard.\n\n' +
    'Cálculo: recalculada automaticamente todo dia a partir de metas, tarefas, aprovações, reuniões, incidentes e alertas.',

  impressoes:
    'Impressões = Quantas vezes os anúncios foram exibidos\n\n' +
    'Total de vezes que os anúncios apareceram para alguém nas plataformas conectadas.\n\n' +
    'Cálculo: soma das impressões sincronizadas de todos os retratos diários.',

  cliques:
    'Cliques = Quantas vezes os anúncios foram clicados\n\n' +
    'Total de cliques recebidos pelos anúncios nas plataformas conectadas.\n\n' +
    'Cálculo: soma dos cliques sincronizados de todos os retratos diários.',

  cpc:
    'CPC = Custo por Clique\n\n' +
    'Quanto custa, em média, cada clique recebido nos anúncios. Quanto menor, mais barato o tráfego.\n\n' +
    'Cálculo: investimento em mídia ÷ número de cliques, no mesmo período.',

  taxaConversao:
    'Taxa de Conversão = Percentual de cliques que viraram resultado\n\n' +
    'De cada clique recebido, quantos viraram uma conversão (venda, lead, cadastro) reportada pela plataforma de anúncios.\n\n' +
    'Cálculo: conversões sincronizadas ÷ cliques, no mesmo período.',

  leads:
    'Leads = Volume de contatos recebidos no período\n\n' +
    'Soma das respostas de formulário sincronizadas (aba Leads) com os leads registrados manualmente, no mês selecionado — diferente da contagem "bruta" da aba Leads, que soma o histórico inteiro. Só aparece pra clientes com pelo menos um projeto do tipo "Leads".\n\n' +
    'Cálculo: respostas de formulário + leads manuais, dentro do mês selecionado.',

  custoPorLead:
    'Custo por Lead (CPL) = Quanto custou, em média, cada lead recebido\n\n' +
    'Quanto menor, mais eficiente a captação. Diferente do CPA, que mede o custo por conversão rastreada pela plataforma de anúncio (venda ou lead já qualificado).\n\n' +
    'Cálculo: Investimento em mídia do mês ÷ Leads do mês.',

  vendas:
    'Vendas = Leads que fecharam negócio no período\n\n' +
    'Quantos dos leads recebidos no mês (formulário + manuais) já estão marcados com status "Venda".\n\n' +
    'Cálculo: contagem de leads do mês com status "Venda".',

  taxaLeadVenda:
    'Taxa Lead → Venda = Percentual de leads que viraram venda\n\n' +
    'De cada lead recebido no mês, quantos já fecharam negócio — indicador de saúde do atendimento/funil comercial, não da campanha em si.\n\n' +
    'Cálculo: Vendas do mês ÷ Leads do mês.',

  // ---------- Portal Gestor (Dashboard Executivo) ----------
  mrrTotal:
    'MRR = Receita Recorrente Mensal (Monthly Recurring Revenue)\n\n' +
    'Quanto a agência fatura por mês com mensalidades de clientes ativos — a base de receita previsível do negócio.\n\n' +
    'Cálculo: soma da mensalidade dos clientes com status Ativo.',

  clientesAtivos:
    'Clientes Ativos = Clientes com contrato em vigor\n\n' +
    'Quantos clientes a agência está atendendo atualmente (não conta pausados, em onboarding ou encerrados).\n\n' +
    'Cálculo: contagem de clientes com status Ativo.',

  churnRate:
    'Churn Rate = Taxa de cancelamento\n\n' +
    'Percentual de clientes que encerraram o contrato em relação ao total já atendido. Quanto menor, melhor a retenção.\n\n' +
    'Cálculo: clientes com status Encerrado ÷ total de clientes.',

  incidentesAbertos:
    'Incidentes Abertos = Problemas ainda não resolvidos\n\n' +
    'Quantidade de incidentes registrados que ainda precisam de atenção da equipe.\n\n' +
    'Cálculo: contagem de incidentes com status Aberto ou Em andamento.',

  clientesEmRisco:
    'Clientes em Risco = Clientes com sinais de insatisfação\n\n' +
    'Clientes cuja saúde geral está baixa e que podem cancelar o contrato se não forem priorizados.\n\n' +
    'Cálculo: contagem de clientes com Health Score abaixo de 50.',

  cargaDeTrabalho:
    'Carga de Trabalho = Volume de tarefas em aberto\n\n' +
    'Quantidade total de tarefas que a equipe ainda precisa concluir, somando todos os clientes.\n\n' +
    'Cálculo: contagem de tarefas com status diferente de Concluída.',

  produtividade:
    'Produtividade = Eficiência da equipe na entrega de tarefas\n\n' +
    'Mostra a proporção de tarefas já finalizadas em relação ao total.\n\n' +
    'Cálculo: tarefas concluídas ÷ total de tarefas.',

  budgetGerenciado:
    'Budget Gerenciado = Verba de mídia sob gestão da agência\n\n' +
    'Valor total investido em anúncios que a agência está atualmente gerenciando para os clientes.\n\n' +
    'Cálculo: soma do investimento dos projetos ativos.',
} as const
