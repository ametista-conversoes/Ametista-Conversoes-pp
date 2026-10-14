// Ametista Conversões — Fase 50.B: motor de "Dados de demonstração".
//
// 2 rotas, as duas POST, as duas exigem login de admin/gestor (mesmo
// padrão de requireAdminOrGestor já usado em integrations/index.ts,
// duplicado aqui de propósito — cada Edge Function deste projeto é
// autocontida, sem import cruzado entre funções):
//   POST .../demo-data/recreate — apaga e gera de novo os 2 clientes de
//                                 demonstração, com datas relativas a hoje.
//                                 Também garante (Fase 50.E) o login do
//                                 Portal do Cliente de cada um — idempotente,
//                                 não duplica a conta em recriações seguidas.
//   POST .../demo-data/remove   — só apaga (não gera de novo); não toca
//                                 nos logins (ver comentário em remove_demo_data)
//
// Chamadas só pelo botão em Configurações > Globais (admin), nunca por
// cron nem webhook externo.

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

const ALLOWED_ORIGINS = new Set(['https://ametistaconversoes.app', 'http://localhost:5173'])
const DEFAULT_ORIGIN = 'https://ametistaconversoes.app'

function resolveAllowedOrigin(req: Request): string {
  const origin = req.headers.get('origin')
  return origin && ALLOWED_ORIGINS.has(origin) ? origin : DEFAULT_ORIGIN
}

const corsHeaders = {
  'Access-Control-Allow-Origin': DEFAULT_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function getServiceClient() {
  return createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
}

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

async function dbErrorResponse(context: string, error: { message: string }) {
  console.error(`[demo-data] ${context}:`, error)
  await logServerError('demo-data', context, error)
  return jsonResponse({ error: 'Erro ao acessar o banco de dados. Tente novamente.' }, 500)
}

// Mesmo padrão de requireAdminOrGestor em integrations/index.ts.
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

const CLINICA_SORRISO_NAME = 'Clínica Sorriso (demo)'
const CLINICA_SORRISO_EMAIL = 'contato@clinicasorriso.com.br'

/** Cria (ou atualiza, se já existir) o cliente-molde da Clínica Sorriso
 * — procurado por nome porque é sempre o mesmo cliente sintético, nunca
 * recriado do zero com um id novo (um "Recriar" repetido não deve
 * duplicar nem quebrar link/favorito salvo pra ele). */
async function ensureClinicaSorrisoShell(supabase: SupabaseClient): Promise<string> {
  const { data: existing, error: findError } = await supabase
    .from('clients')
    .select('id')
    .eq('name', CLINICA_SORRISO_NAME)
    .maybeSingle()
  if (findError) throw findError

  if (existing) {
    const { error: updateError } = await supabase
      .from('clients')
      .update({ is_demo: true, status: 'active', plan: 'validacao', chosen_platform: 'meta', email: CLINICA_SORRISO_EMAIL })
      .eq('id', existing.id)
    if (updateError) throw updateError
    return existing.id as string
  }

  const { data: created, error: insertError } = await supabase
    .from('clients')
    .insert({
      name: CLINICA_SORRISO_NAME,
      company: 'Clínica Sorriso Odontologia',
      email: CLINICA_SORRISO_EMAIL,
      is_demo: true,
      status: 'active',
      plan: 'validacao',
      chosen_platform: 'meta',
    })
    .select('id')
    .single()
  if (insertError) throw insertError
  return created.id as string
}

/** Fase 50.D — a Loja Aurora é um cliente REAL (já existia antes desta
 * fase, usado em dezenas de fases como conta de testes — nunca foi
 * cliente pagante de verdade, confirmado com o usuário). Em vez de criar
 * um cliente novo, reaproveita essa identidade: só liga `is_demo`, sem
 * mexer em mais nada aqui (o resto do reset é feito por
 * `remove_demo_data()`, chamado logo depois, já com a flag ligada).
 * Devolve `null` se o cliente "Loja Aurora" não existir (ambiente sem
 * esse cliente de teste) — nesse caso `seedLojaAurora` simplesmente não
 * roda, sem erro. */
async function ensureLojaAuroraDemoFlag(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase.from('clients').select('id').eq('name', 'Loja Aurora').maybeSingle()
  if (error) throw error
  if (!data) return null
  const { error: updateError } = await supabase.from('clients').update({ is_demo: true }).eq('id', data.id)
  if (updateError) throw updateError
  return data.id as string
}

// Fase 50.E — senha fixa pros 2 logins de demonstração. NUNCA um literal
// aqui no código (que é versionado e vai pro GitHub) — vem de um secret
// de Edge Function (Supabase > Edge Functions > Secrets), o mesmo
// mecanismo já usado por SUPABASE_SERVICE_ROLE_KEY/FRONTEND_URL acima.
// O valor em si só existe no secret e no arquivo local
// docs/interno/credenciais-demo.local.md (fora do git). Resetada em TODO
// "Recriar", pra garantir que a credencial documentada sempre funcione
// mesmo que alguém tenha mudado a senha testando.
function getDemoLoginPassword(): string {
  const password = Deno.env.get('DEMO_LOGIN_PASSWORD')
  if (!password) throw new Error('Secret DEMO_LOGIN_PASSWORD não configurado nesta Edge Function')
  return password
}

/** Garante o login do Portal do Cliente de um cliente demo: se já existe
 * uma conta com esse e-mail, só vincula (client_id + role + full_name) e
 * reseta a senha pra garantir que o valor documentado sempre funcione;
 * se não existe, cria direto via `admin.createUser` (sem convite por
 * e-mail — diferente de `client-access/handleLink`, não faz sentido
 * mandar e-mail de convite pra uma conta de demonstração). O gatilho
 * `handle_new_user` já cria a linha em profiles com role padrão
 * 'cliente' e o full_name do metadata — só falta o client_id. */
async function ensureDemoClientUser(
  supabase: SupabaseClient,
  clientId: string,
  email: string,
  fullName: string,
): Promise<void> {
  const password = getDemoLoginPassword()

  const { data: existingProfile, error: findError } = await supabase
    .from('profiles')
    .select('id')
    .ilike('email', email)
    .maybeSingle()
  if (findError) throw findError

  if (existingProfile) {
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ client_id: clientId, role: 'cliente', full_name: fullName })
      .eq('id', existingProfile.id)
    if (updateError) throw updateError
    const { error: pwError } = await supabase.auth.admin.updateUserById(existingProfile.id, {
      password,
      email_confirm: true,
    })
    if (pwError) throw pwError
    return
  }

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (createError || !created?.user) throw createError ?? new Error('createUser sem usuário')

  const { error: linkError } = await supabase.from('profiles').update({ client_id: clientId }).eq('id', created.user.id)
  if (linkError) throw linkError
}

/** Meses civis + semana corrente compartilhados pelos 2 geradores —
 * extraído só agora (Fase 50.D) pra não arriscar mexer no código já
 * testado de `seedClinicaSorriso`. */
function resolveDemoMonths(todayISO: string) {
  const today = new Date(`${todayISO}T00:00:00Z`)
  const todayDay = today.getUTCDate()
  const m3 = { year: today.getUTCFullYear(), month0: today.getUTCMonth() }
  const m2d = new Date(Date.UTC(m3.year, m3.month0 - 1, 1))
  const m1d = new Date(Date.UTC(m3.year, m3.month0 - 2, 1))
  const m1 = { year: m1d.getUTCFullYear(), month0: m1d.getUTCMonth() }
  const m2 = { year: m2d.getUTCFullYear(), month0: m2d.getUTCMonth() }
  const m3Days = daysInMonth(m3.year, m3.month0)
  const elapsed = todayDay / m3Days
  function monthRange(year: number, month0: number) {
    return { start: isoDate(new Date(Date.UTC(year, month0, 1))), end: isoDate(new Date(Date.UTC(year, month0 + 1, 0))) }
  }
  return { today, m1, m2, m3, todayDay, m3Days, elapsed, r1: monthRange(m1.year, m1.month0), r2: monthRange(m2.year, m2.month0), r3: monthRange(m3.year, m3.month0) }
}

function brl(n: number): string {
  return `R$ ${Math.round(n).toLocaleString('pt-BR')}`
}

// ===================== Fase 50.C — Clínica Sorriso =====================
// Gera ~3 meses civis de operação sintética (o mês corrente, parcial, +
// os 2 anteriores, fechados) + alguns dias do mês seguinte (bem leves),
// pra tudo bater com a lógica real do app, que trabalha em mês civil
// (generate_monthly_client_reports, "Histórico Mensal", cadência da
// Análise do Gestor), não em "90 dias corridos a partir de hoje".

