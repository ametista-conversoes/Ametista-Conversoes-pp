# Roteiro de demonstração (10 min) — Portal Gestor → Portal Cliente

> Fase 50.F. Pra demonstração ao vivo a prospects, usando os clientes
> sintéticos da Fase 50 (Clínica Sorriso = Validação/Meta/leads; Loja
> Aurora = Dominação/Meta+Google/vendas). Este roteiro usa a **Clínica
> Sorriso** como exemplo principal — o mesmo caminho funciona na Loja
> Aurora trocando os nomes de tela indicados nas observações no final.

## Antes de começar (1x, no dia da demo)

- [ ] Configurações → Globais → **"Recriar dados de demonstração"** (ou
      `POST .../demo-data/recreate`) — os números do mês corrente dependem
      da data de hoje, então rode isso no mesmo dia (ou de manhã, se a demo
      for à tarde).
- [ ] Decida se vai abrir a aba **Configurações** do Portal Cliente — ela
      mostra o selo "Demonstração" (card "Dados do cliente"). É
      transparente, mas quebra a imersão de "isso é uma conta real".
      Recomendado: **não abrir essa aba** durante a demo.
- [ ] 2 logins prontos (2 navegadores/perfis, ou 1 login + logout no
      meio): sua conta de gestor/admin pro Portal Gestor; `demo@clinicasorriso.com.br`
      pro Portal Cliente (senha em `docs/interno/credenciais-demo.local.md`,
      local, fora do git).
- [ ] Se o prospect for e-commerce/varejo (vendas diretas, não geração de
      leads), considere usar a **Loja Aurora** em vez da Clínica Sorriso —
      é o exemplo que tem o aviso de "Ritmo de verba" (gancho comercial
      natural pra explicar o modificador de verba do Anexo I).

## Parte 1 — Portal do Gestor (~4 min): "como a gente cuida da sua conta"

1. **(30s) `/clients`** — lista de clientes. Aponte a variedade de
   planos (badges) — mostra que a operação já roda pra perfis diferentes,
   não é um sistema feito só pra um cliente.
2. **(1 min) Clique em "Clínica Sorriso (demo)" → Central de Informações**
   (`/clients/:id`). Mostre o Health Score (78, saudável) com os 4
   sub-scores (Performance/Financeiro/Entrega/Relacionamento) e o resumo
   do cliente (plano Validação, Meta Ads).
3. **(1 min) Abra o histórico de Análises do Gestor** (botão "Ver
   histórico") — leia em voz alta o resumo de um dos 3 meses publicados
   (ex: "Melhor mês até aqui: CPL em R$25..."). Fale sobre a cadência
   (mensal neste plano; quinzenal no Escala; semanal + mensal estratégica
   no Dominação). O diagnóstico completo (que cita o teste vídeo x
   carrossel) fica mais fácil de mostrar do lado do Portal Cliente, no
   passo 5 da Parte 2 — não precisa repetir aqui.
4. **(1 min) Abra o projeto "Avaliação Odontológica — Meta Ads" → aba
   "Testes"** — mostre as 2 variantes (Teste A/B — Vídeo vs Teste A/B —
   Carrossel) com CPA/CTR reais calculados a partir do histórico.
5. **(30s) `/catalog`** — mostre os criativos com estrela/aprovados,
   ligados ao teste do passo 4.

## Parte 2 — Portal do Cliente, Clínica Sorriso (~6 min): "e é isso que o SEU painel mostra"

1. Logout da conta de gestor, login com `demo@clinicasorriso.com.br`.
2. **(1 min) `/dashboard`** — KPIs do mês corrente, card com a última
   Análise do Gestor publicada (mesmo texto visto na Parte 1, agora do
   lado do cliente), Health Score em versão simplificada.
3. **(1 min) `/project`** — mesmo projeto do passo 4 da Parte 1, visão do
   cliente: título, teste A/B em andamento/concluído.
4. **(1,5 min) `/reports` → aba "Histórico Mensal"** — selecione um mês
   já fechado, mostre os números reais (leads, vendas, CPA, ROAS) e
   clique em **"Baixar PDF"** — abra o PDF gerado ao vivo na hora (prova
   de que não é uma imagem estática).
5. **(1 min) `/reports` → aba "Análises"** — aqui sim aparece o
   diagnóstico completo de cada mês, incluindo a frase sobre o teste
   vídeo x carrossel ("O vídeo confirmou a vitória no teste de
   criativo..."). Reforça a mesma transparência/cadência já mostrada do
   lado gestor, agora com o texto inteiro visível pro cliente.
6. **(1 min) `/cassie`** — pergunte algo ao vivo, ex: *"Tem algum risco
   ou pendência que eu devia saber sobre essa conta?"* — puxa de verdade
   a tarefa atrasada + a meta de qualificação de leads em risco + a
   próxima reunião, mostrando que a IA lê o dado real do cliente, não é
   um script fixo. **Evite perguntar sobre receita/ROAS/CTR** — achado
   ao testar: a Cassie lê esses 3 campos de colunas (`projects.revenue`/
   `performance_snapshots.revenue`/`roas`/`ctr`) que não são preenchidas
   em NENHUM cliente (demo ou real) nesta versão do app — ela responde
   "não informado"/"R$0,00" mesmo com o resto da tela mostrando receita
   calculada normalmente (a receita real vem de leads × ticket médio,
   calculada só na tela, nunca gravada nessas colunas). Não é um problema
   introduzido pelos dados de demonstração — é um gap pré-existente da
   Cassie que vale corrigir numa fase própria, fora deste roteiro.
7. **(30s) `/comments` ou `/meetings`** — mostre rapidamente o canal de
   colaboração (um comentário já existente, a próxima reunião agendada).

## Observações

- **Pule a aba "Plano de 90 dias"** em Relatórios — está vazia pros 2
  clientes demo (não fazia parte do que foi pedido detalhar nessa fase).
- O aviso de **"Ritmo de verba"** (estouro de orçamento projetado) só
  aparece na **Loja Aurora** (plano Dominação) — se quiser usar esse
  gancho comercial, troque pra ela na Parte 1 (Central de Informações →
  Análise do Gestor → mês corrente) e ajuste os nomes de tela: projeto
  "E-commerce — Meta + Google Ads", aba "Grupos de Anúncios" funciona
  também pra Google (não só Meta).
- 1ª tela depois do login pode demorar ~1-2s mais que o normal —
  considere abrir e deixar carregando em background antes de começar a
  falar daquela parte.
- Se o prospect pedir pra ver algo fora do roteiro (ex: Tarefas,
  Arquivos), pode abrir sem medo — os 2 clientes têm dado real em quase
  todas as telas do Portal Cliente, só "Plano de 90 dias" fica vazio.
