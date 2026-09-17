# Prompt para o Claude Code local — rodar os testes pendentes do TESTES.md

> Cole este arquivo inteiro (ou aponte pra ele: "leia e execute
> `docs/interno/Prompt - fase testes pendentes.md`") na sua sessão do
> Claude Code, dentro da pasta do projeto Ametista Conversões. Escrito
> pelo Cowork depois de: (1) mover o "propósito do formulário" pra
> criação do Ativo Digital (Fase 38, já implementada — ver abaixo) e (2)
> mapear todo o `docs/interno/TESTES.md` pra separar o que é teste
> direto do que provavelmente vai dar problema ou precisa de preparo
> especial.

## 0. Contexto — o que já foi feito nesta sessão (Cowork), antes deste prompt

Já implementei a Fase 38 direto no seu repositório (arquivos já salvos, nada
em rascunho):

- `supabase/migration-078-proposito-formulario-no-ativo.sql` (novo) —
  `digital_assets.form_purpose`, função `set_asset_form_purpose`, backfill.
- `src/lib/form-purpose.ts` (novo) — constantes compartilhadas.
- `src/lib/status-styles.ts` — Tipo novo `google_forms: 'Formulário (Google Forms)'`.
- `src/components/assets/AssetFormDialog.tsx` — campo condicional "Propósito
  deste formulário" quando Tipo = Formulário (Google Forms).
- `src/components/assets/FormResponsesDialog.tsx` — o Select de propósito
  virou texto informativo (não editável mais ali).
- `src/hooks/useManagerPortalData.ts` — `ManagerDigitalAssetRecord`/
  `NewDigitalAssetInput` ganham `form_purpose`; `useUpdateDigitalAsset`
  chama a RPC nova pra propagar o valor pra uma conexão já existente.
- `supabase/functions/integrations/index.ts` — `handleConnect` copia
  `digital_assets.form_purpose` pra dentro da conexão nova no momento em
  que ela é criada.
- `docs/interno/TASKS.md` — entrada "Fase 38" adicionada, documentando tudo
  acima.
- `docs/interno/TESTES.md` — item 37 (Bloco 1) atualizado pra apontar pro
  novo lugar; item 39 novo com o roteiro de teste completo da Fase 38.

`npx tsc -b --noEmit` rodou limpo. `npm run build` chegou a transformar os
3961 módulos e só travou depois numa falha de binário nativo do rollup
(`@rollup/rollup-linux-x64-gnu` ausente — bug conhecido do npm com
dependências opcionais nesse ambiente específico, sem relação com o código)
— rode `npm run build` de novo no seu ambiente normal pra confirmar limpo
de ponta a ponta; se dar o mesmo erro aí, `rm -rf node_modules
package-lock.json && npm install` costuma resolver.

**Sua primeira tarefa, antes de qualquer teste**: rodar
`migration-078-proposito-formulario-no-ativo.sql` no SQL Editor do Supabase
e reimplantar a Edge Function `integrations`
(`supabase functions deploy integrations`) — sem isso o campo novo aparece
na tela mas salvar dá erro (RPC/coluna não existem ainda).

## 1. O que fazer, em ordem

1. Confirme (ou rode) a migration-078 e o deploy da `integrations`, como
   acima.
2. Rode `npx tsc -b --noEmit`, `npm run test` e `npm run build` no seu
   ambiente pra ter a linha de base limpa antes de mexer em qualquer
   coisa.
3. Abra `docs/interno/TESTES.md` — é a lista viva de testes ao vivo ainda
   não confirmados. Trabalhe a lista na ordem em que ela já está (ela já é
   crescente de importância/risco, é a convenção do próprio arquivo), com
   os ajustes de prioridade da seção 2 abaixo.
4. Pra cada item: reproduza ao vivo (login como a conta certa — admin/
   gestor/cliente —, Playwright quando fizer sentido pro fluxo, SQL Editor
   pra forçar datas/estado quando o próprio item já dá o comando pronto,
   que é o padrão que você mesmo já vinha usando nas fases anteriores).
5. **Ao confirmar um item inteiro**: apague a seção dele do TESTES.md (é a
   convenção do próprio arquivo — "não fica marcado pra sempre"). Ao
   confirmar só alguns sub-itens de uma seção maior, deixe marcado `[x]`
   só o que foi confirmado e apague a seção inteira só quando TODOS os
   checkboxes dela estiverem marcados.
6. Ao encontrar um bug de verdade no caminho (como já é seu padrão em toda
   a Fase 1-37): corrija, documente em `docs/interno/TASKS.md` seguindo o
   mesmo formato das entradas anteriores, rode `tsc`/`test`/`build`, e só
   então volte pro teste.
7. No final, um resumo curto: quantos itens/sub-itens confirmados, quantos
   ficaram pendentes e por quê (bloqueio externo, precisa de dado real,
   etc.), e quantos bugs reais corrigidos no caminho.

## 2. Prioridade sugerida (fora da ordem crescente do arquivo) e por quê

Comece por estes 3, fora de ordem, porque podem destravar ou explicar
outros itens da lista:

1. **Item 29 primeiro de todos** — "Erro `Could not find the
   'campaign_status' column` PERSISTE mesmo após reload do schema cache".
   Isso sugere que `migration-067-alerta-mudanca-estado-campanha.sql`
   nunca rodou de verdade, mesmo o item 16 do TESTES.md já estando
   marcado `[X]` (parcialmente — ele tem sub-itens `[ ]` também). Rode a
   query de diagnóstico que o próprio item 29 já dá
   (`select column_name from information_schema.columns where
   table_name = 'campaign_performance_snapshots' and column_name =
   'campaign_status';`) antes de tentar qualquer teste do item 16, e
   possivelmente antes dos itens 13-18 também (todos mexem na mesma
   tabela `campaign_performance_snapshots`) — se a coluna realmente não
   existir, isso pode ser a causa raiz de falhas que apareceriam nesses
   outros testes também, não um problema isolado do item 29.
2. **Item 7** — "Mudança de planos na Central de Informações" — o próprio
   item diz "ainda não sabemos exatamente o que quebra". Isso não é um
   teste de aceite executável do jeito que está — é um relato vago demais
   pra reproduzir sozinho. Não invente um cenário: se não conseguir
   reproduzir nada de errado trocando o plano de um cliente de teste,
   registre isso e passe a bola pro usuário descrever com mais detalhe
   (mensagem de erro exata? não salvou? salvou errado?) em vez de marcar
   como "sem bug" por falta de reprodução.
3. **Item 39 (Fase 38, novo)** — teste a mudança que citei na seção 0
   acima, já que ela é a mais recente e ainda não foi validada nenhuma
   vez ao vivo.

Depois disso, siga a ordem normal do arquivo (1 → 38), com estas ressalvas
específicas:

- **Item 3, último sub-item** — não é bem um teste, é o próximo passo
  (gravar vídeo de demonstração pro Google) — pule, não é algo pra você
  executar sozinho.
- **Itens 10 e 31** — dependem de aprovações externas do Google (Basic
  Access) e do Meta (Advanced Access/Business Verification) que ainda
  não saíram, segundo o próprio item 31. Não force um teste de ponta a
  ponta com conta de cliente real nesses — teste só o que dá pra testar
  com a conta MCC/Business Manager de teste já conectada (login, seleção
  de conta, diagnóstico de erro quando falha), e deixe registrado no
  TESTES.md que o resto continua bloqueado por aprovação externa (não
  apague a seção, só o que já foi confirmado).
- **Itens 13 a 18** (Google Ads: grupos de anúncio, múltiplas campanhas,
  teste A/B, etc.) — várias sub-tarefas pedem pra "pausar uma campanha
  real no Google Ads/Meta Ads" ou "mudar o orçamento em mais de 20%"
  DIRETO no painel do Google/Meta, fora do app (item 16 principalmente).
  Isso não dá pra automatizar por dentro do app — ou peça pro usuário
  fazer essa mudança manualmente no console do Google/Meta antes de você
  rodar a sincronização e conferir o alerta, ou pule esse sub-item
  específico e registre que precisa de ação manual fora do app.
- **Item 27, penúltimo sub-item** (recorrência com cadência de plano) —
  direto, só precisa forçar `completed_at` + trocar o plano do cliente,
  sem bloqueio.
- **Item 35** — "conexão que parou de sincronizar sozinha" é difícil de
  forçar de propósito (o cenário real é o refresh_token expirar sozinho
  depois de 7 dias, modo "Testing" do Google). Pra testar o LOG de erro
  novo (o que é testável agora) sem esperar 7 dias: invalide o token de
  uma conexão de teste direto no Vault/`oauth_tokens` (ou revogue o
  acesso do lado do Google pra essa credencial) e rode uma sincronização
  manual — confirme que aparece a entrada nova em Configurações → Erros
  e que o status da conexão vira "Erro". Documente que simulou dessa
  forma, não esperando o prazo real.
- **Item 37, Bloco 1** — já reescrito no TESTES.md pra apontar pro novo
  lugar (Fase 38) — teste os Blocos 2 e 3 normalmente, e o Bloco 1 pelo
  caminho novo.

## 3. Itens que são só "ação pendente do usuário", não testes seus

Alguns itens do TESTES.md não são testes que você deveria executar
sozinho — são passos que dependem só do usuário rodar/configurar algo
fora do seu alcance (aprovação externa, decisão de negócio, etc.). Marque
como "aguardando o usuário" em vez de tentar forçar uma resposta:
o item 31 inteiro, o pendente do item 3 (vídeo de demonstração), e
qualquer sub-item que dependa de credencial real do Google/Meta que o
usuário ainda não tem.

## 4. Ao terminar

Devolva um resumo objetivo: itens/sub-itens confirmados e removidos do
TESTES.md, itens que continuam pendentes (com o motivo: bloqueio externo,
precisa de ação manual fora do app, ou descrição insuficiente do usuário),
e a lista de bugs reais encontrados e corrigidos no caminho (mesmo padrão
que você já documenta em TASKS.md desde a Fase 1).