function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate()
}
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}
function round2(n: number): number {
  return Math.round(n * 100) / 100
}
function randBetween(min: number, max: number): number {
  return min + Math.random() * (max - min)
}
function randInt(min: number, max: number): number {
  return Math.floor(randBetween(min, max + 1))
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

interface DaySeed {
  date: string
  spend: number
  clicks: number
  impressions: number
  conversions: number
}

/** 1 mês de dado diário com variação natural em volta de uma meta de
 * investimento + CPL (custo por lead) — nunca linha reta. `skipFirstDays`
 * pula os primeiros N dias sem nenhum anúncio no ar (usado só no mês 1,
 * "os anúncios começam na semana 3"). `maxDay` corta o mês num dia
 * específico (usado no mês corrente, que é sempre parcial). */
function buildDailySeries(year: number, month0: number, monthlySpend: number, cpl: number, skipFirstDays: number, maxDay?: number): DaySeed[] {
  const totalDays = maxDay ?? daysInMonth(year, month0)
  const adDays = Math.max(1, totalDays - skipFirstDays)
  const avgSpend = monthlySpend / adDays
  const out: DaySeed[] = []
  for (let day = 1; day <= totalDays; day++) {
    const date = isoDate(new Date(Date.UTC(year, month0, day)))
    if (day <= skipFirstDays) {
      out.push({ date, spend: 0, clicks: 0, impressions: 0, conversions: 0 })
      continue
    }
    const spend = round2(Math.max(0, avgSpend * randBetween(0.55, 1.55)))
    const cpc = randBetween(1.4, 2.4)
    const clicks = Math.max(1, Math.round(spend / cpc))
    const ctr = randBetween(1.6, 3.4) / 100
    const impressions = Math.max(clicks, Math.round(clicks / ctr))
    const effectiveCpl = cpl * randBetween(0.75, 1.3)
    const conversions = Math.max(0, Math.round(spend / effectiveCpl))
    out.push({ date, spend, clicks, impressions, conversions })
  }
  return out
}

async function insertInChunks(supabase: SupabaseClient, table: string, rows: Record<string, unknown>[], chunkSize = 300) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    if (chunk.length === 0) continue
    const { error } = await supabase.from(table).insert(chunk)
    if (error) throw new Error(`insert ${table}: ${error.message}`)
  }
}

/** Fase 50.C: popula os ~3 meses civis de operação sintética da Clínica
 * Sorriso (Validação, Meta Ads, leads) — snapshots diários, campanhas +
 * 1 teste A/B vivo (vídeo x carrossel), ~250 leads de formulário,
 * catálogo, metas SMART, workflows, Análises do Gestor, reuniões,
 * comentários, arquivos/aprovações, alertas/incidente/Pausa de
 * Emergência e Health Score — tudo com datas relativas a hoje. */
