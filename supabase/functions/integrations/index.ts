// Ametista Conversões — Fase 6.1-6.3: backend de integrações (Google
// Ads, Google Forms, Meta Ads).
//
// Como usar: cole este arquivo inteiro no painel do Supabase, em
// Edge Functions > "integrations" > editar código > Deploy. Essa
// função recebe chamadas de fora do Supabase (o navegador da pessoa
// durante o login do Google/Meta, e o gatilho do Google Forms), então
// a verificação automática de JWT precisa estar DESLIGADA nas
// configurações da função — a autenticação é feita na mão dentro do
// código, rota por rota (ver `requireAdminOrGestor`, o parâmetro
// `state` do OAuth, e o segredo `X-Webhook-Secret`).
//
// Segredos que essa função espera encontrar configurados (Edge
// Functions > integrations > Secrets), além dos quatro que o Supabase
// já injeta sozinho em toda função (SUPABASE_URL, SUPABASE_ANON_KEY,
// SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL). Os 3 do Google foram
// criados no painel com nomes diferentes do padrão (o painel não deixa
// renomear depois de criado — mesmo caso já resolvido assim pra Cassie
// na Fase 7.1) — os nomes REAIS usados no código são os que aparecem
// entre parênteses, ver `GOOGLE_OAUTH_CLIENT_ID_ENV` etc. logo abaixo:
//   GOOGLE_OAUTH_CLIENT_ID       (real: "client ID")       — do Google Cloud Console
//   GOOGLE_OAUTH_CLIENT_SECRET   (real: "Client secret")   — do Google Cloud Console
//   GOOGLE_ADS_DEVELOPER_TOKEN   (real: "Developer token") — do Google Ads Manager Account
//   META_APP_ID                  — do app em developers.facebook.com
//   META_APP_SECRET              — do app em developers.facebook.com
//   FORMS_WEBHOOK_SECRET         — inventado por você, usado também no
//                                   script do Apps Script (ver
//                                   forms-trigger.gs.txt)
//   CRON_SECRET                  — inventado por você, usado também na
//                                   migração migration-019-fase64-cron.sql
//                                   (job agendado que chama /sync-all)
//   FRONTEND_URL                 — ex: http://localhost:5173 (sem
//                                   barra no final)
//
// Rotas (identificadas pelo final do path da requisição):
//   GET  .../integrations/connect?provider=google_ads&digital_asset_id=...
//   GET  .../integrations/connect?provider=google_forms&digital_asset_id=...&form_id=...
//   GET  .../integrations/connect?provider=meta_ads&digital_asset_id=...
//   GET  .../integrations/callback?state=...&code=...          (aberta pelo Google/Meta)
//   GET  .../integrations/campaigns?connection_id=...           (vincular projeto a uma campanha — Fase 8.1b)
//   GET  .../integrations/ad-groups?connection_id=...&campaign_id=...  (aba "Grupos de Anúncios" do
//                                          projeto — busca ao vivo, só Google Ads, com Índice de
//                                          Qualidade médio por ad group vindo de keyword_view)
//   GET  .../integrations/campaign-insights?connection_id=...&campaign_id=...  (dispositivo, top termos
//                                          de pesquisa, top palavras-chave, geográfico por cidade/região,
//                                          breakdown por ação de conversão — busca ao vivo, só Google Ads,
//                                          5 consultas independentes)
//   GET  .../integrations/accounts?connection_id=...             (Fase 20: lista as contas de anúncio
//                                          reais do Google Ads acessíveis por uma conexão — nunca
//                                          inclui conta gerenciadora/MCC, só contas-cliente de verdade)
//   POST .../integrations/select-account  { connection_id, customer_id, login_customer_id }
//                                          (Fase 20: grava qual conta de anúncios do Google Ads usar,
//                                          quando handleCallback não conseguiu escolher sozinho por
//                                          existir mais de uma opção — ex: conta gerenciadora com
//                                          várias contas-cliente por baixo)
//   POST .../integrations/sync            { connection_id }     (botão "Sincronizar agora" — Google
//                                          Ads/Meta Ads sincroniza métricas; Google Forms sincroniza
//                                          perguntas+respostas estruturadas via forms.googleapis.com,
//                                          Fase 8.2)
//   POST .../integrations/sync-all        {}                    (cabeçalho X-Cron-Secret,
//                                          chamada pelo job agendado — Fase 6.4, agora também
//                                          sincroniza conexões de Google Forms)
//   POST .../integrations/forms-webhook   { formId, responseId, submittedAt, answers }
//                                          (cabeçalho X-Webhook-Secret — continua só criando o
//                                          Alerta genérico de "nova resposta", sem mudança)
//
// Fase 28 — conta administradora da agência (MCC no Google Ads, Business
// Manager no Meta), autenticada 1x em vez de por cliente. Conexões de
// cliente feitas por OAuth direto (linhas acima) continuam funcionando
// sem nenhuma mudança — este é só o caminho novo pra conexão futura:
//   GET  .../integrations/agency-connect?provider=google_ads|meta_ads   (só admin)
//   GET  .../integrations/agency-accounts?provider=...                  (lista contas de cliente
//                                          visíveis pelo MCC/Business Manager já conectado)
//   POST .../integrations/link-agency-account  { digital_asset_id, provider, external_account_id,
//                                          login_customer_id? }   (sem OAuth nessa etapa — só
//                                          escolhe, numa lista, qual conta do cliente usar)
//   POST .../integrations/agency-disconnect  { provider }         (só admin)
//   GET  .../integrations/agency-businesses?provider=meta_ads     (só Meta — lista Business
//                                          Managers quando a escolha automática não foi
//                                          possível, 0 ou 2+ encontrados)
//   POST .../integrations/select-agency-business  { business_id }  (só admin)

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { timingSafeEqual } from 'node:crypto'

const PROVIDERS = ['google_ads', 'google_forms', 'meta_ads'] as const
type Provider = (typeof PROVIDERS)[number]

const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_ADS_API_VERSION = 'v25' // Fase 20 (achado ao vivo): v17 já tinha sido desativada pelo Google — conferir de novo em developers.google.com/google-ads/api/docs/sunset-dates se for testar depois de muito tempo parado

// Nomes REAIS dos secrets no painel do Supabase (Fase 8.2b) — o
// usuário já tinha criado os 3 com esses nomes antes de eu documentar
// o padrão GOOGLE_OAUTH_CLIENT_ID/GOOGLE_OAUTH_CLIENT_SECRET/
// GOOGLE_ADS_DEVELOPER_TOKEN, e o painel não deixa renomear um secret
// depois de criado — então o código lê pelos nomes que existem de
// verdade, em vez de pedir pra recriar tudo (mesma solução já usada
// pra Cassie na Fase 7.1, com Openai_api_key).
const GOOGLE_OAUTH_CLIENT_ID_ENV = 'client ID'
const GOOGLE_OAUTH_CLIENT_SECRET_ENV = 'Client secret'
const GOOGLE_ADS_DEVELOPER_TOKEN_ENV = 'Developer token'

const GOOGLE_SCOPES: Record<'google_ads' | 'google_forms', string> = {
  google_ads: 'https://www.googleapis.com/auth/adwords',
  google_forms: 'https://www.googleapis.com/auth/forms.body.readonly https://www.googleapis.com/auth/forms.responses.readonly',
}

