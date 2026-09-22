import { fetchFriendly } from '@/lib/fetch-friendly'
import { supabase } from '@/lib/supabase'

// Cliente da Edge Function "integrations" (Fase 6.1/6.2) — chamado
// direto via fetch (não supabase.functions.invoke) porque as rotas
// usam GET com query string, e assim fica igual ao que já foi testado
// manualmente durante o desenvolvimento.
const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/integrations`

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  return {
    Authorization: `Bearer ${data.session?.access_token ?? ''}`,
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  }
}

export interface ConnectIntegrationParams {
  provider: 'google_ads' | 'google_forms' | 'meta_ads'
  digitalAssetId: string
  formId?: string
}

/** Chama /connect e devolve a URL de autorização do Google — quem
 * chama essa função é responsável por mandar o navegador pra lá
 * (`window.location.href = url`). */
export async function connectIntegration(params: ConnectIntegrationParams): Promise<string> {
  const search = new URLSearchParams({ provider: params.provider, digital_asset_id: params.digitalAssetId })
  if (params.formId) search.set('form_id', params.formId)

  const res = await fetchFriendly(`${FUNCTIONS_BASE}/connect?${search.toString()}`, { headers: await authHeaders() })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? 'Não foi possível iniciar a conexão.')
  return body.authorizationUrl as string
}

export interface SyncIntegrationResult {
  syncedDays?: number
  syncedQuestions?: number
  syncedResponses?: number
}

/** Fase 35.2 — desconecta a integração de um Ativo Digital (mantém a
 * linha/histórico, só reseta pro estado "desconectado" e apaga o token
 * OAuth guardado no Vault). Mesmo padrão de `disconnectAgencyProvider`,
 * só que por conexão de Ativo Digital em vez de conta da agência. */
export async function disconnectIntegration(connectionId: string): Promise<void> {
  const res = await fetchFriendly(`${FUNCTIONS_BASE}/disconnect`, {
    method: 'POST',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ connection_id: connectionId }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? 'Não foi possível desconectar.')
}

export async function syncIntegration(connectionId: string): Promise<SyncIntegrationResult> {
  const res = await fetchFriendly(`${FUNCTIONS_BASE}/sync`, {
    method: 'POST',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ connection_id: connectionId }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? 'Não foi possível sincronizar.')
  return body
}

export interface GoogleAdsAccount {
  id: string
  name: string | null
  loginCustomerId: string
}

/** Lista as contas de anúncio reais do Google Ads que uma conexão
 * enxerga (Fase 20) — nunca inclui conta gerenciadora/MCC, só usada
 * quando `handleCallback` não conseguiu escolher sozinho (0 ou mais de
 * 1 conta encontrada). */
export async function listGoogleAdsAccounts(connectionId: string): Promise<GoogleAdsAccount[]> {
  const search = new URLSearchParams({ connection_id: connectionId })
  const res = await fetchFriendly(`${FUNCTIONS_BASE}/accounts?${search.toString()}`, { headers: await authHeaders() })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? 'Não foi possível buscar as contas de anúncios.')
  return body.accounts as GoogleAdsAccount[]
}

/** Grava qual conta de anúncios do Google Ads usar numa conexão, depois
 * de escolhida numa lista (Fase 20). */
export async function selectGoogleAdsAccount(connectionId: string, account: GoogleAdsAccount): Promise<void> {
  const res = await fetchFriendly(`${FUNCTIONS_BASE}/select-account`, {
    method: 'POST',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      connection_id: connectionId,
      customer_id: account.id,
      login_customer_id: account.loginCustomerId,
      account_name: account.name,
    }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? 'Não foi possível salvar a conta escolhida.')
}

// Fase 28 — conta administradora da agência (MCC no Google Ads,
// Business Manager no Meta), autenticada 1x em vez de por cliente.

export type AgencyProvider = 'google_ads' | 'meta_ads'

/** Chama /agency-connect e devolve a URL de autorização — mesmo padrão
 * de connectIntegration, só que sem digital_asset_id nenhum (é a conta
 * da agência, não de um cliente específico). */
export async function connectAgencyProvider(provider: AgencyProvider): Promise<string> {
  const search = new URLSearchParams({ provider })
  const res = await fetchFriendly(`${FUNCTIONS_BASE}/agency-connect?${search.toString()}`, { headers: await authHeaders() })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? 'Não foi possível iniciar a conexão.')
  return body.authorizationUrl as string
}

export async function disconnectAgencyProvider(provider: AgencyProvider): Promise<void> {
  const res = await fetchFriendly(`${FUNCTIONS_BASE}/agency-disconnect`, {
    method: 'POST',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? 'Não foi possível desconectar.')
}

export interface AgencyAdAccount {
  id: string
  name: string | null
  loginCustomerId?: string
  /** Só existe pra Google Ads — conta de teste (criada pra testar a
   * integração, sem gasto real) sempre aparece com status "cancelada"
   * do lado do Google, mas continua utilizável pela API normalmente. */
  testAccount?: boolean
}

/** Conta raiz (normalmente um MCC) que o login OAuth da agência enxerga
 * no Google Ads — só existe na resposta pra `provider: 'google_ads'`.
 * `error` vem preenchido quando a consulta daquela raiz falhou (ex:
 * developer token sem acesso), em vez de simplesmente sumir da lista. */
export interface AgencyGoogleAdsRoot {
  id: string
  name: string | null
  manager: boolean
  testAccount: boolean
  error?: string
}

export interface AgencyAccountsResult {
  accounts: AgencyAdAccount[]
  roots?: AgencyGoogleAdsRoot[]
  warning?: string
}

/** Lista as contas de cliente visíveis pela conta administradora já
 * conectada (MCC/Business Manager) — popula o seletor no diálogo
 * "Conectar integração" de um Ativo Digital. Pra Google Ads também traz
 * `roots` (as contas MCC que o login enxerga) e `warning` (motivo real
 * de uma lista vazia, quando não é só "ninguém vinculou nada ainda"). */
export async function listAgencyAccounts(provider: AgencyProvider): Promise<AgencyAccountsResult> {
  const search = new URLSearchParams({ provider })
  const res = await fetchFriendly(`${FUNCTIONS_BASE}/agency-accounts?${search.toString()}`, { headers: await authHeaders() })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? 'Não foi possível buscar as contas.')
  return body as AgencyAccountsResult
}

/** Vincula uma conta escolhida da lista de listAgencyAccounts a um
 * Ativo Digital — sem OAuth nenhum nessa etapa (a autenticação já foi
 * feita uma vez em Configurações > Agência). */
export async function linkAgencyAccount(
  digitalAssetId: string,
  provider: AgencyProvider,
  account: AgencyAdAccount,
): Promise<void> {
  const res = await fetchFriendly(`${FUNCTIONS_BASE}/link-agency-account`, {
    method: 'POST',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      digital_asset_id: digitalAssetId,
      provider,
      external_account_id: account.id,
      login_customer_id: account.loginCustomerId,
      external_account_name: account.name,
    }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? 'Não foi possível vincular a conta.')
}

export interface AgencyBusiness {
  id: string
  name: string | null
}

/** Só existe pro Meta — lista os Business Managers visíveis pela conta
 * conectada, quando a escolha automática (handleAgencyCallback) não
 * conseguiu decidir sozinha (0 ou 2+ encontrados). */
export async function listAgencyBusinesses(): Promise<AgencyBusiness[]> {
  const res = await fetchFriendly(`${FUNCTIONS_BASE}/agency-businesses?provider=meta_ads`, { headers: await authHeaders() })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? 'Não foi possível buscar os Business Managers.')
  return body.businesses as AgencyBusiness[]
}

export async function selectAgencyBusiness(businessId: string): Promise<void> {
  const res = await fetchFriendly(`${FUNCTIONS_BASE}/select-agency-business`, {
    method: 'POST',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ business_id: businessId }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? 'Não foi possível salvar o Business Manager escolhido.')
}

export interface ExternalCampaign {
  id: string
  name: string
  status: string
}

/** Lista as campanhas reais de uma conta já conectada (Fase 8.1b —
 * vincular um projeto a uma campanha específica do Meta/Google Ads). */
export async function listCampaigns(connectionId: string): Promise<ExternalCampaign[]> {
  const search = new URLSearchParams({ connection_id: connectionId })
  const res = await fetchFriendly(`${FUNCTIONS_BASE}/campaigns?${search.toString()}`, { headers: await authHeaders() })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? 'Não foi possível buscar as campanhas.')
  return body.campaigns as ExternalCampaign[]
}

export interface ExternalAdGroup {
  id: string
  name: string
  status: string
  spend: number
  clicks: number
  impressions: number
  conversions: number
  /** Média das keywords desse ad group — null se não tiver keyword com
   * dado (comum fora de campanhas de Pesquisa). */
  avgQualityScore: number | null
}

/** Lista os grupos de anúncio de uma campanha do Google Ads já
 * vinculada a um projeto (aba "Grupos de Anúncios") — busca ao vivo,
 * últimos 30 dias, só Google Ads por enquanto. */
export async function listAdGroups(connectionId: string, campaignId: string): Promise<ExternalAdGroup[]> {
  const search = new URLSearchParams({ connection_id: connectionId, campaign_id: campaignId })
  const res = await fetchFriendly(`${FUNCTIONS_BASE}/ad-groups?${search.toString()}`, { headers: await authHeaders() })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? 'Não foi possível buscar os grupos de anúncio.')
  return body.adGroups as ExternalAdGroup[]
}

export interface CampaignInsightBreakdown {
  clicks: number
  impressions: number
  conversions: number
}

export interface DeviceInsight extends CampaignInsightBreakdown {
  device: string
  spend: number
}

export interface SearchTermInsight extends CampaignInsightBreakdown {
  term: string
}

export interface KeywordInsight extends CampaignInsightBreakdown {
  keyword: string
}

export interface GeoInsight extends CampaignInsightBreakdown {
  name: string
}

export interface ConversionActionInsight {
  actionName: string
  conversions: number
  conversionValue: number
}

export interface AgeRangeInsight extends CampaignInsightBreakdown {
  range: string
}

export interface GenderInsight extends CampaignInsightBreakdown {
  gender: string
}

export interface BestTiming {
  dayOfWeek: string
  hourBucket: string
}

export interface CampaignInsights {
  devices: DeviceInsight[]
  topSearchTerms: SearchTermInsight[]
  topKeywords: KeywordInsight[]
  geoBreakdown: GeoInsight[]
  conversionBreakdown: ConversionActionInsight[]
  ageRanges: AgeRangeInsight[]
  genders: GenderInsight[]
  bestTiming: BestTiming | null
}

/** Resumos curados (dispositivo, top termos de pesquisa, top
 * palavras-chave, geográfico por cidade/região) de uma campanha do
 * Google Ads já vinculada a um projeto — busca ao vivo, últimos 30
 * dias, só Google Ads por enquanto. */
export async function listCampaignInsights(connectionId: string, campaignId: string): Promise<CampaignInsights> {
  const search = new URLSearchParams({ connection_id: connectionId, campaign_id: campaignId })
  const res = await fetchFriendly(`${FUNCTIONS_BASE}/campaign-insights?${search.toString()}`, { headers: await authHeaders() })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? 'Não foi possível buscar os resumos da campanha.')
  return body as CampaignInsights
}