async function seedClinicaSorriso(supabase: SupabaseClient, clientId: string, todayISO: string): Promise<void> {
  const today = new Date(`${todayISO}T00:00:00Z`)
  const todayDay = today.getUTCDate()
  const m3 = { year: today.getUTCFullYear(), month0: today.getUTCMonth() }
  const m2d = new Date(Date.UTC(m3.year, m3.month0 - 1, 1))
  const m1d = new Date(Date.UTC(m3.year, m3.month0 - 2, 1))
  const m1 = { year: m1d.getUTCFullYear(), month0: m1d.getUTCMonth() }
  const m2 = { year: m2d.getUTCFullYear(), month0: m2d.getUTCMonth() }
  const m3Days = daysInMonth(m3.year, m3.month0)
  const elapsed = todayDay / m3Days

  function monthRange(year: number, month0: number) {
    return { start: isoDate(new Date(Date.UTC(year, month0, 1))), end: isoDate(new Date(Date.UTC(year, month0 + 1, 0))) }
  }
  const r1 = monthRange(m1.year, m1.month0)
  const r2 = monthRange(m2.year, m2.month0)
  const r3 = monthRange(m3.year, m3.month0)

  // Receita estimada = (conversões ÷ leads_to_close) × average_ticket —
  // calibrado pra leads_to_close ≈ total de leads ÷ total de vendas do
  // período (≈251÷29), pra "Receita estimada" bater com as vendas reais
  // da tabela do prompt, não com todo mundo que converteu.
  const { error: clientUpdateErr } = await supabase
    .from('clients')
    .update({ leads_to_close: 9, average_ticket: 2000 })
    .eq('id', clientId)
  if (clientUpdateErr) throw clientUpdateErr

  // ---- Ativos digitais + conexões sintéticas (sem OAuth real) ----
  const { data: metaAsset, error: metaAssetErr } = await supabase
    .from('digital_assets')
    .insert({ name: 'Meta Ads — Clínica Sorriso', client_id: clientId, type: 'ad_account', platform: 'meta_ads', status: 'active' })
    .select('id')
    .single()
  if (metaAssetErr) throw metaAssetErr
  const { data: metaConn, error: metaConnErr } = await supabase
    .from('digital_asset_connections')
    .insert({
      digital_asset_id: metaAsset.id,
      provider: 'meta_ads',
      status: 'connected',
      external_account_id: 'act_demo_sorriso',
      external_account_name: 'Clínica Sorriso Odontologia',
      last_synced_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (metaConnErr) throw metaConnErr

  const { data: formAsset, error: formAssetErr } = await supabase
    .from('digital_assets')
    .insert({ name: 'Formulário de Avaliação — Site', client_id: clientId, type: 'google_forms', status: 'active', form_purpose: null })
    .select('id')
    .single()
  if (formAssetErr) throw formAssetErr
  const { data: formConn, error: formConnErr } = await supabase
    .from('digital_asset_connections')
    .insert({
      digital_asset_id: formAsset.id,
      provider: 'google_forms',
      status: 'connected',
      external_account_id: 'demo-form-sorriso',
      external_account_name: 'Formulário de Avaliação — Site',
      last_synced_at: new Date().toISOString(),
      form_purpose: null,
    })
    .select('id')
    .single()
  if (formConnErr) throw formConnErr

  // ---- Projeto ----
  const { data: project, error: projectErr } = await supabase
    .from('projects')
    .insert({
      title: 'Avaliação Odontológica — Meta Ads',
      client_id: clientId,
      status: 'active',
      platform: 'meta_ads',
      conversion_type: 'leads',
      test_type: 'anuncio',
      test_min_spend: 150,
      objective: 'Gerar leads qualificados pra avaliação odontológica gratuita, com foco em implante e ortodontia.',
      systems: 'Meta Ads + Formulário de qualificação + WhatsApp Business (Kit de Atendimento)',
      segmentations: ['Mulheres e homens 28-55 anos', 'Interesse em saúde bucal/estética', 'Raio de 15km da clínica'],
      start_date: r1.start,
    })
    .select('id')
    .single()
  if (projectErr) throw projectErr

  // ---- Campanhas + vínculo com o projeto (cada linha = 1 variante) ----
  const campaignDefs = [
    { id: 'demo-sorriso-interesse', name: 'Interesse — Avaliação Odontológica' },
    { id: 'demo-sorriso-remarketing', name: 'Remarketing — Visitantes do Site' },
    { id: 'demo-sorriso-teste-video', name: 'Teste A/B — Vídeo' },
    { id: 'demo-sorriso-teste-carrossel', name: 'Teste A/B — Carrossel' },
  ]
  const linkIds: Record<string, string> = {}
  for (const c of campaignDefs) {
    const { data: link, error: linkErr } = await supabase
      .from('project_campaign_links')
      .insert({ project_id: project.id, connection_id: metaConn.id, external_campaign_id: c.id, external_campaign_name: c.name, last_known_status: 'ENABLED' })
      .select('id')
      .single()
    if (linkErr) throw linkErr
    linkIds[c.id] = link.id as string
  }

  // ---- "Grupos de Anúncios" (Fase 50.C.1) — essa tela normalmente faz
  // uma chamada AO VIVO pra API real do Meta/Google, nunca gravada no
  // banco; pra um cliente demo (sem conexão real) isso é impossível, então
  // guardamos aqui um "registro" sintético que o Edge Function passa a
  // servir no lugar da chamada real quando a conexão é de um cliente
  // `is_demo` (ver getDemoCampaignDetails em integrations/index.ts). ----
  function adSet(id: string, name: string, status: string, spend: number, clicks: number, impressions: number, conversions: number) {
    return { id, name, status, spend: round2(spend), clicks, impressions, conversions, avgQualityScore: null }
  }
  await insertInChunks(supabase, 'demo_campaign_details', [
    {
      connection_id: metaConn.id,
      external_campaign_id: 'demo-sorriso-interesse',
      ad_groups: [
        adSet('demo-adset-interesse-1', 'Interesse — Saúde bucal/estética', 'ACTIVE', 2300, 980, 24500, 62),
        adSet('demo-adset-interesse-2', 'Público aberto 28-55 anos', 'ACTIVE', 1450, 610, 15200, 38),
      ],
    },
    {
      connection_id: metaConn.id,
      external_campaign_id: 'demo-sorriso-remarketing',
      ad_groups: [adSet('demo-adset-remkt-1', 'Visitantes do site — 30 dias', 'ACTIVE', 1650, 520, 9800, 41)],
    },
    {
      connection_id: metaConn.id,
      external_campaign_id: 'demo-sorriso-teste-video',
      ad_groups: [adSet('demo-adset-video-1', 'Vídeo — depoimento + antes/depois', 'ACTIVE', 1200, 430, 11200, 50)],
    },
    {
      connection_id: metaConn.id,
      external_campaign_id: 'demo-sorriso-teste-carrossel',
      ad_groups: [adSet('demo-adset-carrossel-1', 'Carrossel — depoimentos', 'ACTIVE', 900, 310, 8700, 28)],
    },
  ])

  // ---- Série diária: nível cliente (Dashboard/Relatórios/Central) ----
  const clientM1 = buildDailySeries(m1.year, m1.month0, 1500, 40.5, 14)
  const clientM2 = buildDailySeries(m2.year, m2.month0, 3000, 31.9, 0)
  const clientM3 = buildDailySeries(m3.year, m3.month0, Math.round(3000 * elapsed), 25, 0, todayDay)
  const clientDays = [...clientM1, ...clientM2, ...clientM3]

  await insertInChunks(
    supabase,
    'performance_snapshots',
    clientDays
      .filter((d) => d.spend > 0)
      .map((d) => ({
        client_id: clientId,
        project_id: project.id,
        snapshot_date: d.date,
        channel: 'meta_ads',
        spend: d.spend,
        clicks: d.clicks,
        impressions: d.impressions,
        conversions: d.conversions,
      })),
  )

  // ---- Série diária por campanha (teste só a partir do mês 2 — o
  // teste do mês 1, público x público, fica só em texto na Análise) ----
  const interesseDays = [
    ...buildDailySeries(m1.year, m1.month0, 1050, 42, 14),
    ...buildDailySeries(m2.year, m2.month0, 1350, 34, 0),
    ...buildDailySeries(m3.year, m3.month0, Math.round(1350 * elapsed), 27, 0, todayDay),
  ]
  const remarketingDays = [
    ...buildDailySeries(m1.year, m1.month0, 450, 36, 14),
    ...buildDailySeries(m2.year, m2.month0, 600, 28, 0),
    ...buildDailySeries(m3.year, m3.month0, Math.round(600 * elapsed), 22, 0, todayDay),
  ]
  const videoDays = [...buildDailySeries(m2.year, m2.month0, 600, 24, 0), ...buildDailySeries(m3.year, m3.month0, Math.round(600 * elapsed), 19, 0, todayDay)]
  const carrosselDays = [...buildDailySeries(m2.year, m2.month0, 450, 34, 0), ...buildDailySeries(m3.year, m3.month0, Math.round(450 * elapsed), 29, 0, todayDay)]

  function toCampaignRows(campaignId: string, campaignName: string, days: DaySeed[]) {
    return days
      .filter((d) => d.spend > 0)
      .map((d) => ({
        connection_id: metaConn.id,
        external_campaign_id: campaignId,
        external_campaign_name: campaignName,
        client_id: clientId,
        channel: 'meta_ads',
        snapshot_date: d.date,
        spend: d.spend,
        clicks: d.clicks,
        impressions: d.impressions,
        conversions: d.conversions,
        campaign_type: 'LEAD_GENERATION',
        campaign_status: 'ENABLED',
      }))
  }
  await insertInChunks(supabase, 'campaign_performance_snapshots', [
    ...toCampaignRows('demo-sorriso-interesse', 'Interesse — Avaliação Odontológica', interesseDays),
    ...toCampaignRows('demo-sorriso-remarketing', 'Remarketing — Visitantes do Site', remarketingDays),
    ...toCampaignRows('demo-sorriso-teste-video', 'Teste A/B — Vídeo', videoDays),
    ...toCampaignRows('demo-sorriso-teste-carrossel', 'Teste A/B — Carrossel', carrosselDays),
  ])

  // ---- Formulário: perguntas + ~250 respostas + respostas por campo ----
  const questions = [
    { id: 'q_nome', title: 'Nome completo', type: 'text_short', options: null as string[] | null },
    { id: 'q_email', title: 'E-mail', type: 'text_short', options: null },
    { id: 'q_procedimento', title: 'Qual procedimento te interessa?', type: 'choice_radio', options: ['Implante', 'Ortodontia (aparelho)', 'Clareamento dental', 'Avaliação geral'] },
    { id: 'q_horario', title: 'Melhor horário para contato?', type: 'choice_radio', options: ['Manhã', 'Tarde', 'Noite'] },
    { id: 'q_origem', title: 'Como você conheceu a clínica?', type: 'choice_radio', options: ['Instagram', 'Google', 'Indicação de amigo/familiar'] },
  ]
  await insertInChunks(
    supabase,
    'form_questions',
    questions.map((q, i) => ({ connection_id: formConn.id, external_question_id: q.id, title: q.title, question_type: q.type, options: q.options, position: i })),
  )

  // Leads por mês proporcionais à tabela do prompt (37/94/120, o mês 3
  // escalado pelos dias já passados) — nunca uma amostra uniforme dos
  // ~3 meses inteiros, senão o mês 1 (só 16 dias ativos) fica
  // sub-representado e generate_monthly_client_reports() não bate com a
  // tabela esperada por mês.
  const leadsM1 = 37
  const leadsM2 = 94
  const leadsM3 = Math.max(1, Math.round(120 * elapsed))
  const TOTAL_LEADS = leadsM1 + leadsM2 + leadsM3
  const VENDA = Math.max(1, Math.round(TOTAL_LEADS * 0.12))
  const NOVO = Math.min(3, TOTAL_LEADS)
  const QUALIFICADO = Math.max(1, Math.round(TOTAL_LEADS * 0.23))
  const PERDIDO = Math.max(0, TOTAL_LEADS - VENDA - QUALIFICADO - NOVO)
  const statusPool: string[] = [...Array(VENDA).fill('venda'), ...Array(QUALIFICADO).fill('qualificado'), ...Array(PERDIDO).fill('perdido'), ...Array(NOVO).fill('novo')]
  for (let i = statusPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[statusPool[i], statusPool[j]] = [statusPool[j], statusPool[i]]
  }

  // Datas em ordem de mês (não embaralhadas) — só o status (acima) é
  // sorteado, a data de cada lead continua presa ao mês certo.
  const leadDatesByMonth = [
    ...Array.from({ length: leadsM1 }, () => pick(clientM1.filter((d) => d.spend > 0)).date),
    ...Array.from({ length: leadsM2 }, () => pick(clientM2.filter((d) => d.spend > 0)).date),
    ...Array.from({ length: leadsM3 }, () => pick(clientM3.filter((d) => d.spend > 0)).date),
  ]

  const procedimentos = ['Implante', 'Ortodontia (aparelho)', 'Clareamento dental', 'Avaliação geral']
  const horarios = ['Manhã', 'Tarde', 'Noite']
  const origens = ['Instagram', 'Google', 'Indicação de amigo/familiar']

  const responseRows: Record<string, unknown>[] = []
  const answersByExtId: Record<string, Record<string, unknown>[]> = {}
  for (let i = 0; i < TOTAL_LEADS; i++) {
    const num = i + 1
    const extId = `demo-lead-${String(num).padStart(3, '0')}`
    const status = statusPool[i]
    let submittedAt: string
    if (status === 'novo') {
      submittedAt = new Date(Date.now() - randInt(5, 240) * 60_000).toISOString()
    } else {
      submittedAt = `${leadDatesByMonth[i]}T${String(randInt(8, 20)).padStart(2, '0')}:${String(randInt(0, 59)).padStart(2, '0')}:00Z`
    }
    responseRows.push({ connection_id: formConn.id, external_response_id: extId, client_id: clientId, submitted_at: submittedAt, status })

    const nome = `Lead Demo ${String(num).padStart(3, '0')}`
    const email = `demo${String(num).padStart(3, '0')}@exemplo.invalid`
    const procedimento = pick(procedimentos)
    const horario = pick(horarios)
    const origem = pick(origens)
    answersByExtId[extId] = [
      { external_question_id: 'q_nome', answer_text: nome, answer_values: [nome] },
      { external_question_id: 'q_email', answer_text: email, answer_values: [email] },
      { external_question_id: 'q_procedimento', answer_text: procedimento, answer_values: [procedimento] },
      { external_question_id: 'q_horario', answer_text: horario, answer_values: [horario] },
      { external_question_id: 'q_origem', answer_text: origem, answer_values: [origem] },
    ]
  }
  await insertInChunks(supabase, 'form_responses', responseRows)

  const { data: insertedResponses, error: respFetchErr } = await supabase
    .from('form_responses')
    .select('id, external_response_id')
    .eq('connection_id', formConn.id)
  if (respFetchErr) throw respFetchErr
  const allAnswerRows: Record<string, unknown>[] = []
  for (const r of insertedResponses ?? []) {
    const answers = answersByExtId[r.external_response_id as string] ?? []
    for (const a of answers) allAnswerRows.push({ response_id: r.id, ...a })
  }
  await insertInChunks(supabase, 'form_answers', allAnswerRows, 500)

  // ---- Fecha os 2 meses passados no Histórico Mensal (mesma função
  // real do cron — o mês corrente fica "parcial" automaticamente) — só
  // depois dos leads existirem, já que a função conta form_responses. ----
  await supabase.rpc('generate_monthly_client_reports', { p_ref_month: r1.start })
  await supabase.rpc('generate_monthly_client_reports', { p_ref_month: r2.start })

  // ---- Catálogo (criativos + segmentações, 2 ligados ao teste A/B) ----
  await insertInChunks(supabase, 'catalog_entries', [
    {
      client_id: clientId,
      catalog_type: 'criativo',
      tipo: 'video',
      conteudo: 'Vídeo — "Sorriso novo em até 6 meses" (depoimento + antes/depois)',
      origem: 'manual',
      status: 'aprovado_implementado',
      prioridade: 'alta',
      rating: 5,
      campaign_link_id: linkIds['demo-sorriso-teste-video'],
    },
    {
      client_id: clientId,
      catalog_type: 'criativo',
      tipo: 'video',
      conteudo: 'Carrossel — 4 depoimentos de pacientes',
      origem: 'manual',
      status: 'descartado',
      prioridade: 'media',
      rating: 3,
      campaign_link_id: linkIds['demo-sorriso-teste-carrossel'],
    },
    { client_id: clientId, catalog_type: 'criativo', tipo: 'headline', conteudo: 'Avaliação grátis essa semana', origem: 'ia', status: 'aprovado_implementado', prioridade: 'alta', rating: 4 },
    { client_id: clientId, catalog_type: 'criativo', tipo: 'headline', conteudo: 'Implante com acompanhamento', origem: 'ia', status: 'em_teste', prioridade: 'media', rating: null },
    { client_id: clientId, catalog_type: 'criativo', tipo: 'headline', conteudo: 'Seu sorriso ideal começa aqui', origem: 'manual', status: 'rascunho', prioridade: 'baixa', rating: null },
    {
      client_id: clientId,
      catalog_type: 'criativo',
      tipo: 'descricao',
      conteudo: 'Agende sua avaliação gratuita e tire todas as suas dúvidas com nossos especialistas, sem compromisso.',
      origem: 'ia',
      status: 'aprovado_implementado',
      prioridade: 'media',
      rating: 4,
    },
    { client_id: clientId, catalog_type: 'criativo', tipo: 'frase_destaque', conteudo: 'Vagas limitadas essa semana', origem: 'manual', status: 'em_teste', prioridade: 'media', rating: null },
    { client_id: clientId, catalog_type: 'segmentacao', tipo: null, conteudo: 'Mulheres e homens 28-55 anos, interesse em saúde bucal/estética, raio de 15km', origem: 'manual', status: 'aprovado_implementado', prioridade: 'alta', rating: null },
    { client_id: clientId, catalog_type: 'segmentacao', tipo: null, conteudo: 'Lookalike 1% — base de clientes que já fecharam tratamento', origem: 'manual', status: 'em_teste', prioridade: 'alta', rating: null },
  ])

  // ---- Metas SMART ----
  const lastDay3 = isoDate(new Date(Date.UTC(m3.year, m3.month0 + 1, 0)))
  await insertInChunks(supabase, 'smart_goals', [
    { title: 'Gerar 120 leads no mês', client_id: clientId, metric_type: 'leads', target_value: 120, current_value: Math.round(120 * elapsed), target_date: lastDay3, status: 'on_track' },
    { title: 'Fechar 14 tratamentos no mês', client_id: clientId, metric_type: 'vendas', target_value: 14, current_value: Math.round(14 * elapsed), target_date: lastDay3, status: 'on_track' },
    { title: 'Manter CPA abaixo de R$160', client_id: clientId, metric_type: 'cpa', target_value: 160, current_value: 150, target_date: lastDay3, status: 'on_track' },
    { title: 'Qualificar 70% dos leads em até 48h', client_id: clientId, metric_type: 'leads_qualificados', target_value: 70, current_value: 65, target_date: lastDay3, status: 'at_risk' },
  ])

  // ---- Atividades (reaproveita Workflows de Atividades reais) ----
  const { data: activityTemplates } = await supabase.from('activity_templates').select('id, name, items').or('name.ilike.3.2%,name.ilike.2.4%,name.ilike.5.3%')
  const activityRows: Record<string, unknown>[] = []
  for (const tpl of activityTemplates ?? []) {
    const items = (tpl.items as Array<{ title: string; category?: string; recurrence?: string; platform_scope?: string[] }>) ?? []
    items.slice(0, 2).forEach((item, idx) => {
      const isResting = String(tpl.name).startsWith('5.3') && idx === 0
      activityRows.push({
        client_id: clientId,
        project_id: null,
        title: item.title,
        category: item.category ?? null,
        completed: true,
        completed_at: new Date(Date.now() - (isResting ? randInt(1, 4) : randInt(10, 20)) * 86_400_000).toISOString(),
        recurrence_interval: item.recurrence ?? null,
        platform_scope: item.platform_scope ?? ['meta', 'google'],
        step_order: idx,
        source_activity_template_id: tpl.id,
        source_template_name: tpl.name,
      })
    })
  }
  if (activityRows.length > 0) await insertInChunks(supabase, 'activity_checklist_items', activityRows)

  // ---- Kanban (Workflow Operacional): 1-4 concluídos, 5 em andamento ----
  const kanbanTitles = [
    'Estruturação de pixel e eventos de conversão',
    'Criação de públicos personalizados e semelhantes',
    'Primeiros criativos no ar (Interesse + Remarketing)',
    'Revisão do Kit de Atendimento com o roteiro ajustado',
    'Otimização de públicos e lances — mês 3',
  ]
  await insertInChunks(
    supabase,
    'tasks',
    kanbanTitles.map((title, i) => ({
      title,
      client_id: clientId,
      project_id: project.id,
      category: 'Gestão de tráfego',
      priority: 'medium',
      status: i < 4 ? 'done' : 'in_progress',
      due_date: isoDate(new Date(Date.UTC(m1.year, m1.month0, Math.min(28, 14 + i * 10)))),
    })),
  )

  // ---- Tarefas do Cliente (Workflows do Cliente): setup concluído + 1
  // atrasada + a recorrente real dos 15 minutos, se o modelo existir ----
  const { data: insertedClientTasks, error: ctErr } = await supabase
    .from('client_tasks')
    .insert([
      { title: 'Enviar acessos (Business Manager, site) e materiais da clínica', client_id: clientId, project_id: project.id, category: 'Setup', priority: 'high', due_date: r1.start },
      { title: 'Aprovar modelo visual da landing page', client_id: clientId, project_id: project.id, category: 'Landing Page', priority: 'high', due_date: isoDate(new Date(Date.UTC(m1.year, m1.month0, 10))) },
      { title: 'Validar perfil e mensagens do Kit de Atendimento no WhatsApp Business', client_id: clientId, project_id: project.id, category: 'Kit de Atendimento', priority: 'medium', due_date: isoDate(new Date(Date.UTC(m1.year, m1.month0, 12))) },
      { title: 'Confirmar recebimento do roteiro de atendimento', client_id: clientId, project_id: project.id, category: 'Kit de Atendimento', priority: 'low', due_date: isoDate(new Date(Date.UTC(m1.year, m1.month0, 13))) },
      { title: 'Revisar relatório do mês 1 e validar metas', client_id: clientId, project_id: null, category: 'Acompanhamento', priority: 'medium', due_date: r2.start },
    ])
    .select('id')
  if (ctErr) throw ctErr
  for (const t of insertedClientTasks ?? []) {
    await supabase.from('client_tasks').update({ status: 'done', completed_at: new Date().toISOString() }).eq('id', t.id)
  }
  // 1 tarefa atrasada, de propósito sem marcar como concluída
  await insertInChunks(supabase, 'client_tasks', [
    {
      title: 'Atualizar etiquetas de leads do mês no WhatsApp Business',
      client_id: clientId,
      project_id: null,
      category: 'Acompanhamento',
      priority: 'medium',
      due_date: isoDate(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), Math.max(1, todayDay - 3)))),
    },
  ])
  // a rotina recorrente real (regra dos 15 min), só se o modelo existir
  const { data: template50 } = await supabase.from('client_workflow_templates').select('steps').ilike('name', '5.0%').maybeSingle()
  if (template50) {
    const steps = (template50.steps as Array<{ title: string; category?: string; recurrence?: string }>) ?? []
    const step15min = steps.find((s) => /15 ?min/i.test(s.title)) ?? steps[0]
    if (step15min) {
      await insertInChunks(supabase, 'client_tasks', [
        {
          title: step15min.title,
          client_id: clientId,
          project_id: null,
          category: step15min.category ?? 'Rotina',
          priority: 'medium',
          recurrence_interval: step15min.recurrence ?? '7',
        },
      ])
    }
  }

  // ---- Análise do Gestor: 3 publicadas + 1 rascunho ----
  await supabase.from('manager_analyses').insert([
    {
      client_id: clientId,
      period_start: r1.start,
      period_end: r1.end,
      tipo: 'periodica',
      status: 'publicada',
      published_at: new Date(Date.UTC(m1.year, m1.month0 + 1, 2)).toISOString(),
      resumo: 'Mês de lançamento: campanhas no ar a partir da 3ª semana. Funil validado, primeiros leads e vendas confirmadas.',
      status_geral: 'no_alvo',
      diagnostico: 'Com os anúncios ativos só na 2ª quinzena, o volume foi menor que um mês cheio, mas o CPL (R$40,50) já ficou dentro do esperado pra fase de aprendizado. O teste de público mostrou sinal claro.',
      otimizacoes_realizadas: 'Configuração completa de pixel e eventos, criação de 2 campanhas (Interesse + Remarketing), ativação do Kit de Atendimento e da Landing Page.',
      creatives_used_snapshot: 4,
      changes_used_snapshot: 2,
      proximos_passos: [
        { titulo: 'Migrar verba pro público aberto (venceu o teste)', data: r2.start },
        { titulo: 'Produzir primeiro criativo em vídeo', data: r2.start },
      ],
      pendencias_cliente_texto: null,
      extra_fields: {
        teste_do_mes: 'Público por interesse x Público aberto',
        resultado_teste: 'Público aberto venceu — CPL 18% menor que o público de interesse, sem perda de qualidade percebida nas qualificações.',
        recomendacao: 'Migrar a maior parte da verba pro público aberto a partir do mês 2, mantendo uma fatia pequena do público de interesse como controle.',
      },
    },
    {
      client_id: clientId,
      period_start: r2.start,
      period_end: r2.end,
      tipo: 'periodica',
      status: 'publicada',
      published_at: new Date(Date.UTC(m2.year, m2.month0 + 1, 2)).toISOString(),
      resumo: 'Primeiro mês cheio de veiculação. Volume de leads praticamente triplicou e o CPL caiu pra R$31,90.',
      status_geral: 'no_alvo',
      diagnostico: 'A migração pro público aberto confirmou o resultado do teste do mês 1. Iniciamos também o teste de criativo (vídeo x carrossel), ainda sem vencedor definitivo.',
      otimizacoes_realizadas: 'Migração de verba pro público aberto, criação das campanhas de teste de criativo, revisão do roteiro de atendimento com base na 1ª leva de vendas.',
      creatives_used_snapshot: 5,
      changes_used_snapshot: 3,
      proximos_passos: [
        { titulo: 'Concluir o teste de criativo (vídeo x carrossel)', data: r3.start },
        { titulo: 'Avaliar aumento de verba se o CPL continuar caindo', data: r3.start },
      ],
      pendencias_cliente_texto: null,
      extra_fields: {
        teste_do_mes: 'Vídeo x Carrossel (criativo)',
        resultado_teste: 'Em andamento — o vídeo já aparece com tendência de vencer em taxa de agendamento, mas ainda sem volume suficiente pra encerrar o teste com segurança.',
        recomendacao: 'Manter o teste rodando até o meio do mês 3 antes de decidir.',
      },
    },
    {
      client_id: clientId,
      period_start: r3.start,
      period_end: r3.end,
      tipo: 'periodica',
      status: 'publicada',
      published_at: new Date().toISOString(),
      resumo: 'Melhor mês até aqui: CPL em R$25 e maior volume de vendas da janela. Teste de criativo encerrado.',
      status_geral: 'no_alvo',
      diagnostico: 'O vídeo confirmou a vitória no teste de criativo, com taxa de agendamento maior que o carrossel. A operação já está estável, com o Kit de Atendimento funcionando bem (poucos leads parados em "Novo").',
      otimizacoes_realizadas: 'Vídeo definido como criativo principal, pausa gradual do carrossel, ajuste de 1 público com fadiga.',
      creatives_used_snapshot: 5,
      changes_used_snapshot: 3,
      proximos_passos: [
        { titulo: 'Testar variações de gancho no vídeo vencedor', data: isoDate(new Date(Date.UTC(m3.year, m3.month0 + 1, 5))) },
        { titulo: 'Avaliar expansão de raio geográfico', data: isoDate(new Date(Date.UTC(m3.year, m3.month0 + 1, 10))) },
      ],
      pendencias_cliente_texto: 'Confirmar disponibilidade de horários extras pra absorver o aumento de agendamentos.',
      extra_fields: {
        teste_do_mes: 'Vídeo x Carrossel (conclusão)',
        resultado_teste: 'Vídeo confirmado vencedor — taxa de agendamento 35% maior que o carrossel.',
        recomendacao: 'Manter o vídeo como criativo principal e testar novas variações de gancho no próximo mês.',
      },
    },
  ])

  const m4d = new Date(Date.UTC(m3.year, m3.month0 + 1, 1))
  const r4 = monthRange(m4d.getUTCFullYear(), m4d.getUTCMonth())
  await supabase.from('manager_analyses').insert({
    client_id: clientId,
    period_start: r4.start,
    period_end: r4.end,
    tipo: 'periodica',
    status: 'rascunho',
    resumo: 'Rascunho iniciado — aguardando fechar a 1ª semana do mês pra consolidar os números.',
    extra_fields: {},
  })

  await supabase.from('client_optimization_log').insert([
    { client_id: clientId, description: 'Migração de verba pro público aberto' },
    { client_id: clientId, description: 'Ajuste de lance no público com fadiga' },
    { client_id: clientId, description: 'Pausa gradual do criativo carrossel' },
  ])

  // ---- Reuniões: 3 passadas + 1 futura ----
  await supabase.from('meetings').insert([
    { title: 'Reunião de alinhamento — Kickoff', client_id: clientId, date: new Date(Date.UTC(m1.year, m1.month0, 3, 15, 0)).toISOString(), meeting_link: 'https://meet.google.com/demo-sorriso-kickoff', status: 'completed' },
    { title: 'Reunião mensal — resultados do mês 1', client_id: clientId, date: new Date(Date.UTC(m2.year, m2.month0, 3, 15, 0)).toISOString(), meeting_link: 'https://meet.google.com/demo-sorriso-m1', status: 'completed' },
    { title: 'Reunião mensal — resultados do mês 2', client_id: clientId, date: new Date(Date.UTC(m3.year, m3.month0, 3, 15, 0)).toISOString(), meeting_link: 'https://meet.google.com/demo-sorriso-m2', status: 'completed' },
    {
      title: 'Reunião mensal — resultados do mês 3',
      client_id: clientId,
      date: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 5, 15, 0)).toISOString(),
      meeting_link: 'https://meet.google.com/demo-sorriso-m3',
      status: 'scheduled',
    },
  ])

  // ---- Comentários ----
  await supabase.from('comments').insert([
    { title: null, content: 'Já configuramos o Kit de Atendimento no WhatsApp de vocês — dá uma olhada nas etiquetas e me avisa se quiser ajustar alguma mensagem.', client_id: clientId, entity_type: 'general', entity_id: clientId, author_name: 'Davi (Gestor)', author_role: 'gestor' },
    { title: null, content: 'Ficou ótimo! Só uma dúvida: dá pra adicionar uma resposta rápida pra quem pergunta sobre parcelamento?', client_id: clientId, entity_type: 'general', entity_id: clientId, author_name: 'Clínica Sorriso', author_role: 'cliente' },
    { title: null, content: 'Com certeza, já incluí no roteiro. Também subi o relatório do mês 2 na aba Relatórios.', client_id: clientId, entity_type: 'general', entity_id: clientId, author_name: 'Davi (Gestor)', author_role: 'gestor' },
  ])

  // ---- Arquivos + Aprovações (URLs reais, sem depender do Storage) ----
  await supabase.from('file_items').insert([
    { name: 'Plano de 90 dias (demo).pdf', client_id: clientId, folder: 'Planejamento', file_url: 'https://upload.wikimedia.org/wikipedia/commons/8/8d/Example.pdf', file_type: 'application/pdf' },
    { name: 'Logo_ClinicaSorriso.png', client_id: clientId, folder: 'Criativos', file_url: 'https://picsum.photos/seed/sorriso-logo/800/600', file_type: 'image/png' },
  ])
  // Nota: as 2 linhas precisam ter exatamente as mesmas chaves — o
  // PostgREST monta 1 INSERT só a partir da união das chaves do array
  // inteiro, e preenche com NULL explícito (não o default da coluna)
  // quando uma linha não tem uma chave que outra tem.
  await insertInChunks(supabase, 'approvals', [
    { title: 'Vídeo institucional — versão final', client_id: clientId, file_url: 'https://picsum.photos/seed/sorriso-video/1280/720', file_type: 'video/mp4', status: 'approved', feedback: 'Aprovado, pode subir!', requires_explicit_approval: false },
    { title: 'Carrossel — depoimentos de pacientes', client_id: clientId, file_url: 'https://picsum.photos/seed/sorriso-carrossel/1080/1080', file_type: 'image/jpeg', status: 'pending', feedback: null, requires_explicit_approval: false },
  ])

  // ---- Alertas, incidente e Pausa de Emergência (resolvidos) ----
  await supabase.from('metric_alert_thresholds').insert({ client_id: clientId, metric: 'cpa', comparison: 'above', threshold_value: 180, enabled: true })
  await supabase.from('alerts').insert({ title: 'CPA acima do limite configurado', message: 'CPA nos últimos 7 dias: R$192,40 (limite: acima de R$180,00)', client_id: clientId, severity: 'medium', category: 'limiar_metrica', resolved: true })
  await supabase.from('incidents').insert([
    { title: 'Formulário com erro de validação no campo de telefone', client_id: clientId, severity: 'low', status: 'resolved', category: 'Técnico', description: 'Alguns leads reportaram erro ao preencher telefone com DDD.', resolution: 'Corrigido o campo de máscara do formulário — confirmado com testes manuais.' },
    {
      title: 'Pausa de emergência solicitada pelo cliente: campanha de remarketing duplicada por engano',
      client_id: clientId,
      severity: 'critical',
      status: 'resolved',
      category: 'Pausa de Emergência',
      description: null,
      resolution: 'Pausa executada em menos de 1 hora; duplicidade corrigida e campanha reativada no dia seguinte.',
    },
  ])

  // ---- Health Score (saudável, 70-85) ----
  await supabase.from('clients').update({ health_score: 78, health_performance: 82, health_financial: 80, health_delivery: 75, health_relationship: 76 }).eq('id', clientId)
  await supabase.from('client_health_score_snapshots').insert([
    { client_id: clientId, snapshot_date: r2.start, health_score: 70 },
    { client_id: clientId, snapshot_date: todayISO, health_score: 78 },
  ])
}