const META_GRAPH_API_VERSION = 'v19.0' // conferir se ainda é suportada quando for testar de verdade
const META_AUTHORIZE_URL = `https://www.facebook.com/${META_GRAPH_API_VERSION}/dialog/oauth`
const META_TOKEN_URL = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/oauth/access_token`
const META_SCOPE = 'ads_read' // só leitura de métricas — nada de gerenciar campanha

// API oficial do Google Forms (Fase 8.2) — precisa estar habilitada no
// mesmo projeto do Google Cloud Console usado pro OAuth, além dos
// escopos forms.body.readonly/forms.responses.readonly já pedidos
// desde a Fase 6.2 (que até aqui nunca eram usados de verdade).
const GOOGLE_FORMS_API_BASE = 'https://forms.googleapis.com/v1/forms'

// Restrito ao domínio de produção (deploy na Vercel) — antes era '*'
// (qualquer site podia chamar), trocado ao publicar o app de verdade.
// Não afeta /callback (redirect direto do Google/Meta, não é chamada
// de navegador sujeita a CORS) nem /forms-webhook (chamada servidor-a-
// servidor do Google Apps Script, também não passa por CORS).
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://ametistaconversoes.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** Manda o navegador de volta pro app depois do login do Google/Meta —
 * via redirect HTTP de verdade (302), não uma página HTML. Rotas de
 * Edge Function chamadas sem autenticação (como /callback, aberta pelo
 * navegador vindo do Google, sem login nosso por trás) têm o
 * Content-Type da resposta forçado pra text/plain pelo próprio
 * Supabase — uma página aqui nunca renderiza bonita, sempre aparece
 * como código cru. O resultado vai na query string; quem mostra um
 * aviso de verdade é o próprio app (toast em Assets.tsx). */
function callbackRedirect(success: boolean, message: string, targetPath = '/assets') {
  const frontendUrl = Deno.env.get('FRONTEND_URL') ?? 'http://localhost:5173'
  const target = new URL(`${frontendUrl}${targetPath}`)
  target.searchParams.set('integration', success ? 'connected' : 'error')
  target.searchParams.set('message', message)
  return new Response(null, { status: 302, headers: { ...corsHeaders, Location: target.toString() } })
}

function isProvider(value: string | null): value is Provider {
  return !!value && (PROVIDERS as readonly string[]).includes(value)
}

/** Fase 20 (achado ao vivo): o `redirect_uri` do fluxo OAuth do Google
 * (Ads/Forms — Meta não tem esse problema) precisa estar num domínio
 * que a gente consiga verificar posse (pra tela de consentimento
 * mostrar o nome/logo do app em vez do domínio técnico da função) —
 * `supabase.co` nunca vai servir pra isso, só a Vercel do próprio app.
 * `vercel.json` tem uma rota que encaminha `/oauth/google-callback`
 * pra esta mesma função por trás, sem o navegador perceber. Usada
 * tanto pra montar o link de autorização (handleConnect) quanto na
 * troca do código pelo token (handleCallback) — as duas chamadas
 * precisam mandar pra Google exatamente o mesmo valor, senão ela
 * recusa com "redirect_uri_mismatch". */
function buildGoogleRedirectUri(): string {
  const frontendUrl = Deno.env.get('FRONTEND_URL') ?? 'http://localhost:5173'
  return `${frontendUrl}/oauth/google-callback`
}

/** Aceita tanto o id puro de um Google Forms quanto o link inteiro
 * (ex: https://docs.google.com/forms/d/<id>/edit). */
function extractFormId(input: string): string {
  const match = input.match(/\/forms\/d\/([a-zA-Z0-9_-]+)/)
  return match ? match[1] : input.trim()
}

function getServiceClient() {
  return createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
}

/** Compara em tempo constante (Fase 20.1) — evita que alguém descubra
 * um segredo (X-Cron-Secret/X-Webhook-Secret) aos poucos, medindo
 * quanto tempo cada tentativa errada leva pra falhar. */
function safeCompare(a: string, b: string): boolean {
  const bufA = new TextEncoder().encode(a)
  const bufB = new TextEncoder().encode(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

// Fase 21.1: além do console.error (visível só em Edge Functions >
// Logs), grava em error_logs pra aparecer em /errors no Portal
// Gestor. Nunca lança — logging não pode virar uma fonte nova de erro.
async function logServerError(functionName: string, context: string, error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error)
  try {
    await getServiceClient()
      .from('error_logs')
      .insert({
        source: 'edge_function',
        function_name: functionName,
        message: `${context}: ${message}`,
        stack: error instanceof Error ? (error.stack ?? null) : null,
        context: error instanceof Error ? null : (error ?? null),
      })
  } catch (err) {
    console.error(`[${functionName}] não foi possível gravar em error_logs:`, err)
  }
}

// Fase 20.1: nunca devolver error.message bruto (Postgres/Google/Meta)
// pro navegador — loga o erro completo no servidor (visível em Edge
// Functions > Logs no painel do Supabase) e devolve só uma mensagem
// genérica pro cliente.
async function dbErrorResponse(context: string, error: { message: string }) {
  console.error(`[integrations] ${context}:`, error)
  await logServerError('integrations', context, error)
  return jsonResponse({ error: 'Erro ao acessar o banco de dados. Tente novamente.' }, 500)
}

async function platformErrorResponse(context: string, platform: string, body: unknown) {
  console.error(`[integrations] ${context} — erro da ${platform}:`, body)
  await logServerError('integrations', `${context} — erro da ${platform}`, body)
  return jsonResponse({ error: `Erro ao consultar a ${platform}. Tente novamente.` }, 502)
}

async function dbErrorRedirect(context: string, error: { message: string }) {
  console.error(`[integrations] ${context}:`, error)
  await logServerError('integrations', context, error)
  return callbackRedirect(false, 'Erro ao acessar o banco de dados. Tente novamente.')
}

async function platformErrorRedirect(context: string, platform: string, body: unknown) {
  console.error(`[integrations] ${context} — erro da ${platform}:`, body)
  await logServerError('integrations', `${context} — erro da ${platform}`, body)
  return callbackRedirect(false, `Não foi possível conectar com o ${platform}. Tente novamente.`)
}

async function dbSyncError(context: string, error: { message: string }): Promise<{ ok: false; error: string }> {
  console.error(`[integrations] ${context}:`, error)
  await logServerError('integrations', context, error)
  return { ok: false, error: 'Erro ao acessar o banco de dados. Tente novamente.' }
}

async function platformSyncError(context: string, platform: string, body: unknown): Promise<{ ok: false; error: string }> {
  console.error(`[integrations] ${context} — erro da ${platform}:`, body)
  await logServerError('integrations', `${context} — erro da ${platform}`, body)
  return { ok: false, error: `Erro ao consultar a ${platform}. Tente novamente.` }
}

/** Só usado nas rotas chamadas pelo nosso próprio front-end (/connect,
 * /sync) — /callback e /forms-webhook são chamadas por fora (Google) e
 * se autenticam de outro jeito (ver comentário no topo do arquivo). */
async function requireAdminOrGestor(req: Request): Promise<{ userId: string; role: string } | Response> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return jsonResponse({ error: 'Não autenticado' }, 401)

  const anonClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '')
  const { data: userData, error: userError } = await anonClient.auth.getUser(token)
  if (userError || !userData.user) return jsonResponse({ error: 'Sessão inválida' }, 401)

  const supabase = getServiceClient()
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single()
  if (profileError || !profile) return jsonResponse({ error: 'Perfil não encontrado' }, 403)
  if (profile.role !== 'admin' && profile.role !== 'gestor') {
    return jsonResponse({ error: 'Não autorizado' }, 403)
  }
  return { userId: userData.user.id, role: profile.role }
}

/** Fase 20 (achado ao vivo): a mesma conta real de Google Ads/Meta Ads
 * conectada em 2 ativos digitais diferentes do mesmo cliente duplicava
 * dado sincronizado (campaign_performance_snapshots repetido por
 * conexão, entre outros). Só permite 1 conexão "connected" de cada
 * provedor por cliente — reconectar o MESMO ativo (mesma linha)
 * continua liberado, só bloqueia um ativo digital *diferente* do mesmo
 * cliente. Reaproveitada por handleConnect (OAuth por cliente, legado)
 * e handleLinkAgencyAccount (Fase 28, escolha a partir da conta de
 * agência). */
async function assertNoSiblingConnection(
  supabase: SupabaseClient,
  provider: 'google_ads' | 'meta_ads',
  digitalAssetId: string,
  clientId: string,
): Promise<Response | null> {
  const { data: siblingAssets, error: siblingAssetsError } = await supabase
    .from('digital_assets')
    .select('id')
    .eq('client_id', clientId)
    .neq('id', digitalAssetId)
  if (siblingAssetsError) return await dbErrorResponse('assertNoSiblingConnection: buscar ativos do cliente', siblingAssetsError)
  const siblingAssetIds = ((siblingAssets ?? []) as Array<{ id: string }>).map((a) => a.id)
  if (siblingAssetIds.length === 0) return null

  const { data: existingConnection, error: existingConnectionError } = await supabase
    .from('digital_asset_connections')
    .select('id')
    .eq('provider', provider)
    .eq('status', 'connected')
    .in('digital_asset_id', siblingAssetIds)
    .maybeSingle()
  if (existingConnectionError) {
    return await dbErrorResponse('assertNoSiblingConnection: checar conexão existente do cliente', existingConnectionError)
  }
  if (!existingConnection) return null

  const providerLabel = provider === 'google_ads' ? 'Google Ads' : 'Meta Ads'
  return jsonResponse(
    {
      error: `Esse cliente já tem uma conexão de ${providerLabel} ativa em outro ativo digital. Desconecte a outra antes de conectar uma nova — só 1 conexão de ${providerLabel} por cliente é permitida.`,
    },
    409,
  )
}

async function handleConnect(req: Request, url: URL) {
  const auth = await requireAdminOrGestor(req)
  if (auth instanceof Response) return auth

  const provider = url.searchParams.get('provider')
  const digitalAssetId = url.searchParams.get('digital_asset_id')

  if (!isProvider(provider)) {
    return jsonResponse({ error: `Provedor inválido. Use um de: ${PROVIDERS.join(', ')}` }, 400)
  }
  if (!digitalAssetId) {
    return jsonResponse({ error: 'digital_asset_id é obrigatório' }, 400)
  }

  const formIdInput = url.searchParams.get('form_id')

  if (provider === 'google_forms' && !formIdInput) {
    return jsonResponse({ error: 'Informe o id ou o link do formulário' }, 400)
  }

  // Fase 35.2 (bug real reportado pelo usuário) — rejeita na hora o
  // engano mais comum: o link PÚBLICO de resposta (.../forms/d/e/<id>/
  // viewform) tem um id diferente do link de EDIÇÃO
  // (.../forms/d/<id>/edit), e `extractFormId` (mais abaixo) capturava
  // só a letra solta "e" desse link, o que fazia a conexão terminar
  // "Conectada" mesmo sem apontar pra formulário nenhum de verdade. Sem
  // esperar o OAuth completar pra descobrir isso (ver validação depois
  // do callback, mais abaixo).
  if (provider === 'google_forms' && formIdInput && /\/forms\/d\/e\//.test(formIdInput)) {
    return jsonResponse(
      {
        error:
          'Esse é o link PÚBLICO de resposta (.../viewform). Cole o link de EDIÇÃO do formulário — abra o formulário pra editar as perguntas e copie a URL da barra de endereço (formato .../forms/d/<id>/edit).',
      },
      400,
    )
  }

  // Falha aqui dentro, com uma mensagem clara, em vez de mandar a
  // pessoa pro Google/Meta com um link quebrado (os dois recusam um
  // "client_id" vazio com um erro genérico, sem nem mostrar login).
  if (provider !== 'meta_ads' && !Deno.env.get(GOOGLE_OAUTH_CLIENT_ID_ENV)) {
    return jsonResponse(
      { error: `As credenciais do Google ainda não foram configuradas nesta função (falta o segredo "${GOOGLE_OAUTH_CLIENT_ID_ENV}").` },
      400,
    )
  }
  if (provider === 'meta_ads' && !Deno.env.get('META_APP_ID')) {
    return jsonResponse(
      { error: 'As credenciais do Meta ainda não foram configuradas nesta função (falta o segredo META_APP_ID).' },
      400,
    )
  }

  const supabase = getServiceClient()

  const { data: asset, error: assetError } = await supabase
    .from('digital_assets')
    .select('id, client_id')
    .eq('id', digitalAssetId)
    .maybeSingle()
  if (assetError) return dbErrorResponse('handleConnect: buscar ativo digital', assetError)
  if (!asset) return jsonResponse({ error: 'Ativo digital não encontrado' }, 404)

  // Fase 20 (achado ao vivo): a mesma conta real de Google Ads/Meta Ads
  // conectada em 2 ativos digitais diferentes do mesmo cliente duplicava
  // dado sincronizado (campaign_performance_snapshots repetido por
  // conexão, entre outros). Só permite 1 conexão "connected" de cada
  // provedor por cliente — reconectar o MESMO ativo (mesma linha) continua
  // liberado, só bloqueia um ativo digital *diferente* do mesmo cliente.
  if (provider === 'google_ads' || provider === 'meta_ads') {
    const siblingError = await assertNoSiblingConnection(supabase, provider, digitalAssetId, asset.client_id)
    if (siblingError) return siblingError
  }

  const upsertPayload: Record<string, unknown> = { digital_asset_id: digitalAssetId, provider, status: 'disconnected' }
  if (provider === 'google_forms') upsertPayload.external_account_id = extractFormId(formIdInput as string)

  const { data: connection, error: connectionError } = await supabase
    .from('digital_asset_connections')
    .upsert(upsertPayload, { onConflict: 'digital_asset_id,provider', ignoreDuplicates: false })
    .select('id')
    .single()
  if (connectionError) return dbErrorResponse('handleConnect: upsert conexão', connectionError)

  // Meta: monta a URL de callback a partir do caminho da própria
  // requisição (troca só o final "/connect" por "/callback") combinado
  // com SUPABASE_URL — o "origin" visto de dentro da função é um
  // endereço interno, não o público. Google (Ads/Forms): usa
  // buildGoogleRedirectUri() em vez disso — ver comentário da função.
  const redirectUri =
    provider === 'meta_ads'
      ? `${Deno.env.get('SUPABASE_URL')}/functions/v1${url.pathname.replace(/\/connect$/, '/callback')}`
      : buildGoogleRedirectUri()

  let authorizationUrl: URL
  if (provider === 'meta_ads') {
    authorizationUrl = new URL(META_AUTHORIZE_URL)
    authorizationUrl.searchParams.set('client_id', Deno.env.get('META_APP_ID') ?? '')
    authorizationUrl.searchParams.set('redirect_uri', redirectUri)
    authorizationUrl.searchParams.set('response_type', 'code')
    authorizationUrl.searchParams.set('scope', META_SCOPE)
    authorizationUrl.searchParams.set('state', connection.id)
  } else {
    authorizationUrl = new URL(GOOGLE_AUTHORIZE_URL)
    authorizationUrl.searchParams.set('client_id', Deno.env.get(GOOGLE_OAUTH_CLIENT_ID_ENV) ?? '')
    authorizationUrl.searchParams.set('redirect_uri', redirectUri)
    authorizationUrl.searchParams.set('response_type', 'code')
    authorizationUrl.searchParams.set('access_type', 'offline')
    authorizationUrl.searchParams.set('prompt', 'consent')
    authorizationUrl.searchParams.set('scope', GOOGLE_SCOPES[provider])
    authorizationUrl.searchParams.set('state', connection.id)
  }

  return jsonResponse({ authorizationUrl: authorizationUrl.toString(), connectionId: connection.id })
}

/** Fase 28 — autentica a conta administradora da agência (MCC no
 * Google Ads, Business Manager no Meta) uma vez só, não por cliente.
 * Só admin (defesa em profundidade — a tela em Configurações > Agência
 * já esconde o botão pra gestor). Reaproveita o MESMO redirect_uri/rota
 * /callback de sempre — só o "state" muda (prefixo "agency:"), então
 * não precisa cadastrar nenhuma URI nova no Google Cloud Console/Meta. */
async function handleAgencyConnect(req: Request, url: URL) {
  const auth = await requireAdminOrGestor(req)
  if (auth instanceof Response) return auth
  if (auth.role !== 'admin') return jsonResponse({ error: 'Só o admin pode conectar a conta administradora.' }, 403)

  const provider = url.searchParams.get('provider')
  if (provider !== 'google_ads' && provider !== 'meta_ads') {
    return jsonResponse({ error: 'Provedor inválido. Use google_ads ou meta_ads.' }, 400)
  }

  if (provider !== 'meta_ads' && !Deno.env.get(GOOGLE_OAUTH_CLIENT_ID_ENV)) {
    return jsonResponse(
      { error: `As credenciais do Google ainda não foram configuradas nesta função (falta o segredo "${GOOGLE_OAUTH_CLIENT_ID_ENV}").` },
      400,
    )
  }
  if (provider === 'meta_ads' && !Deno.env.get('META_APP_ID')) {
    return jsonResponse(
      { error: 'As credenciais do Meta ainda não foram configuradas nesta função (falta o segredo META_APP_ID).' },
      400,
    )
  }

  const supabase = getServiceClient()

  const { data: connection, error: connectionError } = await supabase
    .from('agency_provider_connections')
    .upsert({ provider, status: 'disconnected' }, { onConflict: 'provider', ignoreDuplicates: false })
    .select('id')
    .single()
  if (connectionError) return dbErrorResponse('handleAgencyConnect: upsert conexão de agência', connectionError)

  const redirectUri =
    provider === 'meta_ads'
      ? `${Deno.env.get('SUPABASE_URL')}/functions/v1${url.pathname.replace(/\/agency-connect$/, '/callback')}`
      : buildGoogleRedirectUri()

  let authorizationUrl: URL
  if (provider === 'meta_ads') {
    authorizationUrl = new URL(META_AUTHORIZE_URL)
    authorizationUrl.searchParams.set('client_id', Deno.env.get('META_APP_ID') ?? '')
    authorizationUrl.searchParams.set('redirect_uri', redirectUri)
    authorizationUrl.searchParams.set('response_type', 'code')
    authorizationUrl.searchParams.set('scope', META_SCOPE)
    authorizationUrl.searchParams.set('state', `agency:${connection.id}`)
  } else {
    authorizationUrl = new URL(GOOGLE_AUTHORIZE_URL)
    authorizationUrl.searchParams.set('client_id', Deno.env.get(GOOGLE_OAUTH_CLIENT_ID_ENV) ?? '')
    authorizationUrl.searchParams.set('redirect_uri', redirectUri)
    authorizationUrl.searchParams.set('response_type', 'code')
    authorizationUrl.searchParams.set('access_type', 'offline')
    authorizationUrl.searchParams.set('prompt', 'consent')
    authorizationUrl.searchParams.set('scope', GOOGLE_SCOPES.google_ads)
    authorizationUrl.searchParams.set('state', `agency:${connection.id}`)
  }

  return jsonResponse({ authorizationUrl: authorizationUrl.toString() })
}

type CodeExchangeResult =
  | { ok: true; accessToken: string; refreshToken?: string; expiresIn: number }
  | { ok: false; step: string; body: unknown }

/** Meta: a troca é GET com parâmetros na URL (não POST), e o token de
 * curta duração (~1-2h) precisa ser trocado por um de longa duração
 * (60 dias) logo em seguida — não existe "refresh_token" separado
 * como no Google; renovar significa reexecutar essa mesma troca antes
 * do token vencer (ver `refreshMetaAccessToken`). Reaproveitada tanto
 * pela conexão por cliente (handleCallback) quanto pela conexão de
 * agência (handleAgencyCallback, Fase 28). */
async function exchangeMetaCode(code: string, redirectUri: string): Promise<CodeExchangeResult> {
  const shortTokenUrl = new URL(META_TOKEN_URL)
  shortTokenUrl.searchParams.set('client_id', Deno.env.get('META_APP_ID') ?? '')
  shortTokenUrl.searchParams.set('client_secret', Deno.env.get('META_APP_SECRET') ?? '')
  shortTokenUrl.searchParams.set('redirect_uri', redirectUri)
  shortTokenUrl.searchParams.set('code', code)

  const shortTokenRes = await fetch(shortTokenUrl.toString())
  const shortTokenBody = await shortTokenRes.json()
  if (!shortTokenRes.ok) return { ok: false, step: 'token curto', body: shortTokenBody }

  const longTokenUrl = new URL(META_TOKEN_URL)
  longTokenUrl.searchParams.set('grant_type', 'fb_exchange_token')
  longTokenUrl.searchParams.set('client_id', Deno.env.get('META_APP_ID') ?? '')
  longTokenUrl.searchParams.set('client_secret', Deno.env.get('META_APP_SECRET') ?? '')
  longTokenUrl.searchParams.set('fb_exchange_token', shortTokenBody.access_token)

  const longTokenRes = await fetch(longTokenUrl.toString())
  const longTokenBody = await longTokenRes.json()
  if (!longTokenRes.ok) return { ok: false, step: 'token longo', body: longTokenBody }

  return {
    ok: true,
    accessToken: longTokenBody.access_token as string,
    expiresIn: (longTokenBody.expires_in as number | undefined) ?? 5_184_000, // ~60 dias, padrão do Meta
  }
}

/** Reaproveitada tanto pela conexão por cliente (handleCallback) quanto
 * pela conexão de agência (handleAgencyCallback, Fase 28). */
async function exchangeGoogleCode(code: string, redirectUri: string): Promise<CodeExchangeResult> {
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get(GOOGLE_OAUTH_CLIENT_ID_ENV) ?? '',
      client_secret: Deno.env.get(GOOGLE_OAUTH_CLIENT_SECRET_ENV) ?? '',
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  })
  const tokenBody = await tokenRes.json()
  if (!tokenRes.ok) return { ok: false, step: 'token', body: tokenBody }

  return {
    ok: true,
    accessToken: tokenBody.access_token as string,
    refreshToken: tokenBody.refresh_token as string | undefined,
    expiresIn: (tokenBody.expires_in as number | undefined) ?? 3600,
  }
}

async function handleCallback(url: URL) {
  const state = url.searchParams.get('state')
  const code = url.searchParams.get('code')
  const oauthError = url.searchParams.get('error')

  if (!state) return callbackRedirect(false, 'Parâmetro "state" ausente.')

  // Fase 28: conexão de agência (Configurações > Agência) usa o MESMO
  // /callback já registrado no Google Cloud Console/Meta — só o prefixo
  // do "state" distingue as duas, pra não precisar cadastrar uma URI
  // nova em nenhum dos dois painéis externos.
  if (state.startsWith('agency:')) {
    return await handleAgencyCallback(url, state.slice('agency:'.length), code, oauthError)
  }

  const supabase = getServiceClient()

  const { data: connection, error: connectionError } = await supabase
    .from('digital_asset_connections')
    .select('id, provider, digital_asset_id, external_account_id')
    .eq('id', state)
    .maybeSingle()
  if (connectionError) return dbErrorRedirect('handleCallback: buscar conexão', connectionError)
  if (!connection) return callbackRedirect(false, 'Conexão não encontrada (state inválido).')

  if (oauthError || !code) {
    await supabase.from('digital_asset_connections').update({ status: 'error' }).eq('id', connection.id)
    return callbackRedirect(false, `Conexão cancelada ou recusada${oauthError ? `: ${oauthError}` : ''}.`)
  }

  // Meta: a requisição chega direto na função, então dá pra remontar a
  // partir do próprio path recebido. Google (Ads/Forms): a requisição
  // chega via proxy da Vercel (ver vercel.json) — o path visto aqui
  // dentro continua sendo o da Supabase, não o que o navegador usou de
  // verdade, então precisa ser o mesmo valor fixo de buildGoogleRedirectUri()
  // usado lá em handleConnect, não recalculado a partir do request.
  const redirectUri =
    connection.provider === 'meta_ads' ? `${Deno.env.get('SUPABASE_URL')}/functions/v1${url.pathname}` : buildGoogleRedirectUri()

  const exchange = connection.provider === 'meta_ads' ? await exchangeMetaCode(code, redirectUri) : await exchangeGoogleCode(code, redirectUri)
  if (!exchange.ok) {
    await supabase.from('digital_asset_connections').update({ status: 'error' }).eq('id', connection.id)
    return platformErrorRedirect(`handleCallback: trocar ${exchange.step}`, connection.provider === 'meta_ads' ? 'Meta' : 'Google', exchange.body)
  }
  const { accessToken, refreshToken, expiresIn } = exchange

  const { data: accessSecretId, error: accessSecretError } = await supabase.rpc('store_oauth_secret', { secret: accessToken })
  if (accessSecretError) {
    console.error('[integrations] handleCallback: guardar token de acesso:', accessSecretError)
    await supabase.from('digital_asset_connections').update({ status: 'error' }).eq('id', connection.id)
    return callbackRedirect(false, 'Não foi possível guardar o token com segurança.')
  }

  const tokenUpsert: Record<string, unknown> = {
    connection_id: connection.id,
    access_token_secret_id: accessSecretId,
    expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
  }
  if (refreshToken) {
    const { data: refreshSecretId } = await supabase.rpc('store_oauth_secret', { secret: refreshToken })
    if (refreshSecretId) tokenUpsert.refresh_token_secret_id = refreshSecretId
  }

  const { error: tokenUpsertError } = await supabase.from('oauth_tokens').upsert(tokenUpsert, { onConflict: 'connection_id' })
  if (tokenUpsertError) {
    console.error('[integrations] handleCallback: guardar oauth_tokens:', tokenUpsertError)
    await supabase.from('digital_asset_connections').update({ status: 'error' }).eq('id', connection.id)
    return callbackRedirect(false, 'Não foi possível salvar a conexão. Tente novamente.')
  }

  // Descobre qual conta de anúncios essa conta do Google/Meta enxerga,
  // e já grava — não derruba a conexão se isso falhar (dá pra tentar
  // de novo na primeira sincronização).
  if (connection.provider === 'google_ads') {
    try {
      // Fase 20 (achado ao vivo): nunca escolhe sozinho quando há mais de
      // 1 conta real disponível (ex: conta gerenciadora com várias
      // contas-cliente por baixo) — só resolve automático quando é
      // inequívoco (a conta mais comum: sem MCC nenhuma, só 1 opção). Com
      // 0 ou 2+ contas, fica "conectado" mas sem `external_account_id" —
      // o gestor escolhe manualmente depois (rota /accounts).
      const { accounts } = await discoverGoogleAdsClientAccounts(accessToken)
      if (accounts.length === 1) {
        await supabase
          .from('digital_asset_connections')
          .update({ external_account_id: accounts[0].customerId, login_customer_id: accounts[0].loginCustomerId })
          .eq('id', connection.id)
      } else {
        console.error(
          `[integrations] handleCallback: ${accounts.length} contas de Google Ads encontradas — precisa escolha manual:`,
          accounts,
        )
      }
    } catch (err) {
      console.error('[integrations] handleCallback: erro inesperado ao descobrir conta do Google Ads:', err)
      // segue sem quebrar a conexão — ver comentário acima
    }
  } else if (connection.provider === 'meta_ads') {
    try {
      const adAccountsRes = await fetch(
        `https://graph.facebook.com/${META_GRAPH_API_VERSION}/me/adaccounts?fields=id,name&access_token=${encodeURIComponent(accessToken)}`,
      )
      const adAccountsBody = await adAccountsRes.json()
      if (!adAccountsRes.ok) {
        console.error('[integrations] handleCallback: listar ad accounts do Meta falhou:', adAccountsBody)
      }
      const firstAccountId = adAccountsBody.data?.[0]?.id as string | undefined
      if (firstAccountId) {
        await supabase.from('digital_asset_connections').update({ external_account_id: firstAccountId }).eq('id', connection.id)
      } else if (adAccountsRes.ok) {
        console.error('[integrations] handleCallback: listar ad accounts do Meta ok mas sem nenhuma conta acessível:', adAccountsBody)
      }
    } catch (err) {
      console.error('[integrations] handleCallback: erro inesperado ao descobrir conta do Meta Ads:', err)
      // segue sem quebrar a conexão — ver comentário acima
    }
  } else if (connection.provider === 'google_forms') {
    // Fase 35.2 (bug real reportado pelo usuário): diferente de Google
    // Ads/Meta (onde "descobrir a conta" é best-effort e nunca derruba
    // a conexão), aqui a validação é OBRIGATÓRIA — o OAuth em si só
    // confirma o login do Google, não tem nada a ver com qual
    // formulário foi escolhido. Sem essa checagem, colar o link
    // PÚBLICO (.../forms/d/e/<id>/viewform, que tem um id diferente do
    // link de EDIÇÃO) fazia `extractFormId` capturar só "e" (o texto
    // entre as duas barras) e a conexão ficava "Conectada" mesmo
    // apontando pra um id que a API do Google Forms nunca vai achar.
    const formId = connection.external_account_id
    let formRes: Response | null = null
    let formBody: Record<string, unknown> | null = null
    try {
      formRes = await fetch(`${GOOGLE_FORMS_API_BASE}/${formId}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      formBody = await formRes.json()
    } catch (err) {
      console.error('[integrations] handleCallback: erro inesperado validando o formulário do Google Forms:', err)
    }

    if (!formRes || !formRes.ok) {
      await logServerError('integrations', 'handleCallback: validar formulário do Google Forms', formBody ?? { formId })
      await supabase.from('digital_asset_connections').update({ status: 'error' }).eq('id', connection.id)
      return callbackRedirect(
        false,
        'Não foi possível acessar esse formulário. Confirme que colou o link de EDIÇÃO do Google Forms (o que abre pra editar as perguntas) — o link público de resposta (.../viewform) não funciona aqui.',
      )
    }

    // Nome de verdade do formulário (diferente do nome do Ativo
    // Digital, que é só um rótulo escolhido por quem cadastrou) +
    // link público de resposta, preenchido sozinho no "Link de acesso"
    // do Ativo Digital pra dar pra abrir/reconhecer depois.
    const info = formBody?.info as { title?: string; documentTitle?: string } | undefined
    const title = info?.title ?? info?.documentTitle ?? null
    const responderUri = (formBody?.responderUri as string | undefined) ?? null

    await supabase.from('digital_asset_connections').update({ external_account_name: title }).eq('id', connection.id)
    if (responderUri) {
      await supabase.from('digital_assets').update({ url: responderUri }).eq('id', connection.digital_asset_id)
    }
  }

  const { error: statusUpdateError } = await supabase
    .from('digital_asset_connections')
    .update({ status: 'connected' })
    .eq('id', connection.id)
  if (statusUpdateError) {
    console.error('[integrations] handleCallback: marcar conexão como conectada:', statusUpdateError)
    return callbackRedirect(false, 'Não foi possível concluir a conexão. Tente novamente.')
  }

  return callbackRedirect(true, 'Integração conectada com sucesso.')
}

/** Fase 28 — mesma troca de código→token de handleCallback, só que
 * grava em agency_provider_connections/agency_oauth_tokens em vez de
 * digital_asset_connections/oauth_tokens. Chamada por handleCallback
 * quando o "state" começa com "agency:". */
async function handleAgencyCallback(url: URL, agencyConnectionId: string, code: string | null, oauthError: string | null) {
  const supabase = getServiceClient()

  const { data: connection, error: connectionError } = await supabase
    .from('agency_provider_connections')
    .select('id, provider')
    .eq('id', agencyConnectionId)
    .maybeSingle()
  if (connectionError) return dbErrorRedirect('handleAgencyCallback: buscar conexão de agência', connectionError)
  if (!connection) return callbackRedirect(false, 'Conexão de agência não encontrada (state inválido).', '/settings')

  if (oauthError || !code) {
    await supabase.from('agency_provider_connections').update({ status: 'error' }).eq('id', connection.id)
    return callbackRedirect(false, `Conexão cancelada ou recusada${oauthError ? `: ${oauthError}` : ''}.`, '/settings')
  }

  const redirectUri =
    connection.provider === 'meta_ads'
      ? `${Deno.env.get('SUPABASE_URL')}/functions/v1${url.pathname}`
      : buildGoogleRedirectUri()

  const exchange = connection.provider === 'meta_ads' ? await exchangeMetaCode(code, redirectUri) : await exchangeGoogleCode(code, redirectUri)
  if (!exchange.ok) {
    await supabase.from('agency_provider_connections').update({ status: 'error' }).eq('id', connection.id)
    console.error(`[integrations] handleAgencyCallback: trocar ${exchange.step} — erro da ${connection.provider === 'meta_ads' ? 'Meta' : 'Google'}:`, exchange.body)
    await logServerError('integrations', `handleAgencyCallback: trocar ${exchange.step}`, exchange.body)
    return callbackRedirect(false, `Não foi possível conectar com o ${connection.provider === 'meta_ads' ? 'Meta' : 'Google'}. Tente novamente.`, '/settings')
  }
  const { accessToken, refreshToken, expiresIn } = exchange

  const { data: accessSecretId, error: accessSecretError } = await supabase.rpc('store_oauth_secret', { secret: accessToken })
  if (accessSecretError) {
    console.error('[integrations] handleAgencyCallback: guardar token de acesso:', accessSecretError)
    await supabase.from('agency_provider_connections').update({ status: 'error' }).eq('id', connection.id)
    return callbackRedirect(false, 'Não foi possível guardar o token com segurança.', '/settings')
  }

  const tokenUpsert: Record<string, unknown> = {
    agency_connection_id: connection.id,
    access_token_secret_id: accessSecretId,
    expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
  }
  if (refreshToken) {
    const { data: refreshSecretId } = await supabase.rpc('store_oauth_secret', { secret: refreshToken })
    if (refreshSecretId) tokenUpsert.refresh_token_secret_id = refreshSecretId
  }

  const { error: tokenUpsertError } = await supabase.from('agency_oauth_tokens').upsert(tokenUpsert, { onConflict: 'agency_connection_id' })
  if (tokenUpsertError) {
    console.error('[integrations] handleAgencyCallback: guardar agency_oauth_tokens:', tokenUpsertError)
    await supabase.from('agency_provider_connections').update({ status: 'error' }).eq('id', connection.id)
    return callbackRedirect(false, 'Não foi possível salvar a conexão. Tente novamente.', '/settings')
  }

  // Meta: descobre o(s) Business Manager(s) que essa conta enxerga —
  // só grava sozinho quando é inequívoco (1 só), mesmo padrão já usado
  // pra conta de Google Ads em handleCallback. Com 0 ou 2+, fica
  // "conectado" sem external_account_id — o admin escolhe manualmente
  // depois (rota /agency-accounts, tela de Configurações > Agência).
  if (connection.provider === 'meta_ads') {
    try {
      const businesses = await discoverMetaBusinesses(accessToken)
      if (businesses.length === 1) {
        await supabase.from('agency_provider_connections').update({ external_account_id: businesses[0].id }).eq('id', connection.id)
      } else {
        console.error(`[integrations] handleAgencyCallback: ${businesses.length} Business Manager(s) encontrado(s) — precisa escolha manual:`, businesses)
      }
    } catch (err) {
      console.error('[integrations] handleAgencyCallback: erro inesperado ao descobrir Business Manager:', err)
      // segue sem quebrar a conexão — ver comentário acima
    }
  }

  const { error: statusUpdateError } = await supabase
    .from('agency_provider_connections')
    .update({ status: 'connected' })
    .eq('id', connection.id)
  if (statusUpdateError) {
    console.error('[integrations] handleAgencyCallback: marcar conexão como conectada:', statusUpdateError)
    return callbackRedirect(false, 'Não foi possível concluir a conexão. Tente novamente.', '/settings')
  }

  return callbackRedirect(true, 'Conta administradora conectada com sucesso.', '/settings')
}

function googleAdsHeaders(accessToken: string, loginCustomerId?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'developer-token': Deno.env.get(GOOGLE_ADS_DEVELOPER_TOKEN_ENV) ?? '',
    'Content-Type': 'application/json',
  }
  if (loginCustomerId) headers['login-customer-id'] = loginCustomerId
  return headers
}

type GoogleAdsClientAccount = { customerId: string; loginCustomerId: string; name: string | null; testAccount: boolean }

/** Info de diagnóstico de cada conta raiz (normalmente um MCC) que
 * `listAccessibleCustomers` devolveu pro login OAuth atual — usada tanto
 * pra mostrar "qual MCC está conectado" (Configurações > Agência) quanto
 * pra explicar um "nenhuma conta encontrada" real (`error` preenchido
 * quando a consulta daquela raiz falhou, em vez de engolir em silêncio). */
type GoogleAdsRootInfo = { id: string; name: string | null; manager: boolean; testAccount: boolean; error?: string }
type GoogleAdsDiscoveryResult = { accounts: GoogleAdsClientAccount[]; roots: GoogleAdsRootInfo[] }

function extractGoogleAdsErrorMessage(body: unknown): string {
  const b = body as { error?: { message?: string; details?: Array<{ errors?: Array<{ message?: string }> }> } }
  const fromDetails = b?.error?.details?.flatMap((d) => d.errors?.map((e) => e.message).filter(Boolean) ?? []).join('; ')
  return fromDetails || b?.error?.message || 'Erro desconhecido do Google Ads'
}

/** Descobre as contas de anúncio REAIS que a conta do Google logada
 * enxerga — nunca inclui uma conta gerenciadora (MCC), essas só servem
 * de ponte (`login-customer-id`), não têm campanha nem métrica
 * própria e por isso nunca são uma opção escolhível. Pra cada raiz que
 * `listAccessibleCustomers` devolve, consulta `customer_client` usando
 * essa raiz como `login-customer-id` — isso devolve tanto a própria
 * conta (se não for gerenciadora — caso mais comum, conta avulsa sem
 * MCC nenhuma) quanto todas as contas-cliente reais por baixo dela (se
 * for uma gerenciadora), incluindo o nome da própria raiz (útil pra
 * identificação em `roots`). Usada tanto na descoberta automática
 * (`handleCallback`) quanto na escolha manual (`/accounts`, `/agency-accounts`). */
async function discoverGoogleAdsClientAccounts(accessToken: string): Promise<GoogleAdsDiscoveryResult> {
  const rootsRes = await fetch(`https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers:listAccessibleCustomers`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': Deno.env.get(GOOGLE_ADS_DEVELOPER_TOKEN_ENV) ?? '',
    },
  })
  const rootsBody = await rootsRes.json()
  if (!rootsRes.ok) {
    console.error('[integrations] discoverGoogleAdsClientAccounts: listAccessibleCustomers falhou:', rootsBody)
    throw new Error(extractGoogleAdsErrorMessage(rootsBody))
  }
  const rootIds = ((rootsBody.resourceNames ?? []) as string[]).map((name) => name.split('/')[1]).filter(Boolean)

  const found = new Map<string, GoogleAdsClientAccount>()
  const roots: GoogleAdsRootInfo[] = []
  for (const rootId of rootIds) {
    // Conta de teste (criada só pra testar a integração, sem gasto real)
    // sempre vem com status = CLOSED do lado do Google, por design —
    // nunca ENABLED, mesmo estando 100% acessível pela API. GAQL não
    // aceita "OR" no WHERE (só combina condições com AND), então o
    // filtro "ENABLED ou de teste" é feito abaixo, em JS, depois de
    // buscar sem nenhum filtro de status.
    const gaqlQuery = `
      SELECT customer_client.id, customer_client.descriptive_name, customer_client.manager, customer_client.status, customer_client.test_account
      FROM customer_client
    `
    const clientsRes = await fetch(
      `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${rootId}/googleAds:search`,
      { method: 'POST', headers: googleAdsHeaders(accessToken, rootId), body: JSON.stringify({ query: gaqlQuery }) },
    )
    const clientsBody = await clientsRes.json()
    if (!clientsRes.ok) {
      console.error(`[integrations] discoverGoogleAdsClientAccounts: customer_client falhou pra raiz ${rootId}:`, clientsBody)
      roots.push({ id: rootId, name: null, manager: true, testAccount: false, error: extractGoogleAdsErrorMessage(clientsBody) })
      continue
    }
    let rootName: string | null = null
    let rootIsManager = false
    let rootIsTest = false
    for (const row of (clientsBody.results ?? []) as Array<{
      customerClient?: { id?: string; descriptiveName?: string; manager?: boolean; testAccount?: boolean; status?: string }
    }>) {
      const client = row.customerClient
      if (!client?.id) continue
      const isUsable = client.status === 'ENABLED' || !!client.testAccount
      if (client.id === rootId) {
        rootName = client.descriptiveName ?? null
        rootIsManager = !!client.manager
        rootIsTest = !!client.testAccount
      }
      if (client.manager) continue // nunca inclui conta gerenciadora/MCC na lista de contas escolhíveis
      if (!isUsable) continue // conta fechada/suspensa de verdade — só deixa passar ENABLED ou de teste
      if (!found.has(client.id)) {
        found.set(client.id, {
          customerId: client.id,
          loginCustomerId: rootId,
          name: client.descriptiveName ?? null,
          testAccount: !!client.testAccount,
        })
      }
    }
    roots.push({ id: rootId, name: rootName, manager: rootIsManager, testAccount: rootIsTest })
  }
  return { accounts: Array.from(found.values()), roots }
}

type MetaBusiness = { id: string; name: string | null }

/** Fase 28 — lista os Business Managers que a conta do Meta logada
 * enxerga (`GET /me/businesses`), pra escolher qual usar como conta
 * administradora da agência. Só roda uma vez, em handleAgencyCallback
 * (auto-seleção quando há só 1) ou manualmente na tela de
 * Configurações > Agência (quando há 0 ou 2+). */
async function discoverMetaBusinesses(accessToken: string): Promise<MetaBusiness[]> {
  const businessesUrl = new URL(`https://graph.facebook.com/${META_GRAPH_API_VERSION}/me/businesses`)
  businessesUrl.searchParams.set('fields', 'id,name')
  businessesUrl.searchParams.set('access_token', accessToken)

  const businessesRes = await fetch(businessesUrl.toString())
  const businessesBody = await businessesRes.json()
  if (!businessesRes.ok) {
    console.error('[integrations] discoverMetaBusinesses: falhou:', businessesBody)
    return []
  }

  return ((businessesBody.data ?? []) as Array<{ id: string; name?: string }>).map((b) => ({ id: b.id, name: b.name ?? null }))
}

type MetaClientAdAccount = { id: string; name: string | null }

/** Fase 28 — lista as contas de anúncio compartilhadas com um Business
 * Manager específico (`GET /{business_id}/client_ad_accounts`) — só
 * contas de cliente já vinculadas ao BM da agência dentro do próprio
 * Meta Business Settings (vínculo manual, feito fora do app). */
async function discoverMetaClientAdAccounts(accessToken: string, businessId: string): Promise<MetaClientAdAccount[]> {
  const accountsUrl = new URL(`https://graph.facebook.com/${META_GRAPH_API_VERSION}/${businessId}/client_ad_accounts`)
  accountsUrl.searchParams.set('fields', 'id,name')
  accountsUrl.searchParams.set('access_token', accessToken)

  const accountsRes = await fetch(accountsUrl.toString())
  const accountsBody = await accountsRes.json()
  if (!accountsRes.ok) {
    console.error('[integrations] discoverMetaClientAdAccounts: falhou:', accountsBody)
    return []
  }

  return ((accountsBody.data ?? []) as Array<{ id: string; name?: string }>).map((a) => ({ id: a.id, name: a.name ?? null }))
}

type RefreshResult = { accessToken: string; expiresIn: number } | null

/** Sem "refresh_token" separado no Meta — renova reexecutando a troca
 * por um token de longa duração novo, usando o token atual (que ainda
 * precisa estar válido; se já venceu de vez, não tem como renovar e a
 * conexão precisa ser refeita). Reaproveitada por getValidAccessToken
 * (conexão por cliente, legada) e getValidAgencyAccessToken (Fase 28). */
async function refreshMetaAccessToken(currentToken: string): Promise<RefreshResult> {
  const longTokenUrl = new URL(META_TOKEN_URL)
  longTokenUrl.searchParams.set('grant_type', 'fb_exchange_token')
  longTokenUrl.searchParams.set('client_id', Deno.env.get('META_APP_ID') ?? '')
  longTokenUrl.searchParams.set('client_secret', Deno.env.get('META_APP_SECRET') ?? '')
  longTokenUrl.searchParams.set('fb_exchange_token', currentToken)

  const longTokenRes = await fetch(longTokenUrl.toString())
  const longTokenBody = await longTokenRes.json()
  if (!longTokenRes.ok) {
    await logServerError('integrations', 'refreshMetaAccessToken: Meta recusou renovar o token', longTokenBody)
    return null
  }

  return { accessToken: longTokenBody.access_token as string, expiresIn: (longTokenBody.expires_in as number | undefined) ?? 5_184_000 }
}

/** Reaproveitada por getValidAccessToken (conexão por cliente, legada)
 * e getValidAgencyAccessToken (Fase 28). Antes falhava em silêncio (só
 * `return null`, sem log nenhum) — quem via "Não foi possível obter um
 * token de acesso válido" no app não tinha como saber SE o problema era
 * um `invalid_grant` (refresh_token revogado/vencido — precisa
 * reconectar) ou outra coisa. Motivo mais comum de `invalid_grant`
 * aqui: enquanto o app de OAuth do Google Cloud estiver em modo "Testing"
 * (não publicado/verificado — ver item 31 do TESTES.md), o Google expira
 * QUALQUER refresh_token sozinho depois de 7 dias, então toda conexão
 * — mesmo uma que sincronizava perfeitamente antes — para de funcionar
 * sozinha depois de uma semana até a verificação sair; a única forma de
 * voltar a funcionar antes disso é desconectar e conectar de novo (gera
 * um refresh_token novo, com outros 7 dias de validade). */
async function refreshGoogleAccessToken(refreshToken: string): Promise<RefreshResult> {
  const refreshRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get(GOOGLE_OAUTH_CLIENT_ID_ENV) ?? '',
      client_secret: Deno.env.get(GOOGLE_OAUTH_CLIENT_SECRET_ENV) ?? '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const refreshBody = await refreshRes.json()
  if (!refreshRes.ok) {
    await logServerError('integrations', 'refreshGoogleAccessToken: Google recusou renovar o token', refreshBody)
    return null
  }

  return { accessToken: refreshBody.access_token as string, expiresIn: (refreshBody.expires_in as number | undefined) ?? 3600 }
}

/** Conexão por cliente (legada, OAuth próprio) — ver getValidAgencyAccessToken
 * pro caminho novo (Fase 28, conexão de agência). */
async function getValidAccessToken(supabase: SupabaseClient, connectionId: string, provider: Provider): Promise<string | null> {
  const { data: tokenRow } = await supabase
    .from('oauth_tokens')
    .select('access_token_secret_id, refresh_token_secret_id, expires_at')
    .eq('connection_id', connectionId)
    .maybeSingle()
  if (!tokenRow) return null

  const isExpiringSoon = tokenRow.expires_at ? new Date(tokenRow.expires_at).getTime() < Date.now() + 60_000 : false

  if (!isExpiringSoon) {
    const { data: accessToken } = await supabase.rpc('read_oauth_secret', { secret_id: tokenRow.access_token_secret_id })
    return (accessToken as string | null) ?? null
  }

  if (provider === 'meta_ads') {
    const { data: currentToken } = await supabase.rpc('read_oauth_secret', { secret_id: tokenRow.access_token_secret_id })
    if (!currentToken) return null

    const refreshed = await refreshMetaAccessToken(currentToken as string)
    if (!refreshed) {
      await supabase.from('digital_asset_connections').update({ status: 'error' }).eq('id', connectionId)
      return null
    }

    const { data: newAccessSecretId } = await supabase.rpc('store_oauth_secret', { secret: refreshed.accessToken })
    await supabase
      .from('oauth_tokens')
      .update({
        access_token_secret_id: newAccessSecretId,
        expires_at: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
      })
      .eq('connection_id', connectionId)

    return refreshed.accessToken
  }

  if (!tokenRow.refresh_token_secret_id) return null
  const { data: refreshToken } = await supabase.rpc('read_oauth_secret', { secret_id: tokenRow.refresh_token_secret_id })
  if (!refreshToken) return null

  const refreshed = await refreshGoogleAccessToken(refreshToken as string)
  if (!refreshed) {
    // Antes: ficava "Conectada" pra sempre mesmo com o refresh_token
    // morto — sync falhava em loop, sem nenhum sinal visual de que
    // precisava reconectar. Meta já fazia isso (ver o bloco acima);
    // Google tinha ficado pra trás.
    await supabase.from('digital_asset_connections').update({ status: 'error' }).eq('id', connectionId)
    return null
  }

  const { data: newAccessSecretId } = await supabase.rpc('store_oauth_secret', { secret: refreshed.accessToken })
  await supabase
    .from('oauth_tokens')
    .update({
      access_token_secret_id: newAccessSecretId,
      expires_at: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
    })
    .eq('connection_id', connectionId)

  return refreshed.accessToken
}

/** Fase 28 — mesma ideia de getValidAccessToken, só que pra conexão de
 * agência (1 por provedor, não por cliente): busca pelo provider em
 * agency_provider_connections/agency_oauth_tokens em vez de por
 * connection_id. Usada por syncConnection/handleListCampaigns (via
 * resolveAccessToken) e por handleListAgencyAccounts quando a conexão
 * do cliente já foi migrada pro modelo novo. */
async function getValidAgencyAccessToken(supabase: SupabaseClient, provider: 'google_ads' | 'meta_ads'): Promise<string | null> {
  const { data: agencyConnection } = await supabase
    .from('agency_provider_connections')
    .select('id')
    .eq('provider', provider)
    .eq('status', 'connected')
    .maybeSingle()
  if (!agencyConnection) return null

  const { data: tokenRow } = await supabase
    .from('agency_oauth_tokens')
    .select('access_token_secret_id, refresh_token_secret_id, expires_at')
    .eq('agency_connection_id', agencyConnection.id)
    .maybeSingle()
  if (!tokenRow) return null

  const isExpiringSoon = tokenRow.expires_at ? new Date(tokenRow.expires_at).getTime() < Date.now() + 60_000 : false

  if (!isExpiringSoon) {
    const { data: accessToken } = await supabase.rpc('read_oauth_secret', { secret_id: tokenRow.access_token_secret_id })
    return (accessToken as string | null) ?? null
  }

  if (provider === 'meta_ads') {
    const { data: currentToken } = await supabase.rpc('read_oauth_secret', { secret_id: tokenRow.access_token_secret_id })
    if (!currentToken) return null

    const refreshed = await refreshMetaAccessToken(currentToken as string)
    if (!refreshed) {
      await supabase.from('agency_provider_connections').update({ status: 'error' }).eq('id', agencyConnection.id)
      return null
    }

    const { data: newAccessSecretId } = await supabase.rpc('store_oauth_secret', { secret: refreshed.accessToken })
    await supabase
      .from('agency_oauth_tokens')
      .update({
        access_token_secret_id: newAccessSecretId,
        expires_at: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
      })
      .eq('agency_connection_id', agencyConnection.id)

    return refreshed.accessToken
  }

  if (!tokenRow.refresh_token_secret_id) return null
  const { data: refreshToken } = await supabase.rpc('read_oauth_secret', { secret_id: tokenRow.refresh_token_secret_id })
  if (!refreshToken) return null

  const refreshed = await refreshGoogleAccessToken(refreshToken as string)
  if (!refreshed) {
    await supabase.from('agency_provider_connections').update({ status: 'error' }).eq('id', agencyConnection.id)
    return null
  }

  const { data: newAccessSecretId } = await supabase.rpc('store_oauth_secret', { secret: refreshed.accessToken })
  await supabase
    .from('agency_oauth_tokens')
    .update({
      access_token_secret_id: newAccessSecretId,
      expires_at: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
    })
    .eq('agency_connection_id', agencyConnection.id)

  return refreshed.accessToken
}

type SyncableConnection = {
  id: string
  provider: Provider
  external_account_id: string | null
  login_customer_id: string | null
  agency_provider_connection_id: string | null
  digital_assets: { client_id: string } | { client_id: string }[]
}

/** Fase 28 — ponto único de decisão entre os dois caminhos de token:
 * conexão nova (agency_provider_connection_id preenchido, escolhida a
 * partir da conta administradora) usa getValidAgencyAccessToken;
 * conexão antiga (OAuth próprio, coluna nula) continua em
 * getValidAccessToken, sem nenhuma mudança de comportamento. */
async function resolveAccessToken(
  supabase: SupabaseClient,
  connection: { id: string; provider: Provider; agency_provider_connection_id: string | null },
): Promise<string | null> {
  if (connection.agency_provider_connection_id && (connection.provider === 'google_ads' || connection.provider === 'meta_ads')) {
    return await getValidAgencyAccessToken(supabase, connection.provider)
  }
  return await getValidAccessToken(supabase, connection.id, connection.provider)
}

type SyncResult = { ok: true; syncedDays: number } | { ok: false; error: string }

/** Núcleo da sincronização de UMA conexão (Google Ads ou Meta Ads) —
 * nunca lança erro, sempre devolve um resultado. Reaproveitado pela
 * rota /sync (um clique, autenticada por login) e por /sync-all
 * (rodada pelo cron a cada poucas horas, ver handleSyncAll). */
async function syncConnection(supabase: SupabaseClient, connection: SyncableConnection): Promise<SyncResult> {
  if (connection.provider !== 'google_ads' && connection.provider !== 'meta_ads') {
    return { ok: false, error: 'Sincronização só implementada pra Google Ads e Meta Ads' }
  }
  if (!connection.external_account_id) {
    return { ok: false, error: 'Conexão incompleta (falta conta de anúncios)' }
  }

  const accessToken = await resolveAccessToken(supabase, connection)
  if (!accessToken) return { ok: false, error: 'Não foi possível obter um token de acesso válido' }

  const byDate = new Map<string, { spend: number; clicks: number; impressions: number; conversions: number }>()
  // Mesmos números que "byDate", só que quebrados por campanha também —
  // alimenta campaign_performance_snapshots (Fase 8.1b), sem mudar em
  // nada o agregado por conta que já existia (performance_snapshots).
  // searchRankLostIS/searchBudgetLostIS/budgetAmount só existem no
  // Google Ads (recurso `campaign`, não somam entre dias — cada linha
  // já vem segmentada por dia, então é atribuição direta, não soma) e
  // só têm valor real em campanhas de Pesquisa; nas outras a própria
  // API devolve 0/ausente, que vira null na UI (mesmo padrão de toda
  // métrica opcional do app).
  const byCampaign = new Map<
    string,
    {
      campaignId: string
      campaignName: string
      date: string
      spend: number
      clicks: number
      impressions: number
      conversions: number
      searchRankLostIS: number | null
      searchBudgetLostIS: number | null
      budgetAmount: number | null
      // Tipo de campanha (Search/Display/Vídeo/PMax/...) e valor de
      // conversão informado pela própria plataforma — não é a Receita
      // do app (calculada a partir de Leads), é o dado bruto que o
      // Google/Meta já calculam sozinhos, útil como referência de ROAS
      // aproximado. campaignType não soma entre dias (é estável, só a
      // última leitura importa); conversionValue soma como spend.
      campaignType: string | null
      conversionValue: number
      // Status atual da campanha (ENABLED/PAUSED/REMOVED no Google,
      // idem no Meta) — não soma entre dias, mesma lógica de
      // campaignType. Alimenta project_campaign_links.last_known_status
      // via check_campaign_state_changes() (Fase 32, alerta de mudança
      // de estado).
      status: string | null
    }
  >()

  if (connection.provider === 'google_ads') {
    const gaqlQuery = `
      SELECT segments.date, campaign.id, campaign.name, campaign.advertising_channel_type, campaign.status,
             metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions, metrics.conversions_value,
             metrics.search_rank_lost_impression_share, metrics.search_budget_lost_impression_share, campaign_budget.amount_micros
      FROM campaign
      WHERE segments.date DURING LAST_30_DAYS
    `

    const searchRes = await fetch(
      `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${connection.external_account_id}/googleAds:search`,
      {
        method: 'POST',
        headers: googleAdsHeaders(accessToken, connection.login_customer_id),
        body: JSON.stringify({ query: gaqlQuery }),
      },
    )
    const searchBody = await searchRes.json()
    if (!searchRes.ok) {
      return platformSyncError('syncConnection: Google Ads search', 'Google Ads', searchBody)
    }

    for (const row of (searchBody.results ?? []) as Array<Record<string, Record<string, unknown>>>) {
      const date = row.segments?.date as string | undefined
      if (!date) continue
      const acc = byDate.get(date) ?? { spend: 0, clicks: 0, impressions: 0, conversions: 0 }
      const spend = Number(row.metrics?.costMicros ?? 0) / 1_000_000
      const clicks = Number(row.metrics?.clicks ?? 0)
      const impressions = Number(row.metrics?.impressions ?? 0)
      const conversions = Number(row.metrics?.conversions ?? 0)
      acc.spend += spend
      acc.clicks += clicks
      acc.impressions += impressions
      acc.conversions += conversions
      byDate.set(date, acc)

      const campaignId = row.campaign?.id != null ? String(row.campaign.id) : undefined
      if (campaignId) {
        const key = `${campaignId}|${date}`
        const campAcc = byCampaign.get(key) ?? {
          campaignId,
          campaignName: (row.campaign?.name as string | undefined) ?? campaignId,
          date,
          spend: 0,
          clicks: 0,
          impressions: 0,
          conversions: 0,
          searchRankLostIS: null,
          searchBudgetLostIS: null,
          budgetAmount: null,
          campaignType: null,
          conversionValue: 0,
          status: null,
        }
        campAcc.spend += spend
        campAcc.clicks += clicks
        campAcc.impressions += impressions
        campAcc.conversions += conversions
        campAcc.conversionValue += Number(row.metrics?.conversionsValue ?? 0)
        campAcc.status = (row.campaign?.status as string | undefined) ?? campAcc.status
        const rankLostIS = row.metrics?.searchRankLostImpressionShare
        const budgetLostIS = row.metrics?.searchBudgetLostImpressionShare
        const budgetMicros = row.campaignBudget?.amountMicros
        campAcc.searchRankLostIS = rankLostIS != null ? Number(rankLostIS) * 100 : null
        campAcc.searchBudgetLostIS = budgetLostIS != null ? Number(budgetLostIS) * 100 : null
        campAcc.budgetAmount = budgetMicros != null ? Number(budgetMicros) / 1_000_000 : null
        campAcc.campaignType = (row.campaign?.advertisingChannelType as string | undefined) ?? campAcc.campaignType
        byCampaign.set(key, campAcc)
      }
    }

    // Campanha sem NENHUM dia com métrica nos últimos 30 dias (comum
    // em conta de teste, que não serve anúncio de verdade) nunca
    // aparece na consulta acima — a consulta é `FROM campaign` mas só
    // devolve linha pra combinação campanha+dia que teve alguma
    // atividade. Sem isso, tipo de campanha/status/orçamento nunca
    // eram sincronizados pra essa campanha, mesmo já vinculada a um
    // projeto. Consulta separada, sem filtro de data (tipo/status/
    // orçamento não mudam por dia), pra pegar TODA campanha ativa da
    // conta — cria uma linha "hoje" com métricas zeradas só pra essas
    // que não têm nenhuma linha ainda.
    const campaignMetaQuery = `
      SELECT campaign.id, campaign.name, campaign.advertising_channel_type, campaign.status, campaign_budget.amount_micros
      FROM campaign
      WHERE campaign.status != 'REMOVED'
    `
    const campaignMetaRes = await fetch(
      `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${connection.external_account_id}/googleAds:search`,
      { method: 'POST', headers: googleAdsHeaders(accessToken, connection.login_customer_id), body: JSON.stringify({ query: campaignMetaQuery }) },
    )
    if (campaignMetaRes.ok) {
      const campaignMetaBody = await campaignMetaRes.json()
      const knownCampaignIds = new Set(Array.from(byCampaign.values()).map((c) => c.campaignId))
      const today = new Date().toISOString().slice(0, 10)
      for (const row of (campaignMetaBody.results ?? []) as Array<Record<string, Record<string, unknown>>>) {
        const campaignId = row.campaign?.id != null ? String(row.campaign.id) : undefined
        if (!campaignId || knownCampaignIds.has(campaignId)) continue
        knownCampaignIds.add(campaignId)
        const budgetMicros = row.campaignBudget?.amountMicros
        byCampaign.set(`${campaignId}|${today}`, {
          campaignId,
          campaignName: (row.campaign?.name as string | undefined) ?? campaignId,
          date: today,
          spend: 0,
          clicks: 0,
          impressions: 0,
          conversions: 0,
          searchRankLostIS: null,
          searchBudgetLostIS: null,
          budgetAmount: budgetMicros != null ? Number(budgetMicros) / 1_000_000 : null,
          campaignType: (row.campaign?.advertisingChannelType as string | undefined) ?? null,
          conversionValue: 0,
          status: (row.campaign?.status as string | undefined) ?? null,
        })
      }
    } else {
      console.error('[integrations] syncConnection: metadados de campanha sem atividade falhou:', await campaignMetaRes.text())
    }
  } else {
    // meta_ads — Insights da Graph API, já quebrado por dia
    // (time_increment=1). "conversions" não existe como número único
    // no Meta — vem dentro de "actions" (lista de tipo de ação +
    // valor); somo todos os valores como uma aproximação razoável de
    // conversões, não uma contagem exata de um tipo específico
    // (refinável depois, se precisar discriminar por tipo de ação).
    // level=campaign devolve uma linha por campanha+dia (em vez de uma
    // linha por dia só, agregando a conta inteira) — dá pra montar os
    // dois níveis (byDate/byCampaign) a partir da mesma chamada.
    const insightsUrl = new URL(`https://graph.facebook.com/${META_GRAPH_API_VERSION}/${connection.external_account_id}/insights`)
    insightsUrl.searchParams.set('level', 'campaign')
    insightsUrl.searchParams.set('fields', 'campaign_id,campaign_name,spend,clicks,impressions,actions,action_values')
    insightsUrl.searchParams.set('date_preset', 'last_30d')
    insightsUrl.searchParams.set('time_increment', '1')
    insightsUrl.searchParams.set('access_token', accessToken)

    const insightsRes = await fetch(insightsUrl.toString())
    const insightsBody = await insightsRes.json()
    if (!insightsRes.ok) {
      return platformSyncError('syncConnection: Meta insights', 'Meta Ads', insightsBody)
    }

    // Objetivo da campanha (OUTCOME_SALES/OUTCOME_LEADS/...) e status
    // não vêm no Insights — são campos da campanha em si, então busca à
    // parte (1 chamada pra conta inteira, não por dia) e junta por
    // campaign_id. Não fatal — se falhar, campaignType/status só ficam
    // null (mesmo padrão do Índice de Qualidade em handleListAdGroups).
    // Status normalizado pro mesmo vocabulário do Google Ads
    // (PAUSED/REMOVED) pra check_campaign_state_changes() não precisar
    // conhecer 2 vocabulários diferentes.
    const campaignObjectives = new Map<string, string>()
    const campaignStatuses = new Map<string, string>()
    const campaignNames = new Map<string, string>()
    try {
      const objectivesUrl = new URL(`https://graph.facebook.com/${META_GRAPH_API_VERSION}/${connection.external_account_id}/campaigns`)
      objectivesUrl.searchParams.set('fields', 'id,name,objective,status')
      objectivesUrl.searchParams.set('access_token', accessToken)
      const objectivesRes = await fetch(objectivesUrl.toString())
      const objectivesBody = await objectivesRes.json()
      if (objectivesRes.ok) {
        for (const c of (objectivesBody.data ?? []) as Array<{ id: string; name?: string; objective?: string; status?: string }>) {
          if (c.name) campaignNames.set(c.id, c.name)
          if (c.objective) campaignObjectives.set(c.id, c.objective)
          if (c.status === 'PAUSED') campaignStatuses.set(c.id, 'PAUSED')
          else if (c.status === 'DELETED' || c.status === 'ARCHIVED') campaignStatuses.set(c.id, 'REMOVED')
          else if (c.status) campaignStatuses.set(c.id, 'ENABLED')
        }
      }
    } catch {
      // segue sem tipo de campanha/status — não bloqueia a sincronização
    }

    for (const row of (insightsBody.data ?? []) as Array<Record<string, unknown>>) {
      const date = row.date_start as string | undefined
      if (!date) continue
      const actions = (row.actions ?? []) as Array<{ value?: string }>
      const actionValues = (row.action_values ?? []) as Array<{ value?: string }>
      const conversions = actions.reduce((sum, a) => sum + Number(a.value ?? 0), 0)
      const conversionValue = actionValues.reduce((sum, a) => sum + Number(a.value ?? 0), 0)
      const spend = Number(row.spend ?? 0)
      const clicks = Number(row.clicks ?? 0)
      const impressions = Number(row.impressions ?? 0)
      const acc = byDate.get(date) ?? { spend: 0, clicks: 0, impressions: 0, conversions: 0 }
      acc.spend += spend
      acc.clicks += clicks
      acc.impressions += impressions
      acc.conversions += conversions
      byDate.set(date, acc)

      const campaignId = row.campaign_id as string | undefined
      if (campaignId) {
        const key = `${campaignId}|${date}`
        const campAcc = byCampaign.get(key) ?? {
          campaignId,
          campaignName: (row.campaign_name as string | undefined) ?? campaignId,
          date,
          spend: 0,
          clicks: 0,
          impressions: 0,
          conversions: 0,
          searchRankLostIS: null,
          searchBudgetLostIS: null,
          budgetAmount: null,
          campaignType: campaignObjectives.get(campaignId) ?? null,
          conversionValue: 0,
          status: campaignStatuses.get(campaignId) ?? null,
        }
        campAcc.spend += spend
        campAcc.clicks += clicks
        campAcc.impressions += impressions
        campAcc.conversions += conversions
        campAcc.conversionValue += conversionValue
        byCampaign.set(key, campAcc)
      }
    }

    // Mesma lacuna do Google Ads: campanha sem nenhum dia de Insights
    // nos últimos 30 dias nunca aparece no loop acima — cria uma linha
    // "hoje" zerada só pra essas, pra objetivo/status não ficarem sem
    // sincronizar.
    const knownMetaCampaignIds = new Set(Array.from(byCampaign.values()).map((c) => c.campaignId))
    const allMetaCampaignIds = new Set([...campaignObjectives.keys(), ...campaignStatuses.keys(), ...campaignNames.keys()])
    const todayMeta = new Date().toISOString().slice(0, 10)
    for (const campaignId of allMetaCampaignIds) {
      if (knownMetaCampaignIds.has(campaignId)) continue
      byCampaign.set(`${campaignId}|${todayMeta}`, {
        campaignId,
        campaignName: campaignNames.get(campaignId) ?? campaignId,
        date: todayMeta,
        spend: 0,
        clicks: 0,
        impressions: 0,
        conversions: 0,
        searchRankLostIS: null,
        searchBudgetLostIS: null,
        budgetAmount: null,
        campaignType: campaignObjectives.get(campaignId) ?? null,
        conversionValue: 0,
        status: campaignStatuses.get(campaignId) ?? null,
      })
    }
  }

  const clientId = (connection.digital_assets as unknown as { client_id: string }).client_id
  const rows = Array.from(byDate.entries()).map(([date, m]) => ({
    client_id: clientId,
    snapshot_date: date,
    spend: m.spend,
    clicks: m.clicks,
    impressions: m.impressions,
    conversions: m.conversions,
    channel: connection.provider,
  }))

  if (rows.length > 0) {
    const { error: upsertError } = await supabase
      .from('performance_snapshots')
      .upsert(rows, { onConflict: 'client_id,channel,snapshot_date' })
    if (upsertError) return dbSyncError('syncConnection: upsert performance_snapshots', upsertError)
  }

  const campaignRows = Array.from(byCampaign.values()).map((c) => ({
    connection_id: connection.id,
    external_campaign_id: c.campaignId,
    external_campaign_name: c.campaignName,
    client_id: clientId,
    channel: connection.provider,
    snapshot_date: c.date,
    spend: c.spend,
    clicks: c.clicks,
    impressions: c.impressions,
    conversions: c.conversions,
    search_rank_lost_impression_share: c.searchRankLostIS,
    search_budget_lost_impression_share: c.searchBudgetLostIS,
    budget_amount: c.budgetAmount,
    campaign_type: c.campaignType,
    conversion_value: c.conversionValue,
    campaign_status: c.status,
  }))

  if (campaignRows.length > 0) {
    const { error: campaignUpsertError } = await supabase
      .from('campaign_performance_snapshots')
      .upsert(campaignRows, { onConflict: 'connection_id,external_campaign_id,snapshot_date' })
    if (campaignUpsertError) return dbSyncError('syncConnection: upsert campaign_performance_snapshots', campaignUpsertError)
  }

  await supabase.from('digital_asset_connections').update({ last_synced_at: new Date().toISOString() }).eq('id', connection.id)

  return { ok: true, syncedDays: rows.length }
}

type FormQuestionRow = {
  externalQuestionId: string
  title: string
  questionType: string
  options: string[] | null
  position: number
}

/** Normaliza o tipo de UMA pergunta (`questionItem.question` da API do
 * Forms) pro vocabulário fixo usado em `form_questions.question_type` —
 * ver lista completa no comentário da migration-033. */
function normalizeQuestionType(question: Record<string, unknown>): { questionType: string; options: string[] | null } {
  const choiceQuestion = question.choiceQuestion as Record<string, unknown> | undefined
  if (choiceQuestion) {
    const type = (choiceQuestion.type as string | undefined) ?? 'RADIO'
    const questionType = type === 'CHECKBOX' ? 'choice_checkbox' : type === 'DROP_DOWN' ? 'choice_dropdown' : 'choice_radio'
    const options = ((choiceQuestion.options as Array<{ value?: string }> | undefined) ?? [])
      .map((o) => o.value)
      .filter((v): v is string => !!v)
    return { questionType, options: options.length > 0 ? options : null }
  }

  const textQuestion = question.textQuestion as Record<string, unknown> | undefined
  if (textQuestion) {
    return { questionType: textQuestion.paragraph ? 'text_paragraph' : 'text_short', options: null }
  }

  if (question.scaleQuestion) return { questionType: 'scale', options: null }
  if (question.dateQuestion) return { questionType: 'date', options: null }
  if (question.timeQuestion) return { questionType: 'time', options: null }
  if (question.fileUploadQuestion) return { questionType: 'file_upload', options: null }

  return { questionType: 'other', options: null }
}

/** Achata `items[]` (resposta de `GET /v1/forms/{formId}`) numa linha
 * por pergunta — perguntas de grade (`questionGroupItem`) viram uma
 * linha por sub-pergunta (linha da grade), melhor esforço, é o formato
 * mais raro de aparecer. Itens sem pergunta (texto de seção, quebra de
 * página) são ignorados. */
function normalizeFormItems(items: Array<Record<string, unknown>>): FormQuestionRow[] {
  const rows: FormQuestionRow[] = []

  items.forEach((item, index) => {
    const title = (item.title as string | undefined) ?? ''
    const questionItem = item.questionItem as Record<string, unknown> | undefined
    if (questionItem) {
      const question = questionItem.question as Record<string, unknown> | undefined
      const questionId = question?.questionId as string | undefined
      if (!question || !questionId) return
      const { questionType, options } = normalizeQuestionType(question)
      rows.push({ externalQuestionId: questionId, title, questionType, options, position: index })
      return
    }

    const questionGroupItem = item.questionGroupItem as Record<string, unknown> | undefined
    if (questionGroupItem) {
      const questions = (questionGroupItem.questions as Array<Record<string, unknown>> | undefined) ?? []
      const grid = questionGroupItem.grid as Record<string, unknown> | undefined
      const columns = grid?.columns as Record<string, unknown> | undefined
      const gridOptions = ((columns?.options as Array<{ value?: string }> | undefined) ?? [])
        .map((o) => o.value)
        .filter((v): v is string => !!v)

      questions.forEach((subQuestion) => {
        const questionId = subQuestion.questionId as string | undefined
        if (!questionId) return
        const rowTitle = (subQuestion.rowQuestion as Record<string, unknown> | undefined)?.title as string | undefined
        rows.push({
          externalQuestionId: questionId,
          title: rowTitle ? `${title} — ${rowTitle}` : title,
          questionType: 'grid_row',
          options: gridOptions.length > 0 ? gridOptions : null,
          position: index,
        })
      })
    }
  })

  return rows
}

type FormAnswerRow = { externalQuestionId: string; answerText: string | null; answerValues: string[] | null }

/** Achata `answers{}` (dentro de UMA resposta, de `GET
 * /v1/forms/{formId}/responses`) numa linha por pergunta respondida —
 * `answerValues` preserva múltipla escolha como array; `answerText` é
 * só a versão pronta pra exibir (valores juntos com ", "). */
function normalizeFormAnswers(answers: Record<string, unknown>): FormAnswerRow[] {
  return Object.values(answers)
    .map((raw) => raw as Record<string, unknown>)
    .filter((answer) => typeof answer.questionId === 'string')
    .map((answer) => {
      const externalQuestionId = answer.questionId as string
      const textAnswers = answer.textAnswers as Record<string, unknown> | undefined
      const textValues = ((textAnswers?.answers as Array<{ value?: string }> | undefined) ?? [])
        .map((a) => a.value)
        .filter((v): v is string => !!v)
      if (textValues.length > 0) {
        return { externalQuestionId, answerText: textValues.join(', '), answerValues: textValues }
      }

      const fileUploadAnswers = answer.fileUploadAnswers as Record<string, unknown> | undefined
      const fileNames = ((fileUploadAnswers?.answers as Array<{ fileName?: string }> | undefined) ?? [])
        .map((f) => f.fileName)
        .filter((v): v is string => !!v)
      if (fileNames.length > 0) {
        return { externalQuestionId, answerText: fileNames.join(', '), answerValues: fileNames }
      }

      return { externalQuestionId, answerText: null, answerValues: null }
    })
}

type FormsSyncResult = { ok: true; syncedQuestions: number; syncedResponses: number } | { ok: false; error: string }

/** Núcleo da sincronização estruturada de UMA conexão de Google Forms
 * (Fase 8.2) — busca a estrutura do formulário e TODAS as respostas
 * (inclusive antigas, de antes da conexão existir) direto da API
 * oficial (forms.googleapis.com), usando o token OAuth que a conexão já
 * guarda desde a Fase 6.2. Reaproveitada por /sync e /sync-all, mesmo
 * contrato de `syncConnection` (nunca lança, sempre devolve um
 * resultado). Não mexe em nada do que /forms-webhook já faz (o Alerta
 * genérico continua sendo criado à parte, sem mudança). */
async function syncFormsConnection(supabase: SupabaseClient, connection: SyncableConnection): Promise<FormsSyncResult> {
  if (connection.provider !== 'google_forms') {
    return { ok: false, error: 'Sincronização estruturada só implementada pro Google Forms' }
  }
  if (!connection.external_account_id) {
    return { ok: false, error: 'Conexão incompleta (falta o id do formulário)' }
  }

  const accessToken = await getValidAccessToken(supabase, connection.id, 'google_forms')
  if (!accessToken) return { ok: false, error: 'Não foi possível obter um token de acesso válido' }

  const formId = connection.external_account_id

  const formRes = await fetch(`${GOOGLE_FORMS_API_BASE}/${formId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const formBody = await formRes.json()
  if (!formRes.ok) {
    return platformSyncError('syncFormsConnection: buscar estrutura do formulário', 'Google Forms', formBody)
  }

  const questionRows = normalizeFormItems((formBody.items ?? []) as Array<Record<string, unknown>>)
  if (questionRows.length > 0) {
    const { error: questionsError } = await supabase.from('form_questions').upsert(
      questionRows.map((q) => ({
        connection_id: connection.id,
        external_question_id: q.externalQuestionId,
        title: q.title,
        question_type: q.questionType,
        options: q.options,
        position: q.position,
      })),
      { onConflict: 'connection_id,external_question_id' },
    )
    if (questionsError) return dbSyncError('syncFormsConnection: upsert form_questions', questionsError)
  }

  const clientId = (connection.digital_assets as unknown as { client_id: string }).client_id

  let syncedResponses = 0
  let pageToken: string | undefined

  do {
    const responsesUrl = new URL(`${GOOGLE_FORMS_API_BASE}/${formId}/responses`)
    responsesUrl.searchParams.set('pageSize', '200')
    if (pageToken) responsesUrl.searchParams.set('pageToken', pageToken)

    const responsesRes = await fetch(responsesUrl.toString(), { headers: { Authorization: `Bearer ${accessToken}` } })
    const responsesBody = await responsesRes.json()
    if (!responsesRes.ok) {
      return platformSyncError('syncFormsConnection: buscar respostas', 'Google Forms', responsesBody)
    }

    const responses = (responsesBody.responses ?? []) as Array<Record<string, unknown>>
    for (const response of responses) {
      const externalResponseId = response.responseId as string | undefined
      if (!externalResponseId) continue

      const { data: responseRow, error: responseError } = await supabase
        .from('form_responses')
        .upsert(
          {
            connection_id: connection.id,
            external_response_id: externalResponseId,
            client_id: clientId,
            submitted_at: (response.lastSubmittedTime as string | undefined) ?? (response.createTime as string | undefined) ?? null,
          },
          { onConflict: 'connection_id,external_response_id' },
        )
        .select('id')
        .single()
      if (responseError) return dbSyncError('syncFormsConnection: upsert form_responses', responseError)

      const answerRows = normalizeFormAnswers((response.answers ?? {}) as Record<string, unknown>)
      if (answerRows.length > 0) {
        const { error: answersError } = await supabase.from('form_answers').upsert(
          answerRows.map((a) => ({
            response_id: responseRow.id,
            external_question_id: a.externalQuestionId,
            answer_text: a.answerText,
            answer_values: a.answerValues,
          })),
          { onConflict: 'response_id,external_question_id' },
        )
        if (answersError) return dbSyncError('syncFormsConnection: upsert form_answers', answersError)
      }

      syncedResponses += 1
    }

    pageToken = responsesBody.nextPageToken as string | undefined
  } while (pageToken)

  await supabase.from('digital_asset_connections').update({ last_synced_at: new Date().toISOString() }).eq('id', connection.id)

  return { ok: true, syncedQuestions: questionRows.length, syncedResponses }
}

async function handleSync(req: Request) {
  const auth = await requireAdminOrGestor(req)
  if (auth instanceof Response) return auth

  let body: { connection_id?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Corpo inválido' }, 400)
  }
  if (!body.connection_id) return jsonResponse({ error: 'connection_id é obrigatório' }, 400)

  const supabase = getServiceClient()

  const { data: connection, error: connectionError } = await supabase
    .from('digital_asset_connections')
    .select('id, provider, external_account_id, login_customer_id, agency_provider_connection_id, digital_assets(client_id)')
    .eq('id', body.connection_id)
    .maybeSingle()
  if (connectionError) return dbErrorResponse('handleSync: buscar conexão', connectionError)
  if (!connection) return jsonResponse({ error: 'Conexão não encontrada' }, 404)

  if (connection.provider === 'google_forms') {
    const result = await syncFormsConnection(supabase, connection as SyncableConnection)
    if (!result.ok) return jsonResponse({ error: result.error }, 502)
    return jsonResponse({ ok: true, syncedQuestions: result.syncedQuestions, syncedResponses: result.syncedResponses })
  }

  const result = await syncConnection(supabase, connection as SyncableConnection)
  if (!result.ok) return jsonResponse({ error: result.error }, 502)

  // Fase 21.2 (corrigido — faltava aqui): o botão "Sincronizar agora"
  // do front-end chama essa rota, não /sync-all (só o cron chama essa
  // outra, protegida por segredo) — sem essa chamada aqui, os
  // limiares de métrica nunca eram checados num teste manual.
  const { error: thresholdError } = await supabase.rpc('check_metric_alert_thresholds')
  if (thresholdError) await logServerError('integrations', 'handleSync: checar limiares de métrica', thresholdError)

  // Fase 32 — mesma lógica: checa se alguma campanha vinculada mudou
  // de estado (pausada/removida) ou teve o orçamento alterado
  // bruscamente, logo depois do sync.
  const { error: stateChangeError } = await supabase.rpc('check_campaign_state_changes')
  if (stateChangeError) await logServerError('integrations', 'handleSync: checar mudança de estado de campanha', stateChangeError)

  return jsonResponse({ ok: true, syncedDays: result.syncedDays })
}

/** Lista as campanhas reais de uma conta já conectada (Google Ads/Meta
 * Ads) — usada pelo campo de vincular um projeto a uma campanha
 * específica (Fase 8.1b). Só lê, não grava nada. */
async function handleListCampaigns(req: Request, url: URL) {
  const auth = await requireAdminOrGestor(req)
  if (auth instanceof Response) return auth

  const connectionId = url.searchParams.get('connection_id')
  if (!connectionId) return jsonResponse({ error: 'connection_id é obrigatório' }, 400)

  const supabase = getServiceClient()

  const { data: connection, error: connectionError } = await supabase
    .from('digital_asset_connections')
    .select('id, provider, external_account_id, login_customer_id, agency_provider_connection_id')
    .eq('id', connectionId)
    .maybeSingle()
  if (connectionError) return dbErrorResponse('handleListCampaigns: buscar conexão', connectionError)
  if (!connection) return jsonResponse({ error: 'Conexão não encontrada' }, 404)
  if (connection.provider !== 'google_ads' && connection.provider !== 'meta_ads') {
    return jsonResponse({ error: 'Listagem de campanhas só disponível pra Google Ads e Meta Ads' }, 400)
  }
  if (!connection.external_account_id) {
    return jsonResponse({ error: 'Conexão incompleta (falta conta de anúncios)' }, 400)
  }

  const accessToken = await resolveAccessToken(supabase, connection)
  if (!accessToken) return jsonResponse({ error: 'Não foi possível obter um token de acesso válido' }, 502)

  if (connection.provider === 'google_ads') {
    const gaqlQuery = `
      SELECT campaign.id, campaign.name, campaign.status
      FROM campaign
      WHERE campaign.status != 'REMOVED'
      ORDER BY campaign.name
    `
    const searchRes = await fetch(
      `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${connection.external_account_id}/googleAds:search`,
      { method: 'POST', headers: googleAdsHeaders(accessToken, connection.login_customer_id), body: JSON.stringify({ query: gaqlQuery }) },
    )
    const searchBody = await searchRes.json()
    if (!searchRes.ok) {
      return platformErrorResponse('handleListCampaigns', 'Google Ads', searchBody)
    }

    const campaigns = ((searchBody.results ?? []) as Array<Record<string, Record<string, unknown>>>).map((row) => ({
      id: String(row.campaign?.id ?? ''),
      name: (row.campaign?.name as string | undefined) ?? '',
      status: (row.campaign?.status as string | undefined) ?? '',
    }))
    return jsonResponse({ campaigns })
  }

  // meta_ads
  const campaignsUrl = new URL(`https://graph.facebook.com/${META_GRAPH_API_VERSION}/${connection.external_account_id}/campaigns`)
  campaignsUrl.searchParams.set('fields', 'id,name,status')
  campaignsUrl.searchParams.set('access_token', accessToken)

  const campaignsRes = await fetch(campaignsUrl.toString())
  const campaignsBody = await campaignsRes.json()
  if (!campaignsRes.ok) {
    return platformErrorResponse('handleListCampaigns', 'Meta Ads', campaignsBody)
  }

  const campaigns = ((campaignsBody.data ?? []) as Array<{ id: string; name: string; status: string }>).map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
  }))
  return jsonResponse({ campaigns })
}

