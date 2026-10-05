// Ametista Conversões — Fase 26: vincular/convidar conta de acesso ao
// Portal Cliente, direto da Central de Informações (Portal Gestor) —
// antes só dava pra fazer isso com um UPDATE manual em profiles.client_id
// no SQL Editor do Supabase.
//
// Como usar: cole este arquivo inteiro numa Edge Function nova chamada
// "client-access" no painel do Supabase > Deploy. A verificação
// automática de JWT precisa estar DESLIGADA nas configurações da
// função (mesmo motivo de "cassie"/"integrations": o preflight OPTIONS
// do navegador não manda o token, e o Supabase bloqueia esse preflight
// se a verificação automática estiver ligada) — a autenticação de quem
// chama é feita na mão aqui dentro (ver `requireAdminOrGestor`).
//
// Segredo que essa função espera encontrar já configurado (Edge
// Functions > Secrets) — o mesmo `FRONTEND_URL` que "integrations" já
// usa, nenhum segredo novo:
//   FRONTEND_URL — https://ametistaconversoes.app em produção
//
// Rotas (só admin/gestor):
//   GET  .../client-access/linked?client_id=<uuid>
//     -> { accounts: [{ id, email, full_name, pending }] } — contas hoje
//        vinculadas a esse cliente (profiles.client_id = client_id).
//        `pending: true` quando `full_name` ainda está vazio — sinal de
//        que a pessoa nunca terminou de aceitar o convite (a tela
//        /reset-password só grava full_name depois de escolher a
//        senha), mesmo que o Supabase já tenha criado a conta no
//        momento do convite.
//
//   POST .../client-access/link   { client_id: string, email: string }
//     Se já existe uma conta com esse e-mail: vincula (profiles.client_id
//     + role='cliente'), sem mandar e-mail nenhum de novo — pra reenviar
//     o convite de uma conta que já existe, usar /resend-invite. Se não
//     existe: convida via supabase.auth.admin.inviteUserByEmail (cria a
//     conta E manda o e-mail de convite do próprio Supabase) e já
//     vincula em seguida.
//     -> { created: boolean }
//
//   POST .../client-access/resend-invite   { profile_id: string }
//     Reenvia um link de acesso pra uma conta que ainda está pendente
//     (full_name vazio). Achado ao vivo: inviteUserByEmail de novo pro
//     MESMO e-mail dá erro "A user with this email address has already
//     been registered" — a conta já existe desde o primeiro convite,
//     diferente do que o comentário original aqui assumia. Usa
//     resetPasswordForEmail em vez disso (o mesmo "esqueci minha senha"
//     público, funciona pra qualquer conta existente independente de
//     confirmação) — chega com o assunto "Redefinir senha" em vez de
//     "Você foi convidado", mas cai no mesmo link/fluxo (sessão
//     temporária + /reset-password), então funciona igual. Recusa com
//     409 se a conta já foi confirmada (full_name preenchido) — nesse
//     caso a pessoa já tem senha, não é mais um convite pendente, e deve
//     usar "Esqueci minha senha" na tela de login.
//     -> { ok: true }
//
//   POST .../client-access/unlink   { profile_id: string }
//     Remove o vínculo (client_id = null). Não apaga a conta nem muda o
//     papel — só tira o acesso a esse cliente específico.
//     -> { ok: true }

import { createClient } from 'jsr:@supabase/supabase-js@2'

// Mesmo padrão de integrations/index.ts (Fase 44) e cassie/index.ts
// (Fase 46): lista de domínios conhecidos em vez de um único fixo, pra
// permitir teste ao vivo a partir de localhost contra este mesmo
// backend de produção.
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
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
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
  console.error(`[client-access] ${context}:`, error)
  await logServerError('client-access', context, error)
  return jsonResponse({ error: 'Erro ao acessar o banco de dados. Tente novamente.' }, 500)
}

async function requireAdminOrGestor(req: Request): Promise<{ userId: string } | Response> {
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
  return { userId: userData.user.id }
}

async function handleLinked(req: Request): Promise<Response> {
  const auth = await requireAdminOrGestor(req)
  if (auth instanceof Response) return auth

  const clientId = new URL(req.url).searchParams.get('client_id')
  if (!clientId) return jsonResponse({ error: 'client_id é obrigatório' }, 400)

  const { data, error } = await getServiceClient()
    .from('profiles')
    .select('id, email, full_name')
    .eq('client_id', clientId)
    .eq('role', 'cliente')
  if (error) return dbErrorResponse('handleLinked', error)

  const accounts = (data ?? []).map((account) => ({ ...account, pending: !account.full_name }))
  return jsonResponse({ accounts })
}