// ===================== Fase 50.D — Loja Aurora =====================
// Dominação, Meta + Google Ads, vendas (e-commerce). Mesmos 3 meses
// civis da Clínica Sorriso (compartilham o "hoje" da mesma chamada de
// /recreate). `leads_to_close = 1` é a chave pra Receita bater com
// "receita vindo de valor de conversão": a fórmula do app é sempre
// `(conversões ÷ leads_to_close) × ticket médio` — com leads_to_close=1,
// cada conversão rastreada já é tratada como 1 venda direta, igual um
// e-commerce de verdade funciona (sem fração de fechamento por lead).
async function seedLojaAurora(supabase: SupabaseClient, clientId: string, todayISO: string): Promise<void> {
  const { m1, m2, m3, todayDay, elapsed, r1, r2, r3 } = resolveDemoMonths(todayISO)

  await supabase
    .from('clients')
    .update({
      plan: 'dominacao',
      chosen_platform: null,
      leads_to_close: 1,
      average_ticket: 210,
      health_score: 58,
      health_performance: 55,
      health_financial: 65,
      health_delivery: 60,
      health_relationship: 52,
    })
    .eq('id', clientId)

  // ---- Ativos + conexões (Google Ads + Meta Ads, sintéticas) ----
  const { data: googleAsset, error: gaErr } = await supabase
    .from('digital_assets')
    .insert({ name: 'Google Ads — Loja Aurora', client_id: clientId, type: 'ad_account', platform: 'google_ads', status: 'active' })
    .select('id')
    .single()
  if (gaErr) throw gaErr
  const { data: googleConn, error: gcErr } = await supabase
    .from('digital_asset_connections')
    .insert({ digital_asset_id: googleAsset.id, provider: 'google_ads', status: 'connected', external_account_id: '999-demo-aurora', external_account_name: 'Loja Aurora — Google Ads', last_synced_at: new Date().toISOString() })
    .select('id')
    .single()
  if (gcErr) throw gcErr

  const { data: metaAsset, error: maErr } = await supabase
    .from('digital_assets')
    .insert({ name: 'Meta Ads — Loja Aurora', client_id: clientId, type: 'ad_account', platform: 'meta_ads', status: 'active' })
    .select('id')
    .single()
  if (maErr) throw maErr
  const { data: metaConn, error: mcErr } = await supabase
    .from('digital_asset_connections')
    .insert({ digital_asset_id: metaAsset.id, provider: 'meta_ads', status: 'connected', external_account_id: 'act_demo_aurora', external_account_name: 'Loja Aurora — Meta Ads', last_synced_at: new Date().toISOString() })
    .select('id')
    .single()
  if (mcErr) throw mcErr

  // ---- Projeto ----
  const { data: project, error: projectErr } = await supabase
    .from('projects')
    .insert({
      title: 'E-commerce — Meta + Google Ads',
      client_id: clientId,
      status: 'active',
      platform: 'meta_ads',
      conversion_type: 'vendas',
      test_type: 'nenhum',
      objective: 'Maximizar vendas no e-commerce com ROAS saudável, combinando Google Pesquisa/Performance Max e Meta prospecção/remarketing.',
      systems: 'Google Ads + Meta Ads + Catálogo de produtos + Pixel/Tag de conversão',
      segmentations: ['Mulheres 25-45 anos', 'Interesse em moda e acessórios', 'Lookalike 1% de compradores'],
      start_date: isoDate(new Date(Date.UTC(m1.year, m1.month0, 1))),
    })
    .select('id')
    .single()
  if (projectErr) throw projectErr

  // ---- Campanhas (2 Google + 2 Meta, um projeto só) ----
  const campaignDefs = [
    { id: 'demo-aurora-google-pesquisa', name: 'Pesquisa — Marca + Genéricas', connId: googleConn.id, channel: 'google_ads', campaignType: 'SEARCH', shareM1M2: 0.35, shareM3: 0.3, cpa: [40, 36, 33] },
    { id: 'demo-aurora-google-pmax', name: 'Performance Max — Catálogo Completo', connId: googleConn.id, channel: 'google_ads', campaignType: 'PERFORMANCE_MAX', shareM1M2: 0.25, shareM3: 0.25, cpa: [45, 41, 37] },
    { id: 'demo-aurora-meta-prospeccao', name: 'Prospecção — Moda e Acessórios', connId: metaConn.id, channel: 'meta_ads', campaignType: 'SALES', shareM1M2: 0.25, shareM3: 0.3, cpa: [55, 50, 45] },
    { id: 'demo-aurora-meta-remarketing', name: 'Remarketing — Catálogo Dinâmico', connId: metaConn.id, channel: 'meta_ads', campaignType: 'SALES', shareM1M2: 0.15, shareM3: 0.15, cpa: [30, 27, 24] },
  ]
  const linkIds: Record<string, string> = {}
  for (const c of campaignDefs) {
    const { data: link, error: linkErr } = await supabase
      .from('project_campaign_links')
      .insert({ project_id: project.id, connection_id: c.connId, external_campaign_id: c.id, external_campaign_name: c.name, last_known_status: 'ENABLED' })
      .select('id')
      .single()
    if (linkErr) throw linkErr
    linkIds[c.id] = link.id as string
  }

  // ---- Série diária: nível cliente ----
  // Meses 1-2: dentro da verba incluída do plano Dominação (R$90mil).
  // Mês corrente: investimento deliberadamente alto, projetando acima
  // de R$90mil pro aviso de "Ritmo de verba" aparecer na Análise.
  const SPEND_M1 = 16000
  const SPEND_M2 = 18000
  const SPEND_M3_PROJECTED = 96000
  const clientM1 = buildDailySeries(m1.year, m1.month0, SPEND_M1, 47, 0)
  const clientM2 = buildDailySeries(m2.year, m2.month0, SPEND_M2, 42, 0)
  const clientM3 = buildDailySeries(m3.year, m3.month0, Math.round(SPEND_M3_PROJECTED * elapsed), 38, 0, todayDay)
  const clientDays = [...clientM1, ...clientM2, ...clientM3]

  await insertInChunks(
    supabase,
    'performance_snapshots',
    clientDays
      .filter((d) => d.spend > 0)
      .map((d) => ({ client_id: clientId, project_id: project.id, snapshot_date: d.date, channel: 'meta_ads', spend: d.spend, clicks: d.clicks, impressions: d.impressions, conversions: d.conversions })),
  )
  await supabase.rpc('generate_monthly_client_reports', { p_ref_month: r1.start })
  await supabase.rpc('generate_monthly_client_reports', { p_ref_month: r2.start })

  // ---- Série diária por campanha + impressão perdida (só Pesquisa) ----
  const campaignRows: Record<string, unknown>[] = []
  for (const c of campaignDefs) {
    const days = [
      ...buildDailySeries(m1.year, m1.month0, SPEND_M1 * c.shareM1M2, c.cpa[0], 0),
      ...buildDailySeries(m2.year, m2.month0, SPEND_M2 * c.shareM1M2, c.cpa[1], 0),
      ...buildDailySeries(m3.year, m3.month0, Math.round(SPEND_M3_PROJECTED * c.shareM3 * elapsed), c.cpa[2], 0, todayDay),
    ]
    for (const d of days) {
      if (d.spend <= 0) continue
      campaignRows.push({
        connection_id: c.connId,
        external_campaign_id: c.id,
        external_campaign_name: c.name,
        client_id: clientId,
        channel: c.channel,
        snapshot_date: d.date,
        spend: d.spend,
        clicks: d.clicks,
        impressions: d.impressions,
        conversions: d.conversions,
        campaign_type: c.campaignType,
        campaign_status: 'ENABLED',
        ...(c.campaignType === 'SEARCH'
          ? { search_rank_lost_impression_share: round2(randBetween(12, 26)), search_budget_lost_impression_share: round2(randBetween(3, 11)) }
          : {}),
      })
    }
  }
  await insertInChunks(supabase, 'campaign_performance_snapshots', campaignRows)

  // ---- "Grupos de Anúncios"/"Campanha" (Fase 50.C.1) — registro, não
  // chamada ao vivo. Keywords/termos/geo/dispositivo só fazem sentido
  // pras 2 campanhas do Google (a de Pesquisa fica completa; a PMax só
  // com dispositivo/geo/conversão, sem keyword — igual uma PMax real). ----
  function adGroup(id: string, name: string, spend: number, clicks: number, impressions: number, conversions: number, quality: number | null) {
    return { id, name, status: 'ACTIVE', spend: round2(spend), clicks, impressions, conversions, avgQualityScore: quality }
  }
  const searchInsights = {
    devices: [
      { device: 'MOBILE', spend: 9800, clicks: 2100, impressions: 48000, conversions: 180 },
      { device: 'DESKTOP', spend: 5200, clicks: 980, impressions: 19000, conversions: 95 },
      { device: 'TABLET', spend: 900, clicks: 160, impressions: 4200, conversions: 12 },
    ],
    topSearchTerms: [
      { term: 'loja aurora roupas femininas', clicks: 340, impressions: 2100, conversions: 28 },
      { term: 'vestido feminino online', clicks: 210, impressions: 1800, conversions: 15 },
      { term: 'acessórios femininos loja online', clicks: 150, impressions: 1200, conversions: 9 },
    ],
    topKeywords: [
      { keyword: 'loja aurora', clicks: 420, impressions: 1900, conversions: 38 },
      { keyword: 'vestido feminino', clicks: 260, impressions: 2400, conversions: 17 },
      { keyword: 'acessórios femininos online', clicks: 180, impressions: 1700, conversions: 11 },
    ],
    geoBreakdown: [
      { name: 'São Paulo, SP', clicks: 980, impressions: 12000, conversions: 92 },
      { name: 'Rio de Janeiro, RJ', clicks: 410, impressions: 5200, conversions: 34 },
      { name: 'Belo Horizonte, MG', clicks: 230, impressions: 2900, conversions: 18 },
    ],
    conversionBreakdown: [{ actionName: 'Compra', conversions: 287, conversionValue: 60270 }],
    ageRanges: [
      { range: '25-34', clicks: 1200, impressions: 22000, conversions: 110 },
      { range: '35-44', clicks: 980, impressions: 19000, conversions: 95 },
      { range: '45-54', clicks: 420, impressions: 9000, conversions: 32 },
    ],
    genders: [
      { gender: 'FEMALE', clicks: 2400, impressions: 48000, conversions: 240 },
      { gender: 'MALE', clicks: 500, impressions: 11000, conversions: 35 },
    ],
    bestTiming: { dayOfWeek: 'QUARTA', hourBucket: '19-21' },
  }
  await insertInChunks(supabase, 'demo_campaign_details', [
    {
      connection_id: googleConn.id,
      external_campaign_id: 'demo-aurora-google-pesquisa',
      ad_groups: [adGroup('demo-adset-pesquisa-marca', 'Marca — Loja Aurora', 6500, 1400, 9800, 140, 8.4), adGroup('demo-adset-pesquisa-generica', 'Genéricas — Moda Feminina', 9400, 1840, 61400, 147, 6.1)],
      insights: searchInsights,
    },
    {
      connection_id: googleConn.id,
      external_campaign_id: 'demo-aurora-google-pmax',
      ad_groups: [adGroup('demo-adset-pmax-1', 'Grupo de recursos — Catálogo completo', 11200, 2100, 88000, 232, null)],
      insights: {
        devices: [
          { device: 'MOBILE', spend: 7800, clicks: 1500, impressions: 62000, conversions: 165 },
          { device: 'DESKTOP', spend: 3400, clicks: 600, impressions: 26000, conversions: 67 },
        ],
        topSearchTerms: [],
        topKeywords: [],
        geoBreakdown: [
          { name: 'São Paulo, SP', clicks: 820, impressions: 32000, conversions: 98 },
          { name: 'Curitiba, PR', clicks: 310, impressions: 14000, conversions: 34 },
        ],
        conversionBreakdown: [{ actionName: 'Compra', conversions: 232, conversionValue: 48720 }],
        ageRanges: [],
        genders: [],
        bestTiming: null,
      },
    },
    {
      connection_id: metaConn.id,
      external_campaign_id: 'demo-aurora-meta-prospeccao',
      ad_groups: [adGroup('demo-adset-prosp-1', 'Interesse — Moda e Acessórios', 7200, 2400, 180000, 131, null), adGroup('demo-adset-prosp-2', 'Lookalike 1% — Compradores', 5800, 1850, 140000, 105, null)],
      insights: {},
    },
    {
      connection_id: metaConn.id,
      external_campaign_id: 'demo-aurora-meta-remarketing',
      ad_groups: [adGroup('demo-adset-remkt-1', 'Catálogo dinâmico — Visitantes 30 dias', 7800, 2600, 95000, 325, null)],
      insights: {},
    },
  ])

  // ---- Metas SMART ----
  const lastDay3 = r3.end
  await insertInChunks(supabase, 'smart_goals', [
    { title: 'Manter ROAS acima de 4,5', client_id: clientId, metric_type: 'roas', target_value: 4.5, current_value: 5.2, target_date: lastDay3, status: 'on_track' },
    { title: 'CPA médio abaixo de R$45', client_id: clientId, metric_type: 'cpa', target_value: 45, current_value: 41, target_date: lastDay3, status: 'on_track' },
    { title: 'Faturamento de R$95.000 no mês', client_id: clientId, metric_type: 'faturamento', target_value: 95000, current_value: Math.round(95000 * elapsed), target_date: lastDay3, status: 'at_risk' },
  ])

  // ---- Catálogo (leve — não é o foco do pedido pra esse cliente) ----
  await insertInChunks(supabase, 'catalog_entries', [
    { client_id: clientId, catalog_type: 'criativo', tipo: 'video', conteudo: 'Vídeo — nova coleção, modelo usando 3 looks', origem: 'manual', status: 'aprovado_implementado', prioridade: 'alta', rating: 5 },
    { client_id: clientId, catalog_type: 'criativo', tipo: 'headline', conteudo: 'Nova coleção chegou — frete grátis', origem: 'ia', status: 'aprovado_implementado', prioridade: 'alta', rating: 4 },
    { client_id: clientId, catalog_type: 'criativo', tipo: 'headline', conteudo: 'Até 30% off essa semana', origem: 'manual', status: 'em_teste', prioridade: 'media', rating: null },
    { client_id: clientId, catalog_type: 'segmentacao', tipo: null, conteudo: 'Lookalike 1% — compradores últimos 180 dias', origem: 'manual', status: 'aprovado_implementado', prioridade: 'alta', rating: null },
  ])

  // ---- Workflows (leve) ----
  await insertInChunks(supabase, 'tasks', [
    { title: 'Atualizar feed do catálogo (Google Merchant Center)', client_id: clientId, project_id: project.id, category: 'Gestão de tráfego', priority: 'high', status: 'done', due_date: r2.start },
    { title: 'Revisar públicos com fadiga de anúncio', client_id: clientId, project_id: project.id, category: 'Gestão de tráfego', priority: 'medium', status: 'done', due_date: r2.start },
    { title: 'Ajustar orçamento pro pico de investimento do mês', client_id: clientId, project_id: project.id, category: 'Gestão de tráfego', priority: 'high', status: 'in_progress', due_date: r3.start },
  ])

  // ---- Análise do Gestor: 12 semanais (curta) + 3 estratégicas mensais ----
  function mondayOf(d: Date): Date {
    const dow = d.getUTCDay()
    const diff = (dow + 6) % 7
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diff))
  }
  const thisMonday = mondayOf(new Date(`${todayISO}T00:00:00Z`))
  const weeks: { start: string; end: string }[] = []
  for (let w = 11; w >= 0; w--) {
    const start = new Date(Date.UTC(thisMonday.getUTCFullYear(), thisMonday.getUTCMonth(), thisMonday.getUTCDate() - w * 7))
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 6))
    weeks.push({ start: isoDate(start), end: isoDate(end) })
  }

  const alertPool = [
    'Nenhum anúncio com sinal de fadiga essa semana.',
    'Criativo "Remarketing — vídeo 1" com frequência subindo, já marcado pra troca na próxima rodada.',
    'CPA da Pesquisa subiu levemente, dentro da variação normal — sem ação necessária.',
    'Público lookalike 1% com CTR acima da média, aumentamos o orçamento dele.',
    'Campanha Performance Max estabilizou depois do último ajuste do feed.',
    'Anúncio principal da Prospecção começando a saturar — novo criativo entra semana que vem.',
  ]
  const weeklyRows: Record<string, unknown>[] = []
  weeks.forEach((w, idx) => {
    const weekDays = clientDays.filter((d) => d.date >= w.start && d.date <= w.end)
    const spend = weekDays.reduce((s, d) => s + d.spend, 0)
    const conversions = weekDays.reduce((s, d) => s + d.conversions, 0)
    const revenue = conversions * 210
    const roas = spend > 0 ? revenue / spend : 0
    weeklyRows.push({
      client_id: clientId,
      period_start: w.start,
      period_end: w.end,
      tipo: 'periodica',
      status: 'publicada',
      published_at: new Date(new Date(`${w.end}T18:00:00Z`).getTime()).toISOString(),
      resumo: `Semana ${idx + 1}/12: investimento de ${brl(spend)}, ${conversions} vendas, ROAS ${roas.toFixed(1)}.`,
      diagnostico: roas >= 4.5 ? 'Semana dentro da meta, sem alerta crítico.' : 'Semana um pouco abaixo da média, acompanhando de perto antes de ajustar.',
      otimizacoes_realizadas: 'Revisão de lances e públicos conforme o ritmo da semana.',
      creatives_used_snapshot: Math.min(15, 3 + (idx % 4)),
      changes_used_snapshot: Math.min(12, 2 + (idx % 3)),
      proximos_passos: [{ titulo: 'Acompanhar ritmo de verba e CPA na próxima semana', data: null }],
      pendencias_cliente_texto: null,
      extra_fields: { alertas: alertPool[idx % alertPool.length] },
    })
  })
  await insertInChunks(supabase, 'manager_analyses', weeklyRows)

  const monthlyStrategicRows = [
    {
      client_id: clientId,
      period_start: r1.start,
      period_end: r1.end,
      tipo: 'estrategica_mensal',
      status: 'publicada',
      published_at: new Date(Date.UTC(m1.year, m1.month0 + 1, 3)).toISOString(),
      resumo: `Mês estável: ${brl(SPEND_M1)} investidos, ROAS acima de 4,5. Iniciamos o planejamento de pós-venda.`,
      diagnostico: 'Mix Google/Meta equilibrado, CPA dentro da meta nas 2 plataformas. Primeiros passos de pós-venda (mensagens de reativação no WhatsApp) desenhados, entram em operação no mês 2.',
      otimizacoes_realizadas: 'Revisão de públicos de prospecção, ajuste de lance na Pesquisa.',
      creatives_used_snapshot: 6,
      changes_used_snapshot: 5,
      proximos_passos: [
        { titulo: 'Ativar mensagens de pós-venda/reativação (LTV)', data: r2.start },
        { titulo: 'Testar aumento gradual de verba na Performance Max', data: r2.start },
      ],
      pendencias_cliente_texto: null,
      extra_fields: {
        concorrencia: 'Dois concorrentes diretos aumentaram investimento em mídia paga no período — acompanhando impacto no CPC.',
        parcela_impressoes_perdida: 'Pesquisa perdendo ~15-20% de impressão por posição (orçamento suficiente, falta de lance em termos de cauda longa).',
        cenario_escala: 'Espaço pra aumentar verba em Performance Max sem perder eficiência, dado o volume de catálogo.',
        riscos: 'Nenhum risco crítico identificado no período.',
      },
    },
    {
      client_id: clientId,
      period_start: r2.start,
      period_end: r2.end,
      tipo: 'estrategica_mensal',
      status: 'publicada',
      published_at: new Date(Date.UTC(m2.year, m2.month0 + 1, 3)).toISOString(),
      resumo: `Mês de consolidação: ${brl(SPEND_M2)} investidos, ROAS em torno de 5. Pós-venda ativo, primeiras reativações confirmadas.`,
      diagnostico: 'Mensagens de pós-venda/reativação (LTV) no WhatsApp Business já em operação, com primeiras recompras atribuídas. Performance Max absorveu bem o aumento de verba testado no fim do mês 1.',
      otimizacoes_realizadas: 'Aumento de verba em Performance Max, novo criativo de vídeo na Remarketing, ativação do fluxo de pós-venda.',
      creatives_used_snapshot: 8,
      changes_used_snapshot: 7,
      proximos_passos: [
        { titulo: 'Avaliar aumento de verba geral pro mês 3', data: r3.start },
        { titulo: 'Expandir lookalike de compradores recorrentes', data: r3.start },
      ],
      pendencias_cliente_texto: null,
      extra_fields: {
        concorrencia: 'Concorrência estabilizou o investimento — sem pressão adicional de CPC no período.',
        parcela_impressoes_perdida: 'Pesquisa reduziu a perda por posição pra ~10-14%, depois do ajuste de lance.',
        cenario_escala: 'Cenário positivo pra escalar verba no mês 3, mantendo o ROAS acima de 4,5.',
        riscos: 'Dependência alta da Performance Max — vale diversificar com mais uma frente no Google.',
      },
    },
    {
      client_id: clientId,
      period_start: r3.start,
      period_end: r3.end,
      tipo: 'estrategica_mensal',
      status: 'publicada',
      published_at: new Date().toISOString(),
      resumo: `Mês de escala: investimento projetado acima da verba incluída no plano (~${brl(SPEND_M3_PROJECTED)}), com aprovação prévia pendente de confirmação formal do cliente.`,
      diagnostico: 'Resultado justificou o aumento de verba (ROAS seguindo acima de 5) — o "Ritmo de verba" já avisou que o mês vai passar da verba gerenciada incluída no plano Dominação (R$90.000), então o modificador do Anexo I se aplica, mediante aprovação prévia por escrito.',
      otimizacoes_realizadas: 'Aumento de verba em todas as 4 campanhas, priorizando Pesquisa e Prospecção (maior ROAS marginal).',
      creatives_used_snapshot: 11,
      changes_used_snapshot: 9,
      proximos_passos: [
        { titulo: 'Confirmar aprovação formal do aumento de verba com o cliente', data: isoDate(new Date(Date.UTC(m3.year, m3.month0 + 1, 2))) },
        { titulo: 'Planejar cenário de escala pro próximo trimestre', data: isoDate(new Date(Date.UTC(m3.year, m3.month0 + 1, 10))) },
      ],
      pendencias_cliente_texto: 'Confirmar por escrito a aprovação do investimento acima da verba incluída (cláusula 4.6 do Anexo I).',
      extra_fields: {
        concorrencia: 'Sazonalidade favorável no setor — todos os concorrentes aumentando investimento, janela de oportunidade.',
        parcela_impressoes_perdida: 'Pesquisa voltou a perder impressão por orçamento (~8-12%) depois do aumento de demanda — espaço real pra crescer mais.',
        cenario_escala: 'Cenário de escala agressiva válido enquanto o ROAS seguir acima de 4,5 — monitorar semana a semana.',
        riscos: 'Risco de fadiga de público em Prospecção se o ritmo de aumento continuar no próximo mês sem diversificar criativo.',
      },
    },
  ]
  await insertInChunks(supabase, 'manager_analyses', monthlyStrategicRows)

  // ---- Reuniões semanais + 1 de emergência usada no mês ----
  // Nota: `is_emergency` precisa estar em TODAS as linhas (mesmo tendo
  // default false no banco) — o mesmo comportamento do PostgREST já
  // achado no insert de `approvals` na Fase 50.C: chave ausente numa
  // linha do array vira NULL explícito, não o default da coluna.
  const meetingRows: Record<string, unknown>[] = weeks.map((w, idx) => ({
    title: `Reunião semanal — semana ${idx + 1}/12`,
    client_id: clientId,
    date: new Date(`${w.start}T15:00:00Z`).toISOString(),
    meeting_link: 'https://meet.google.com/demo-aurora-semanal',
    status: idx < 11 ? 'completed' : 'scheduled',
    is_emergency: false,
  }))
  meetingRows.push({
    title: 'Reunião de Emergência — pico de investimento do mês',
    client_id: clientId,
    date: new Date(`${r3.start}T11:00:00Z`).toISOString(),
    meeting_link: 'https://meet.google.com/demo-aurora-emergencia',
    status: 'completed',
    is_emergency: true,
  })
  await insertInChunks(supabase, 'meetings', meetingRows)

  // ---- Comentários ----
  await insertInChunks(supabase, 'comments', [
    { title: null, content: 'Time, o investimento desse mês vai passar da verba incluída no plano — já alinhado com vocês o motivo (sazonalidade boa). Só preciso da aprovação formal por escrito.', client_id: clientId, entity_type: 'general', entity_id: clientId, author_name: 'Davi (Gestor)', author_role: 'gestor' },
    { title: null, content: 'Aprovado! Pode seguir com o aumento, os números estão muito bons.', client_id: clientId, entity_type: 'general', entity_id: clientId, author_name: 'Loja Aurora', author_role: 'cliente' },
  ])

  // ---- Arquivos + aprovações ----
  await insertInChunks(supabase, 'file_items', [{ name: 'Catálogo_NovaColecao.pdf', client_id: clientId, folder: 'Criativos', file_url: 'https://upload.wikimedia.org/wikipedia/commons/8/8d/Example.pdf', file_type: 'application/pdf' }])
  await insertInChunks(supabase, 'approvals', [
    { title: 'Vídeo — nova coleção (3 looks)', client_id: clientId, file_url: 'https://picsum.photos/seed/aurora-video/1280/720', file_type: 'video/mp4', status: 'approved', feedback: 'Aprovado!', requires_explicit_approval: false },
  ])

  // ---- Health Score em atenção + 1 alerta aberto (problema real,
  // ainda não resolvido — mostra como ele aparece antes de ser tratado) ----
  await insertInChunks(supabase, 'metric_alert_thresholds', [{ client_id: clientId, metric: 'cpa', comparison: 'above', threshold_value: 50, enabled: true }])
  await insertInChunks(supabase, 'alerts', [
    { title: 'CPA acima do limite configurado', message: `CPA nos últimos 7 dias acima de R$50 na campanha de Prospecção — verificar fadiga de público.`, client_id: clientId, severity: 'medium', category: 'limiar_metrica', resolved: false },
  ])
  await insertInChunks(supabase, 'client_health_score_snapshots', [
    { client_id: clientId, snapshot_date: r2.start, health_score: 64 },
    { client_id: clientId, snapshot_date: todayISO, health_score: 58 },
  ])
}