/** Lista os grupos de anúncio de UMA campanha do Google Ads já
 * vinculada a um projeto — busca ao vivo (sem histórico salvo, ver
 * plano da aba "Grupos de Anúncios"), últimos 30 dias, com métricas
 * brutas (o frontend calcula CTR/CPC/Taxa de Conversão a partir
 * delas, mesma responsabilidade que `useCampaignPerformance` já tem
 * hoje). Índice de Qualidade vem de uma consulta SEPARADA
 * (`keyword_view`) porque é um dado por keyword, não por ad group —
 * a API não expõe isso agregado; a média por ad group é calculada
 * aqui em JS. Só Google Ads por enquanto (Meta Ads não expõe
 * "conjuntos de anúncios" nesta rota ainda). */
async function handleListAdGroups(req: Request, url: URL) {
  const auth = await requireAdminOrGestor(req)
  if (auth instanceof Response) return auth

  const connectionId = url.searchParams.get('connection_id')
  const campaignId = url.searchParams.get('campaign_id')
  if (!connectionId || !campaignId) return jsonResponse({ error: 'connection_id e campaign_id são obrigatórios' }, 400)

  const supabase = getServiceClient()

  const { data: connection, error: connectionError } = await supabase
    .from('digital_asset_connections')
    .select('id, provider, external_account_id, login_customer_id, agency_provider_connection_id')
    .eq('id', connectionId)
    .maybeSingle()
  if (connectionError) return dbErrorResponse('handleListAdGroups: buscar conexão', connectionError)
  if (!connection) return jsonResponse({ error: 'Conexão não encontrada' }, 404)
  if (connection.provider !== 'google_ads') {
    return jsonResponse({ error: 'Grupos de anúncio só disponíveis pra Google Ads por enquanto' }, 400)
  }
  if (!connection.external_account_id) {
    return jsonResponse({ error: 'Conexão incompleta (falta conta de anúncios)' }, 400)
  }

  const accessToken = await resolveAccessToken(supabase, connection)
  if (!accessToken) return jsonResponse({ error: 'Não foi possível obter um token de acesso válido' }, 502)

  const adGroupsQuery = `
    SELECT ad_group.id, ad_group.name, ad_group.status,
           metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions
    FROM ad_group
    WHERE campaign.id = ${campaignId} AND segments.date DURING LAST_30_DAYS
  `
  const adGroupsRes = await fetch(
    `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${connection.external_account_id}/googleAds:search`,
    { method: 'POST', headers: googleAdsHeaders(accessToken, connection.login_customer_id), body: JSON.stringify({ query: adGroupsQuery }) },
  )
  const adGroupsBody = await adGroupsRes.json()
  if (!adGroupsRes.ok) {
    return platformErrorResponse('handleListAdGroups: ad_group', 'Google Ads', adGroupsBody)
  }

  type AdGroupAcc = {
    id: string
    name: string
    status: string
    spend: number
    clicks: number
    impressions: number
    conversions: number
    qualityScoreSum: number
    qualityScoreCount: number
  }
  const byAdGroup = new Map<string, AdGroupAcc>()

  for (const row of (adGroupsBody.results ?? []) as Array<Record<string, Record<string, unknown>>>) {
    const id = row.adGroup?.id != null ? String(row.adGroup.id) : undefined
    if (!id) continue
    const acc = byAdGroup.get(id) ?? {
      id,
      name: (row.adGroup?.name as string | undefined) ?? id,
      status: (row.adGroup?.status as string | undefined) ?? '',
      spend: 0,
      clicks: 0,
      impressions: 0,
      conversions: 0,
      qualityScoreSum: 0,
      qualityScoreCount: 0,
    }
    acc.spend += Number(row.metrics?.costMicros ?? 0) / 1_000_000
    acc.clicks += Number(row.metrics?.clicks ?? 0)
    acc.impressions += Number(row.metrics?.impressions ?? 0)
    acc.conversions += Number(row.metrics?.conversions ?? 0)
    byAdGroup.set(id, acc)
  }

  // Índice de Qualidade — resource diferente (keyword_view), por
  // keyword; agrega em JS a média por ad group. Falha aqui não derruba
  // a resposta inteira (é um extra, não o essencial) — só fica sem a
  // coluna preenchida.
  const qualityScoreQuery = `
    SELECT ad_group.id, ad_group_criterion.quality_info.quality_score
    FROM keyword_view
    WHERE campaign.id = ${campaignId} AND ad_group_criterion.type = 'KEYWORD'
  `
  const qualityRes = await fetch(
    `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${connection.external_account_id}/googleAds:search`,
    { method: 'POST', headers: googleAdsHeaders(accessToken, connection.login_customer_id), body: JSON.stringify({ query: qualityScoreQuery }) },
  )
  if (qualityRes.ok) {
    const qualityBody = await qualityRes.json()
    for (const row of (qualityBody.results ?? []) as Array<Record<string, Record<string, unknown>>>) {
      const id = row.adGroup?.id != null ? String(row.adGroup.id) : undefined
      const score = (row.adGroupCriterion as Record<string, unknown> | undefined)?.qualityInfo as
        | Record<string, unknown>
        | undefined
      const qualityScore = score?.qualityScore
      if (!id || qualityScore == null) continue
      const acc = byAdGroup.get(id)
      if (!acc) continue
      acc.qualityScoreSum += Number(qualityScore)
      acc.qualityScoreCount += 1
    }
  } else {
    console.error('[integrations] handleListAdGroups: keyword_view (Índice de Qualidade) falhou:', await qualityRes.text())
  }

  const adGroups = Array.from(byAdGroup.values()).map((a) => ({
    id: a.id,
    name: a.name,
    status: a.status,
    spend: a.spend,
    clicks: a.clicks,
    impressions: a.impressions,
    conversions: a.conversions,
    avgQualityScore: a.qualityScoreCount > 0 ? a.qualityScoreSum / a.qualityScoreCount : null,
  }))
  return jsonResponse({ adGroups })
}

