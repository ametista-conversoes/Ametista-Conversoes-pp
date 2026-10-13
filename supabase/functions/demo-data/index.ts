// Ametista Conversões — Fase 50.B: motor de "Dados de demonstração".
//
// 2 rotas, as duas POST, as duas exigem login de admin/gestor (mesmo
// padrão de requireAdminOrGestor já usado em integrations/index.ts,
// duplicado aqui de propósito — cada Edge Function deste projeto é
// autocontida, sem import cruzado entre funções):
//   POST .../demo-data/recreate — apaga e gera de novo os 2 clientes de
//                                 demonstração, com datas relativas a hoje
//   POST .../demo-data/remove   — só apaga (não gera de novo)
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
      .update({ is_demo: true, status: 'active', plan: 'validacao', chosen_platform: 'meta' })
      .eq('id', existing.id)
    if (updateError) throw updateError
    return existing.id as string
  }

  const { data: created, error: insertError } = await supabase
    .from('clients')
    .insert({
      name: CLINICA_SORRISO_NAME,
      company: 'Clínica Sorriso Odontologia',
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

/** Fase 50.C (ainda não construída): vai popular os 90 dias de dado
 * sintético da Clínica Sorriso (snapshots, leads, catálogo, testes A/B,
 * workflows, Análises do Gestor etc.) — por enquanto só garante que o
 * cliente-molde existe, sem nenhum dado além disso. */
async function seedClinicaSorriso(_supabase: SupabaseClient, _clientId: string, _today: string): Promise<void> {
  // TODO Fase 50.C
}

/** Fase 50.D (ainda não construída): vai converter a Loja Aurora REAL já
 * existente em cliente demo (is_demo=true, plano Dominação) e popular o
 * cenário de 90 dias dela. De propósito NÃO toca a Loja Aurora ainda —
 * decisão do usuário (10/10), esperar essa sub-fase antes de mexer nela. */
async function seedLojaAurora(_supabase: SupabaseClient, _today: string): Promise<void> {
  // TODO Fase 50.D
}

async function handleRecreate(req: Request) {
  const auth = await requireAdminOrGestor(req)
  if (auth instanceof Response) return auth

  const supabase = getServiceClient()

  const { error: removeError } = await supabase.rpc('remove_demo_data')
  if (removeError) return dbErrorResponse('handleRecreate: remover dado antigo', removeError)

  let clinicaSorrisoId: string
  try {
    clinicaSorrisoId = await ensureClinicaSorrisoShell(supabase)
  } catch (err) {
    return dbErrorResponse('handleRecreate: garantir cliente Clínica Sorriso (demo)', err as { message: string })
  }

  const today = new Date().toISOString().slice(0, 10)
  await seedClinicaSorriso(supabase, clinicaSorrisoId, today)
  await seedLojaAurora(supabase, today)

  return jsonResponse({ ok: true, clinicaSorrisoId })
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