async function handleRecreate(req: Request) {
  const auth = await requireAdminOrGestor(req)
  if (auth instanceof Response) return auth

  const supabase = getServiceClient()

  // Marca os 2 clientes demo ANTES de limpar, pra remove_demo_data()
  // já pegar tudo de uma vez — inclusive o histórico de teste antigo da
  // Loja Aurora, na 1ª conversão dela (confirmado com o usuário: ela
  // nunca foi um cliente real, só uma conta de testes — seguro limpar).
  let lojaAuroraId: string | null
  let clinicaSorrisoId: string
  try {
    lojaAuroraId = await ensureLojaAuroraDemoFlag(supabase)
    clinicaSorrisoId = await ensureClinicaSorrisoShell(supabase)
  } catch (err) {
    return dbErrorResponse('handleRecreate: garantir clientes demo', err as { message: string })
  }

  const { error: removeError } = await supabase.rpc('remove_demo_data')
  if (removeError) return dbErrorResponse('handleRecreate: remover dado antigo', removeError)

  const today = new Date().toISOString().slice(0, 10)
  await seedClinicaSorriso(supabase, clinicaSorrisoId, today)
  if (lojaAuroraId) await seedLojaAurora(supabase, lojaAuroraId, today)

  // Fase 50.E — login do Portal do Cliente pros 2 clientes demo (senha
  // fixa documentada fora do git, ver docs/interno/credenciais-demo.local.md).
  try {
    await ensureDemoClientUser(supabase, clinicaSorrisoId, 'demo@clinicasorriso.com.br', 'Fernanda Lima')
    if (lojaAuroraId) await ensureDemoClientUser(supabase, lojaAuroraId, 'demo@lojaaurora.com', 'Rafael Costa')
  } catch (err) {
    return dbErrorResponse('handleRecreate: garantir login dos clientes demo', err as { message: string })
  }

  return jsonResponse({ ok: true, clinicaSorrisoId, lojaAuroraId })
}