async function runGaqlQuery(
  externalAccountId: string,
  loginCustomerId: string | null,
  accessToken: string,
  query: string,
): Promise<{ ok: true; results: Array<Record<string, Record<string, unknown>>> } | { ok: false; error: unknown }> {
  const res = await fetch(
    `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${externalAccountId}/googleAds:search`,
    { method: 'POST', headers: googleAdsHeaders(accessToken, loginCustomerId), body: JSON.stringify({ query }) },
  )
  const body = await res.json()
  if (!res.ok) return { ok: false, error: body }
  return { ok: true, results: (body.results ?? []) as Array<Record<string, Record<string, unknown>>> }
}

/** Resumos curados de UMA campanha do Google Ads — dispositivo, top
 * termos de pesquisa, top palavras-chave, desempenho geográfico
 * (cidade/região), breakdown por ação de conversão, demográfico
 * (idade/gênero) e melhor dia/horário. Busca ao vivo (últimos 30 dias,
 * mesmo padrão de `handleListAdGroups`), 8 consultas GAQL
 * independentes: só a de dispositivo é obrigatória, as outras 7 falham
 * em silêncio (viram lista vazia/null) se o Google recusar — não
 * bloqueiam as demais. Idade/gênero só fazem sentido de verdade em
 * campanhas de Display/Vídeo/Demand Gen/PMax — o front decide se
 * mostra a seção, com base no tipo de campanha que já sincroniza (não
 * vale a pena não pedir aqui: a consulta simplesmente volta vazia numa
 * campanha de Pesquisa). Só Google Ads (Meta Ads fica pra depois). */