async function handleLink(req: Request): Promise<Response> {
  const auth = await requireAdminOrGestor(req)
  if (auth instanceof Response) return auth

  const body = await req.json().catch(() => null)
  const clientId = body?.client_id as string | undefined
  const email = (body?.email as string | undefined)?.trim().toLowerCase()
  if (!clientId || !email) return jsonResponse({ error: 'client_id e email são obrigatórios' }, 400)

  const supabase = getServiceClient()

  const { data: existing, error: findError } = await supabase
    .from('profiles')
    .select('id, role')
    .ilike('email', email)
    .maybeSingle()
  if (findError) return dbErrorResponse('handleLink: buscar conta existente', findError)

  if (existing) {
    if (existing.role !== 'cliente') {
      return jsonResponse(
        { error: 'Esse e-mail já é de uma conta da equipe da agência (admin/gestor) — não pode virar login de cliente.' },
        409,
      )
    }
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ client_id: clientId, role: 'cliente' })
      .eq('id', existing.id)
    if (updateError) return dbErrorResponse('handleLink: vincular conta existente', updateError)
    return jsonResponse({ created: false })
  }

  const frontendUrl = Deno.env.get('FRONTEND_URL') ?? 'http://localhost:5173'
  const { data: invited, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${frontendUrl}/reset-password`,
  })
  if (inviteError || !invited?.user) return dbErrorResponse('handleLink: convidar nova conta', inviteError ?? { message: 'convite sem usuário' })

  // O gatilho on_auth_user_created já criou a linha em profiles (role
  // padrão 'cliente') no mesmo insert que o convite acabou de fazer —
  // só falta gravar o client_id.
  const { error: linkError } = await supabase
    .from('profiles')
    .update({ client_id: clientId, role: 'cliente' })
    .eq('id', invited.user.id)
  if (linkError) return dbErrorResponse('handleLink: vincular conta recém-convidada', linkError)

  return jsonResponse({ created: true })
}

async function handleResendInvite(req: Request): Promise<Response> {
  const auth = await requireAdminOrGestor(req)
  if (auth instanceof Response) return auth

  const body = await req.json().catch(() => null)
  const profileId = body?.profile_id as string | undefined
  if (!profileId) return jsonResponse({ error: 'profile_id é obrigatório' }, 400)

  const supabase = getServiceClient()

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', profileId)
    .maybeSingle()
  if (profileError) return dbErrorResponse('handleResendInvite: buscar conta', profileError)
  if (!profile) return jsonResponse({ error: 'Conta não encontrada' }, 404)
  if (profile.role !== 'cliente') return jsonResponse({ error: 'Essa conta não é de um cliente' }, 409)
  if (!profile.email) return jsonResponse({ error: 'Essa conta não tem e-mail cadastrado' }, 409)
  if (profile.full_name) {
    return jsonResponse(
      { error: 'Essa conta já foi confirmada — peça pra usar "Esqueci minha senha" na tela de login.' },
      409,
    )
  }

  // inviteUserByEmail de novo pro mesmo e-mail dá "already been
  // registered" (a conta já existe desde o primeiro convite) —
  // resetPasswordForEmail é o caminho certo pra reenviar um link de
  // acesso pra uma conta que já existe, confirmada ou não.
  const frontendUrl = Deno.env.get('FRONTEND_URL') ?? 'http://localhost:5173'
  const { error: resendError } = await supabase.auth.resetPasswordForEmail(profile.email, {
    redirectTo: `${frontendUrl}/reset-password`,
  })
  if (resendError) {
    console.error('[client-access] handleResendInvite: reenviar convite:', resendError)
    await logServerError('client-access', 'handleResendInvite: reenviar convite', resendError)
    return jsonResponse({ error: resendError.message || 'Não foi possível reenviar o convite. Tente novamente.' }, 500)
  }

  return jsonResponse({ ok: true })
}

async function handleUnlink(req: Request): Promise<Response> {
  const auth = await requireAdminOrGestor(req)
  if (auth instanceof Response) return auth

  const body = await req.json().catch(() => null)
  const profileId = body?.profile_id as string | undefined
  if (!profileId) return jsonResponse({ error: 'profile_id é obrigatório' }, 400)

  const { error } = await getServiceClient().from('profiles').update({ client_id: null }).eq('id', profileId)
  if (error) return dbErrorResponse('handleUnlink', error)

  return jsonResponse({ ok: true })
}

async function routeRequest(req: Request, url: URL): Promise<Response> {
  try {
    if (req.method === 'GET' && url.pathname.endsWith('/linked')) return await handleLinked(req)
    if (req.method === 'POST' && url.pathname.endsWith('/link')) return await handleLink(req)
    if (req.method === 'POST' && url.pathname.endsWith('/resend-invite')) return await handleResendInvite(req)
    if (req.method === 'POST' && url.pathname.endsWith('/unlink')) return await handleUnlink(req)
    return jsonResponse({ error: 'Rota não encontrada. Use /linked, /link, /resend-invite ou /unlink.' }, 404)
  } catch (err) {
    console.error('[client-access] erro inesperado:', err)
    await logServerError('client-access', 'erro inesperado', err)
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