async function handleRemove(req: Request) {
  const auth = await requireAdminOrGestor(req)
  if (auth instanceof Response) return auth

  const supabase = getServiceClient()
  const { error } = await supabase.rpc('remove_demo_data')
  if (error) return dbErrorResponse('handleRemove: remover dado demo', error)
  return jsonResponse({ ok: true })
}

async function routeRequest(req: Request, url: URL): Promise<Response> {
  try {
    if (req.method === 'POST' && url.pathname.endsWith('/recreate')) return await handleRecreate(req)
    if (req.method === 'POST' && url.pathname.endsWith('/remove')) return await handleRemove(req)
    return jsonResponse({ error: 'Rota não encontrada. Use /recreate ou /remove.' }, 404)
  } catch (err) {
    console.error('[demo-data] erro inesperado:', err)
    await logServerError('demo-data', 'erro inesperado', err)
    return jsonResponse({ error: 'Erro inesperado. Tente novamente.' }, 500)
  }
}

Deno.serve(async (req) => {
  const allowOrigin = resolveAllowedOrigin(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { ...corsHeaders, 'Access-Control-Allow-Origin': allowOrigin, Vary: 'Origin' } })
  }

  const url = new URL(req.url)
  const response = await routeRequest(req, url)
  response.headers.set('Access-Control-Allow-Origin', allowOrigin)
  response.headers.set('Vary', 'Origin')
  return response
})