async function handleListCampaignInsights(req: Request, url: URL) {
  const auth = await requireAdminOrGestor(req)
  if (auth instanceof Response) return auth

  const connectionId = url.searchParams.get('connection_id')
  const campaignId = url.searchParams.get('campaign_id')
  if (!connectionId || !campaignId) return jsonResponse({ error: 'connection_id e campaign_id são obrigatórios' }, 400)

  const supabase = getServiceClient()

  const { data: connection, error: connectionError } = await supabase
    .from('digital_asset_connections')
    .select('id, provider, external_account_id, login_customer_id, agency_provider_connection_id')
    .eq('id', connectionId)
    .maybeSingle()
  if (connectionError) return dbErrorResponse('handleListCampaignInsights: buscar conexão', connectionError)
  if (!connection) return jsonResponse({ error: 'Conexão não encontrada' }, 404)
  if (connection.provider !== 'google_ads') {
    return jsonResponse({ error: 'Resumos de campanha só disponíveis pra Google Ads por enquanto' }, 400)
  }
  if (!connection.external_account_id) {
    return jsonResponse({ error: 'Conexão incompleta (falta conta de anúncios)' }, 400)
  }

  const accessToken = await resolveAccessToken(supabase, connection)
  if (!accessToken) return jsonResponse({ error: 'Não foi possível obter um token de acesso válido' }, 502)

  const runQuery = (query: string) =>
    runGaqlQuery(connection.external_account_id as string, connection.login_customer_id, accessToken, query)

  // Dispositivo — segmento padrão, disponível direto no recurso da
  // campanha, sem consulta extra de resolução de nome.
  const deviceResult = await runQuery(`
    SELECT segments.device, metrics.clicks, metrics.impressions, metrics.conversions, metrics.cost_micros
    FROM campaign
    WHERE campaign.id = ${campaignId} AND segments.date DURING LAST_30_DAYS
  `)
  if (!deviceResult.ok) return platformErrorResponse('handleListCampaignInsights: device', 'Google Ads', deviceResult.error)

  type DeviceAcc = { device: string; spend: number; clicks: number; impressions: number; conversions: number }
  const byDevice = new Map<string, DeviceAcc>()
  for (const row of deviceResult.results) {
    const device = (row.segments?.device as string | undefined) ?? 'UNKNOWN'
    const acc = byDevice.get(device) ?? { device, spend: 0, clicks: 0, impressions: 0, conversions: 0 }
    acc.spend += Number(row.metrics?.costMicros ?? 0) / 1_000_000
    acc.clicks += Number(row.metrics?.clicks ?? 0)
    acc.impressions += Number(row.metrics?.impressions ?? 0)
    acc.conversions += Number(row.metrics?.conversions ?? 0)
    byDevice.set(device, acc)
  }
  const devices = Array.from(byDevice.values()).sort((a, b) => b.spend - a.spend)

  // Top termos de pesquisa (só existe pra campanhas de Pesquisa) — o
  // próprio Google não revela o termo exato de boa parte do tráfego
  // (privacidade), então a lista nunca soma 100% do total da campanha.
  let topSearchTerms: Array<{ term: string; clicks: number; impressions: number; conversions: number }> = []
  const searchTermsResult = await runQuery(`
    SELECT search_term_view.search_term, metrics.clicks, metrics.impressions, metrics.conversions
    FROM search_term_view
    WHERE campaign.id = ${campaignId} AND segments.date DURING LAST_30_DAYS
    ORDER BY metrics.clicks DESC
    LIMIT 10
  `)
  if (searchTermsResult.ok) {
    topSearchTerms = searchTermsResult.results.map((row) => ({
      term: (row.searchTermView?.searchTerm as string | undefined) ?? '',
      clicks: Number(row.metrics?.clicks ?? 0),
      impressions: Number(row.metrics?.impressions ?? 0),
      conversions: Number(row.metrics?.conversions ?? 0),
    }))
  } else {
    console.error('[integrations] handleListCampaignInsights: search_term_view falhou:', searchTermsResult.error)
  }

  // Top palavras-chave configuradas (diferente dos termos de pesquisa
  // acima, que são o que o usuário digitou de fato).
  let topKeywords: Array<{ keyword: string; clicks: number; impressions: number; conversions: number }> = []
  const keywordsResult = await runQuery(`
    SELECT ad_group_criterion.keyword.text, metrics.clicks, metrics.impressions, metrics.conversions
    FROM keyword_view
    WHERE campaign.id = ${campaignId} AND ad_group_criterion.type = 'KEYWORD' AND segments.date DURING LAST_30_DAYS
    ORDER BY metrics.clicks DESC
    LIMIT 10
  `)
  if (keywordsResult.ok) {
    topKeywords = keywordsResult.results.map((row) => {
      const criterion = row.adGroupCriterion as Record<string, unknown> | undefined
      const keyword = criterion?.keyword as Record<string, unknown> | undefined
      return {
        keyword: (keyword?.text as string | undefined) ?? '',
        clicks: Number(row.metrics?.clicks ?? 0),
        impressions: Number(row.metrics?.impressions ?? 0),
        conversions: Number(row.metrics?.conversions ?? 0),
      }
    })
  } else {
    console.error('[integrations] handleListCampaignInsights: keyword_view (top palavras-chave) falhou:', keywordsResult.error)
  }

  // Geográfico (cidade/região) — geographic_view só devolve o ID do
  // alvo geográfico (ex: "geoTargetConstants/1023191"), não o nome; uma
  // segunda consulta em geo_target_constant resolve os nomes dos IDs
  // que realmente apareceram (só os top 10, não a lista inteira).
  let geoBreakdown: Array<{ name: string; clicks: number; impressions: number; conversions: number }> = []
  const geoResult = await runQuery(`
    SELECT segments.geo_target_city, segments.geo_target_region,
           metrics.clicks, metrics.impressions, metrics.conversions
    FROM geographic_view
    WHERE campaign.id = ${campaignId} AND segments.date DURING LAST_30_DAYS
  `)
  if (geoResult.ok) {
    type GeoAcc = { resourceName: string; clicks: number; impressions: number; conversions: number }
    const byGeo = new Map<string, GeoAcc>()
    for (const row of geoResult.results) {
      const segs = row.segments as Record<string, unknown> | undefined
      const resourceName = (segs?.geoTargetCity as string | undefined) || (segs?.geoTargetRegion as string | undefined)
      if (!resourceName) continue
      const acc = byGeo.get(resourceName) ?? { resourceName, clicks: 0, impressions: 0, conversions: 0 }
      acc.clicks += Number(row.metrics?.clicks ?? 0)
      acc.impressions += Number(row.metrics?.impressions ?? 0)
      acc.conversions += Number(row.metrics?.conversions ?? 0)
      byGeo.set(resourceName, acc)
    }
    const topGeo = Array.from(byGeo.values())
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10)

    const nameByResource = new Map<string, string>()
    if (topGeo.length > 0) {
      const resourceNames = topGeo.map((g) => `'${g.resourceName}'`).join(', ')
      const namesResult = await runQuery(`
        SELECT geo_target_constant.resource_name, geo_target_constant.canonical_name
        FROM geo_target_constant
        WHERE geo_target_constant.resource_name IN (${resourceNames})
      `)
      if (namesResult.ok) {
        for (const row of namesResult.results) {
          const constant = row.geoTargetConstant as Record<string, unknown> | undefined
          const resourceName = constant?.resourceName as string | undefined
          const canonicalName = constant?.canonicalName as string | undefined
          if (resourceName && canonicalName) nameByResource.set(resourceName, canonicalName)
        }
      } else {
        console.error('[integrations] handleListCampaignInsights: geo_target_constant falhou:', namesResult.error)
      }
    }

    geoBreakdown = topGeo.map((g) => ({
      name: nameByResource.get(g.resourceName) ?? g.resourceName,
      clicks: g.clicks,
      impressions: g.impressions,
      conversions: g.conversions,
    }))
  } else {
    console.error('[integrations] handleListCampaignInsights: geographic_view falhou:', geoResult.error)
  }

  // Breakdown por ação de conversão (ex: "Compra" vs "Lead" vs
  // "Adicionar ao carrinho") — sem isso, conversões de peso muito
  // diferente somam como se fossem iguais.
  let conversionBreakdown: Array<{ actionName: string; conversions: number; conversionValue: number }> = []
  const conversionActionResult = await runQuery(`
    SELECT segments.conversion_action_name, metrics.conversions, metrics.conversions_value
    FROM campaign
    WHERE campaign.id = ${campaignId} AND segments.date DURING LAST_30_DAYS
  `)
  if (conversionActionResult.ok) {
    type ConvAcc = { actionName: string; conversions: number; conversionValue: number }
    const byAction = new Map<string, ConvAcc>()
    for (const row of conversionActionResult.results) {
      const actionName = (row.segments?.conversionActionName as string | undefined) || ''
      if (!actionName) continue
      const acc = byAction.get(actionName) ?? { actionName, conversions: 0, conversionValue: 0 }
      acc.conversions += Number(row.metrics?.conversions ?? 0)
      acc.conversionValue += Number(row.metrics?.conversionsValue ?? 0)
      byAction.set(actionName, acc)
    }
    conversionBreakdown = Array.from(byAction.values())
      .filter((a) => a.conversions > 0)
      .sort((a, b) => b.conversions - a.conversions)
  } else {
    console.error('[integrations] handleListCampaignInsights: conversion action breakdown falhou:', conversionActionResult.error)
  }

  // Demográfico (Nível 2 do documento — só faz sentido de verdade em
  // Display/Vídeo/Demand Gen/PMax; o front decide se mostra a seção,
  // com base no tipo de campanha que já sincroniza. age_range_view e
  // gender_view são recursos SEPARADOS (o Google não deixa combinar
  // idade+gênero numa consulta só), por isso são 2 chamadas.
  let ageRanges: Array<{ range: string; clicks: number; impressions: number; conversions: number }> = []
  const ageResult = await runQuery(`
    SELECT ad_group_criterion.age_range.type, metrics.clicks, metrics.impressions, metrics.conversions
    FROM age_range_view
    WHERE campaign.id = ${campaignId} AND segments.date DURING LAST_30_DAYS
  `)
  if (ageResult.ok) {
    ageRanges = ageResult.results
      .map((row) => {
        const criterion = row.adGroupCriterion as Record<string, unknown> | undefined
        const ageRange = criterion?.ageRange as Record<string, unknown> | undefined
        return {
          range: (ageRange?.type as string | undefined) ?? 'UNDETERMINED',
          clicks: Number(row.metrics?.clicks ?? 0),
          impressions: Number(row.metrics?.impressions ?? 0),
          conversions: Number(row.metrics?.conversions ?? 0),
        }
      })
      .filter((a) => a.clicks > 0 || a.impressions > 0)
      .sort((a, b) => b.clicks - a.clicks)
  } else {
    console.error('[integrations] handleListCampaignInsights: age_range_view falhou:', ageResult.error)
  }

  let genders: Array<{ gender: string; clicks: number; impressions: number; conversions: number }> = []
  const genderResult = await runQuery(`
    SELECT ad_group_criterion.gender.type, metrics.clicks, metrics.impressions, metrics.conversions
    FROM gender_view
    WHERE campaign.id = ${campaignId} AND segments.date DURING LAST_30_DAYS
  `)
  if (genderResult.ok) {
    genders = genderResult.results
      .map((row) => {
        const criterion = row.adGroupCriterion as Record<string, unknown> | undefined
        const gender = criterion?.gender as Record<string, unknown> | undefined
        return {
          gender: (gender?.type as string | undefined) ?? 'UNDETERMINED',
          clicks: Number(row.metrics?.clicks ?? 0),
          impressions: Number(row.metrics?.impressions ?? 0),
          conversions: Number(row.metrics?.conversions ?? 0),
        }
      })
      .filter((g) => g.clicks > 0 || g.impressions > 0)
      .sort((a, b) => b.clicks - a.clicks)
  } else {
    console.error('[integrations] handleListCampaignInsights: gender_view falhou:', genderResult.error)
  }

  // Melhor dia/horário — devolvido como UM insight resumido (dia +
  // faixa de horário com melhor desempenho), não a tabela crua de
  // 7×24 combinações (o documento pede especificamente isso: tabela
  // crua "vira ruído, ninguém lê isso num relatório").
  let bestTiming: { dayOfWeek: string; hourBucket: string } | null = null
  const timingResult = await runQuery(`
    SELECT segments.day_of_week, segments.hour, metrics.clicks, metrics.conversions
    FROM campaign
    WHERE campaign.id = ${campaignId} AND segments.date DURING LAST_30_DAYS
  `)
  if (timingResult.ok) {
    const byDay = new Map<string, { clicks: number; conversions: number }>()
    const HOUR_BUCKETS = [
      { key: 'MADRUGADA', from: 0, to: 6 },
      { key: 'MANHA', from: 6, to: 12 },
      { key: 'TARDE', from: 12, to: 18 },
      { key: 'NOITE', from: 18, to: 24 },
    ]
    const byBucket = new Map<string, { clicks: number; conversions: number }>()
    for (const row of timingResult.results) {
      const day = row.segments?.dayOfWeek as string | undefined
      const hour = row.segments?.hour != null ? Number(row.segments.hour) : null
      const clicks = Number(row.metrics?.clicks ?? 0)
      const conversions = Number(row.metrics?.conversions ?? 0)
      if (day) {
        const acc = byDay.get(day) ?? { clicks: 0, conversions: 0 }
        acc.clicks += clicks
        acc.conversions += conversions
        byDay.set(day, acc)
      }
      if (hour != null) {
        const bucket = HOUR_BUCKETS.find((b) => hour >= b.from && hour < b.to)?.key ?? 'MADRUGADA'
        const acc = byBucket.get(bucket) ?? { clicks: 0, conversions: 0 }
        acc.clicks += clicks
        acc.conversions += conversions
        byBucket.set(bucket, acc)
      }
    }
    const pickBest = (m: Map<string, { clicks: number; conversions: number }>) =>
      Array.from(m.entries()).sort((a, b) => b[1].conversions - a[1].conversions || b[1].clicks - a[1].clicks)[0]?.[0] ?? null
    const bestDay = pickBest(byDay)
    const bestBucket = pickBest(byBucket)
    if (bestDay && bestBucket) bestTiming = { dayOfWeek: bestDay, hourBucket: bestBucket }
  } else {
    console.error('[integrations] handleListCampaignInsights: melhor dia/horário falhou:', timingResult.error)
  }

  return jsonResponse({ devices, topSearchTerms, topKeywords, geoBreakdown, conversionBreakdown, ageRanges, genders, bestTiming })
}

/** Chamada pelo job agendado (pg_cron + pg_net, ver
 * migration-019-fase64-cron.sql) a cada poucas horas — não tem login
 * de usuário por trás (roda sozinha, de dentro do Postgres), então se
 * autentica com um segredo compartilhado, mesmo padrão já usado em
 * /forms-webhook. Sincroniza todas as conexões "connected" de Google
 * Ads/Meta Ads (métricas) e Google Forms (perguntas+respostas
 * estruturadas, Fase 8.2), uma de cada vez, sem deixar uma falha
 * derrubar as outras (cada uma tenta renovar o token sozinha dentro de
 * syncConnection/syncFormsConnection, via getValidAccessToken). */
async function handleSyncAll(req: Request) {
  const secret = req.headers.get('X-Cron-Secret') ?? ''
  const expectedSecret = Deno.env.get('CRON_SECRET') ?? ''
  if (!expectedSecret || !safeCompare(secret, expectedSecret)) {
    return jsonResponse({ error: 'Não autorizado' }, 401)
  }

  const supabase = getServiceClient()

  const { data: connections, error: connectionsError } = await supabase
    .from('digital_asset_connections')
    .select('id, provider, external_account_id, login_customer_id, agency_provider_connection_id, digital_assets(client_id)')
    .eq('status', 'connected')
    .in('provider', ['google_ads', 'meta_ads', 'google_forms'])
  if (connectionsError) return dbErrorResponse('handleSyncAll: buscar conexões', connectionsError)

  const results: Array<{ connectionId: string } & (SyncResult | FormsSyncResult)> = []
  for (const connection of (connections ?? []) as SyncableConnection[]) {
    const result =
      connection.provider === 'google_forms'
        ? await syncFormsConnection(supabase, connection)
        : await syncConnection(supabase, connection)
    results.push({ connectionId: connection.id, ...result })
  }

  // Fase 21.2: confere os limiares de métrica configurados por cliente
  // logo depois do sync, já que é quando o dado novo chega — não
  // derruba a resposta do sync se falhar, só loga.
  const { error: thresholdError } = await supabase.rpc('check_metric_alert_thresholds')
  if (thresholdError) await logServerError('integrations', 'handleSyncAll: checar limiares de métrica', thresholdError)

  // Fase 32 — idem: checa mudança de estado de campanha vinculada
  // (pausada/removida/orçamento) a cada rodada do cron também.
  const { error: stateChangeError } = await supabase.rpc('check_campaign_state_changes')
  if (stateChangeError) await logServerError('integrations', 'handleSyncAll: checar mudança de estado de campanha', stateChangeError)

  return jsonResponse({ ok: true, results })
}

async function handleFormsWebhook(req: Request) {
  const secret = req.headers.get('X-Webhook-Secret') ?? ''
  const expectedSecret = Deno.env.get('FORMS_WEBHOOK_SECRET') ?? ''
  if (!expectedSecret || !safeCompare(secret, expectedSecret)) {
    return jsonResponse({ error: 'Não autorizado' }, 401)
  }

  let body: { formId?: string; responseId?: string; answers?: Record<string, string> }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Corpo inválido' }, 400)
  }
  if (!body.formId || !body.responseId) {
    return jsonResponse({ error: 'formId e responseId são obrigatórios' }, 400)
  }

  const supabase = getServiceClient()

  const { data: connection, error: connectionError } = await supabase
    .from('digital_asset_connections')
    .select('id, digital_assets(client_id)')
    .eq('provider', 'google_forms')
    .eq('external_account_id', body.formId)
    .maybeSingle()
  if (connectionError) return dbErrorResponse('handleFormsWebhook: buscar conexão', connectionError)
  if (!connection) return jsonResponse({ error: 'Nenhum formulário conectado com esse id' }, 404)

  const { error: dedupeError } = await supabase
    .from('form_response_events')
    .insert({ connection_id: connection.id, response_id: body.responseId })
  if (dedupeError) {
    if (dedupeError.code === '23505') return jsonResponse({ ok: true, duplicate: true })
    return dbErrorResponse('handleFormsWebhook: registrar dedup', dedupeError)
  }

  const clientId = (connection.digital_assets as unknown as { client_id: string }).client_id
  const answersText =
    Object.entries(body.answers ?? {})
      .map(([question, answer]) => `${question}: ${answer}`)
      .join('\n') || 'Resposta recebida sem respostas detalhadas.'

  const { error: alertError } = await supabase.from('alerts').insert({
    title: 'Nova resposta de formulário',
    message: answersText,
    client_id: clientId,
    severity: 'medium',
    category: 'novo_lead',
  })
  if (alertError) return dbErrorResponse('handleFormsWebhook: inserir alerta', alertError)

  return jsonResponse({ ok: true })
}

/** Lista as contas de anúncio reais do Google Ads que uma conexão
 * enxerga (Fase 20) — usada quando `handleCallback` não conseguiu
 * escolher sozinho (0 ou mais de 1 conta encontrada). Nunca inclui
 * conta gerenciadora/MCC (ver `discoverGoogleAdsClientAccounts`). */
async function handleListGoogleAdsAccounts(req: Request, url: URL) {
  const auth = await requireAdminOrGestor(req)
  if (auth instanceof Response) return auth

  const connectionId = url.searchParams.get('connection_id')
  if (!connectionId) return jsonResponse({ error: 'connection_id é obrigatório' }, 400)

  const supabase = getServiceClient()

  const { data: connection, error: connectionError } = await supabase
    .from('digital_asset_connections')
    .select('id, provider')
    .eq('id', connectionId)
    .maybeSingle()
  if (connectionError) return dbErrorResponse('handleListGoogleAdsAccounts: buscar conexão', connectionError)
  if (!connection) return jsonResponse({ error: 'Conexão não encontrada' }, 404)
  if (connection.provider !== 'google_ads') {
    return jsonResponse({ error: 'Essa listagem só existe pra conexões de Google Ads' }, 400)
  }

  const accessToken = await getValidAccessToken(supabase, connection.id, 'google_ads')
  if (!accessToken) return jsonResponse({ error: 'Não foi possível obter um token de acesso válido' }, 502)

  let discovery: GoogleAdsDiscoveryResult
  try {
    discovery = await discoverGoogleAdsClientAccounts(accessToken)
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Não foi possível listar as contas do Google.' }, 502)
  }
  return jsonResponse({
    accounts: discovery.accounts.map((a) => ({ id: a.customerId, name: a.name, loginCustomerId: a.loginCustomerId })),
  })
}

/** Grava qual conta de anúncios do Google Ads usar numa conexão —
 * chamada pelo gestor depois de escolher numa lista (Fase 20), quando
 * a descoberta automática não pôde decidir sozinha. */
async function handleSelectAccount(req: Request) {
  const auth = await requireAdminOrGestor(req)
  if (auth instanceof Response) return auth

  let body: { connection_id?: string; customer_id?: string; login_customer_id?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Corpo inválido' }, 400)
  }
  if (!body.connection_id || !body.customer_id || !body.login_customer_id) {
    return jsonResponse({ error: 'connection_id, customer_id e login_customer_id são obrigatórios' }, 400)
  }

  const supabase = getServiceClient()

  const { data: connection, error: connectionError } = await supabase
    .from('digital_asset_connections')
    .select('id, provider')
    .eq('id', body.connection_id)
    .maybeSingle()
  if (connectionError) return dbErrorResponse('handleSelectAccount: buscar conexão', connectionError)
  if (!connection) return jsonResponse({ error: 'Conexão não encontrada' }, 404)
  if (connection.provider !== 'google_ads') {
    return jsonResponse({ error: 'Essa escolha só existe pra conexões de Google Ads' }, 400)
  }

  const { error: updateError } = await supabase
    .from('digital_asset_connections')
    .update({ external_account_id: body.customer_id, login_customer_id: body.login_customer_id })
    .eq('id', connection.id)
  if (updateError) return dbErrorResponse('handleSelectAccount: gravar conta escolhida', updateError)

  return jsonResponse({ ok: true })
}

/** Fase 28 — lista as contas de cliente visíveis pela conta
 * administradora da agência (MCC/Business Manager), pra popular o
 * seletor no diálogo "Conectar integração" de um Ativo Digital. */
async function handleListAgencyAccounts(req: Request, url: URL) {
  const auth = await requireAdminOrGestor(req)
  if (auth instanceof Response) return auth

  const provider = url.searchParams.get('provider')
  if (provider !== 'google_ads' && provider !== 'meta_ads') {
    return jsonResponse({ error: 'Provedor inválido. Use google_ads ou meta_ads.' }, 400)
  }

  const supabase = getServiceClient()

  const { data: agencyConnection, error: agencyConnectionError } = await supabase
    .from('agency_provider_connections')
    .select('id, status, external_account_id')
    .eq('provider', provider)
    .maybeSingle()
  if (agencyConnectionError) return dbErrorResponse('handleListAgencyAccounts: buscar conexão de agência', agencyConnectionError)
  if (!agencyConnection || agencyConnection.status !== 'connected') {
    return jsonResponse({ error: 'Conecte a conta administradora em Configurações > Agência antes.' }, 409)
  }

  const accessToken = await getValidAgencyAccessToken(supabase, provider)
  if (!accessToken) return jsonResponse({ error: 'Não foi possível obter um token de acesso válido' }, 502)

  if (provider === 'google_ads') {
    let discovery: GoogleAdsDiscoveryResult
    try {
      discovery = await discoverGoogleAdsClientAccounts(accessToken)
    } catch (err) {
      return jsonResponse({ error: err instanceof Error ? err.message : 'Não foi possível listar as contas do Google.' }, 502)
    }
    const rootErrors = discovery.roots.filter((r) => r.error)
    // Se não achou nenhuma conta escolhível E teve erro numa raiz, o
    // motivo real não é "ninguém vinculou nada ainda" — é uma falha de
    // verdade na consulta (token/permissão/nível de acesso do developer
    // token) que antes ficava só no log do servidor, sem chegar pro
    // admin. Mostra ela em vez do aviso genérico.
    const warning =
      discovery.accounts.length === 0 && rootErrors.length > 0
        ? `Encontrei ${discovery.roots.length} conta(s) raiz no Google, mas não consegui ler os clientes: ${rootErrors
            .map((r) => `${r.id} — ${r.error}`)
            .join('; ')}`
        : undefined
    return jsonResponse({
      accounts: discovery.accounts.map((a) => ({
        id: a.customerId,
        name: a.name,
        loginCustomerId: a.loginCustomerId,
        testAccount: a.testAccount,
      })),
      roots: discovery.roots,
      warning,
    })
  }

  // meta_ads
  if (!agencyConnection.external_account_id) {
    return jsonResponse({ error: 'Escolha o Business Manager em Configurações > Agência antes.' }, 409)
  }
  const accounts = await discoverMetaClientAdAccounts(accessToken, agencyConnection.external_account_id)
  return jsonResponse({ accounts: accounts.map((a) => ({ id: a.id, name: a.name })) })
}

/** Fase 28 — grava a conta escolhida na lista de /agency-accounts numa
 * conexão de cliente, sem OAuth nenhum nessa etapa (a autenticação já
 * foi feita uma vez em Configurações > Agência). Cria a linha em
 * digital_asset_connections se ainda não existir, ou atualiza a que já
 * existe pra esse ativo+provedor — mesmo upsert de handleConnect. */
async function handleLinkAgencyAccount(req: Request) {
  const auth = await requireAdminOrGestor(req)
  if (auth instanceof Response) return auth

  let body: { digital_asset_id?: string; provider?: string; external_account_id?: string; login_customer_id?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Corpo inválido' }, 400)
  }
  const { digital_asset_id: digitalAssetId, provider, external_account_id: externalAccountId, login_customer_id: loginCustomerId } = body
  if (!digitalAssetId || (provider !== 'google_ads' && provider !== 'meta_ads') || !externalAccountId) {
    return jsonResponse({ error: 'digital_asset_id, provider (google_ads/meta_ads) e external_account_id são obrigatórios' }, 400)
  }
  if (provider === 'google_ads' && !loginCustomerId) {
    return jsonResponse({ error: 'login_customer_id é obrigatório pra Google Ads' }, 400)
  }

  const supabase = getServiceClient()

  const { data: agencyConnection, error: agencyConnectionError } = await supabase
    .from('agency_provider_connections')
    .select('id')
    .eq('provider', provider)
    .eq('status', 'connected')
    .maybeSingle()
  if (agencyConnectionError) return dbErrorResponse('handleLinkAgencyAccount: buscar conexão de agência', agencyConnectionError)
  if (!agencyConnection) return jsonResponse({ error: 'Conecte a conta administradora em Configurações > Agência antes.' }, 409)

  const { data: asset, error: assetError } = await supabase
    .from('digital_assets')
    .select('id, client_id')
    .eq('id', digitalAssetId)
    .maybeSingle()
  if (assetError) return dbErrorResponse('handleLinkAgencyAccount: buscar ativo digital', assetError)
  if (!asset) return jsonResponse({ error: 'Ativo digital não encontrado' }, 404)

  const siblingError = await assertNoSiblingConnection(supabase, provider, digitalAssetId, asset.client_id)
  if (siblingError) return siblingError

  const { error: upsertError } = await supabase.from('digital_asset_connections').upsert(
    {
      digital_asset_id: digitalAssetId,
      provider,
      status: 'connected',
      agency_provider_connection_id: agencyConnection.id,
      external_account_id: externalAccountId,
      login_customer_id: loginCustomerId ?? null,
    },
    { onConflict: 'digital_asset_id,provider', ignoreDuplicates: false },
  )
  if (upsertError) return dbErrorResponse('handleLinkAgencyAccount: gravar conexão', upsertError)

  return jsonResponse({ ok: true })
}

/** Fase 28 — só admin. Não desfaz conexões de cliente já vinculadas
 * (ficam sem token válido até a agência reconectar — mesmo espírito de
 * uma conexão legada cujo token expira sem conseguir renovar). */
async function handleAgencyDisconnect(req: Request) {
  const auth = await requireAdminOrGestor(req)
  if (auth instanceof Response) return auth
  if (auth.role !== 'admin') return jsonResponse({ error: 'Só o admin pode desconectar a conta administradora.' }, 403)

  let body: { provider?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Corpo inválido' }, 400)
  }
  if (body.provider !== 'google_ads' && body.provider !== 'meta_ads') {
    return jsonResponse({ error: 'Provedor inválido. Use google_ads ou meta_ads.' }, 400)
  }

  const supabase = getServiceClient()

  const { data: agencyConnection } = await supabase
    .from('agency_provider_connections')
    .select('id')
    .eq('provider', body.provider)
    .maybeSingle()

  const { error: updateError } = await supabase
    .from('agency_provider_connections')
    .update({ status: 'disconnected', external_account_id: null })
    .eq('provider', body.provider)
  if (updateError) return dbErrorResponse('handleAgencyDisconnect', updateError)

  if (agencyConnection) {
    await supabase.from('agency_oauth_tokens').delete().eq('agency_connection_id', agencyConnection.id)
  }

  return jsonResponse({ ok: true })
}

/** Fase 35.2 — desconectar a integração de um Ativo Digital (antes só
 * dava pra conectar, nunca desfazer — pedido explícito do usuário
 * porque o botão "Conectar integração" continuava aparecendo mesmo já
 * conectado). Mesmo espírito de handleAgencyDisconnect: mantém a linha
 * (histórico de last_synced_at etc.), só reseta pro estado
 * "desconectado" e apaga o token OAuth guardado. */
async function handleDisconnect(req: Request) {
  const auth = await requireAdminOrGestor(req)
  if (auth instanceof Response) return auth

  let body: { connection_id?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Corpo inválido' }, 400)
  }
  if (!body.connection_id) return jsonResponse({ error: 'connection_id é obrigatório' }, 400)

  const supabase = getServiceClient()

  const { error: updateError } = await supabase
    .from('digital_asset_connections')
    .update({ status: 'disconnected', external_account_id: null, external_account_name: null, login_customer_id: null })
    .eq('id', body.connection_id)
  if (updateError) return dbErrorResponse('handleDisconnect', updateError)

  await supabase.from('oauth_tokens').delete().eq('connection_id', body.connection_id)

  return jsonResponse({ ok: true })
}

/** Fase 28 — só existe pro Meta: quando handleAgencyCallback não
 * conseguiu escolher o Business Manager sozinho (0 ou 2+ encontrados),
 * lista de novo pra escolha manual em Configurações > Agência. */
async function handleListAgencyBusinesses(req: Request) {
  const auth = await requireAdminOrGestor(req)
  if (auth instanceof Response) return auth

  const supabase = getServiceClient()

  const { data: agencyConnection, error: agencyConnectionError } = await supabase
    .from('agency_provider_connections')
    .select('id, status')
    .eq('provider', 'meta_ads')
    .maybeSingle()
  if (agencyConnectionError) return dbErrorResponse('handleListAgencyBusinesses: buscar conexão de agência', agencyConnectionError)
  if (!agencyConnection || agencyConnection.status !== 'connected') {
    return jsonResponse({ error: 'Conecte a conta administradora do Meta em Configurações > Agência antes.' }, 409)
  }

  const accessToken = await getValidAgencyAccessToken(supabase, 'meta_ads')
  if (!accessToken) return jsonResponse({ error: 'Não foi possível obter um token de acesso válido' }, 502)

  const businesses = await discoverMetaBusinesses(accessToken)
  return jsonResponse({ businesses })
}

/** Fase 28 — grava qual Business Manager usar como conta administradora
 * do Meta, quando handleAgencyCallback não conseguiu decidir sozinho. */
async function handleSelectAgencyBusiness(req: Request) {
  const auth = await requireAdminOrGestor(req)
  if (auth instanceof Response) return auth
  if (auth.role !== 'admin') return jsonResponse({ error: 'Só o admin pode escolher o Business Manager.' }, 403)

  let body: { business_id?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Corpo inválido' }, 400)
  }
  if (!body.business_id) return jsonResponse({ error: 'business_id é obrigatório' }, 400)

  const supabase = getServiceClient()

  const { error: updateError } = await supabase
    .from('agency_provider_connections')
    .update({ external_account_id: body.business_id })
    .eq('provider', 'meta_ads')
  if (updateError) return dbErrorResponse('handleSelectAgencyBusiness', updateError)

  return jsonResponse({ ok: true })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)

  try {
    if (req.method === 'GET' && url.pathname.endsWith('/agency-connect')) return await handleAgencyConnect(req, url)
    if (req.method === 'GET' && url.pathname.endsWith('/agency-accounts')) return await handleListAgencyAccounts(req, url)
    if (req.method === 'GET' && url.pathname.endsWith('/agency-businesses')) return await handleListAgencyBusinesses(req)
    if (req.method === 'POST' && url.pathname.endsWith('/select-agency-business')) return await handleSelectAgencyBusiness(req)
    if (req.method === 'POST' && url.pathname.endsWith('/link-agency-account')) return await handleLinkAgencyAccount(req)
    if (req.method === 'POST' && url.pathname.endsWith('/agency-disconnect')) return await handleAgencyDisconnect(req)
    if (req.method === 'POST' && url.pathname.endsWith('/disconnect')) return await handleDisconnect(req)
    if (req.method === 'GET' && url.pathname.endsWith('/connect')) return await handleConnect(req, url)
    if (req.method === 'GET' && url.pathname.endsWith('/callback')) return await handleCallback(url)
    if (req.method === 'GET' && url.pathname.endsWith('/campaigns')) return await handleListCampaigns(req, url)
    if (req.method === 'GET' && url.pathname.endsWith('/ad-groups')) return await handleListAdGroups(req, url)
    if (req.method === 'GET' && url.pathname.endsWith('/campaign-insights')) return await handleListCampaignInsights(req, url)
    if (req.method === 'GET' && url.pathname.endsWith('/accounts')) return await handleListGoogleAdsAccounts(req, url)
    if (req.method === 'POST' && url.pathname.endsWith('/select-account')) return await handleSelectAccount(req)
    if (req.method === 'POST' && url.pathname.endsWith('/sync-all')) return await handleSyncAll(req)
    if (req.method === 'POST' && url.pathname.endsWith('/sync')) return await handleSync(req)
    if (req.method === 'POST' && url.pathname.endsWith('/forms-webhook')) return await handleFormsWebhook(req)
    return jsonResponse(
      {
        error:
          'Rota não encontrada. Use /agency-connect, /agency-accounts, /agency-businesses, /select-agency-business, /link-agency-account, /agency-disconnect, /disconnect, /connect, /callback, /campaigns, /ad-groups, /campaign-insights, /accounts, /select-account, /sync, /sync-all ou /forms-webhook.',
      },
      404,
    )
  } catch (err) {
    console.error('[integrations] erro inesperado:', err)
    await logServerError('integrations', 'erro inesperado', err)
    return jsonResponse({ error: 'Erro inesperado. Tente novamente.' }, 500)
  }
})
