// Ametista Conversões — Fase 7.1: Cassie IA (chat do portal do
// cliente e da Central de Informações do Cliente no portal do
// gestor), via API da OpenAI.
//
// Como usar: cole este arquivo inteiro no painel do Supabase, em
// Edge Functions > (nome real da função nesse projeto, ver abaixo) >
// editar código > Deploy. A verificação automática de JWT precisa
// estar DESLIGADA nas configurações da função — mesmo que só o nosso
// próprio front-end chame essa rota, o navegador manda um pedido
// "preflight" (OPTIONS) sem o token de login antes da chamada de
// verdade, e o Supabase bloqueia esse preflight se a verificação
// automática estiver ligada. A autenticação de quem chama já é feita
// na mão aqui dentro (ver `requireCassieCaller`), igual a função
// "integrations" já faz.
//
// Nomes reais nesse projeto (podem não bater com os "certos" por
// causa de como foram criados no painel — ver src/lib/cassie.ts):
//   Função: CASSIE
//   Segredo da OpenAI: Openai_api_key
//
// Segredo que essa função espera encontrar configurado (Edge
// Functions > Secrets), além dos que o Supabase já injeta sozinho em
// toda função (SUPABASE_URL, SUPABASE_ANON_KEY,
// SUPABASE_SERVICE_ROLE_KEY):
//   Openai_api_key — gerada em platform.openai.com, colada direto aqui
//                     (nunca no código, nunca no chat com o Claude).
//
// Rotas:
//   POST .../CASSIE/chat   { client_id?: string, message: string, mode: CassieMode }
//   client_id só é obrigatório (e só é respeitado) quando quem chama é
//   admin/gestor — um cliente sempre conversa sobre o próprio client_id,
//   ignorando qualquer client_id que venha no corpo.
//
//   POST .../CASSIE/persuasive-copy   { client_id: string, connection_id?: string, message: string }
//   Fase 8.4/8.4b ("Comunicação Persuasiva", aba de Públicos-Alvo) —
//   só admin/gestor; conversa persistida (persuasive_copy_messages,
//   mesmo espírito de cassie_messages) que gera/ajusta headlines e
//   textos de anúncio a partir das respostas abertas (texto livre) dos
//   Google Forms conectados do cliente. connection_id opcional
//   restringe a um formulário só; sem ele, usa todos os Google Forms
//   conectados do cliente (e a conversa fica separada por essa mesma
//   combinação de cliente+formulário). O botão "Gerar sugestões com
//   IA" do front-end manda uma message fixa por essa mesma rota.

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

const OPENAI_MODEL = 'gpt-5-mini' // linha "mini", mais barata — trocar aqui se quiser subir de modelo depois
const HISTORY_LIMIT = 20 // últimas mensagens incluídas como contexto, pra não deixar a conversa cara conforme cresce

// Restrito a uma lista de domínios conhecidos — antes era '*' (qualquer
// site podia chamar), trocado ao publicar o app de verdade. Inclui
// localhost:5173 pelo mesmo motivo documentado em integrations/index.ts
// (Fase 44): não existe deploy separado desta função pra "ambiente de
// teste", todo teste ao vivo chama este mesmo backend de produção a
// partir do navegador local.
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

// Fase 20.1: nunca devolver error.message bruto (Postgres/OpenAI) pro
// navegador — loga o erro completo no servidor (visível em Edge
// Functions > Logs no painel do Supabase) e devolve só uma mensagem
// genérica pro cliente.
async function dbErrorResponse(context: string, error: { message: string }) {
  console.error(`[cassie] ${context}:`, error)
  await logServerError('cassie', context, error)
  return jsonResponse({ error: 'Erro ao acessar o banco de dados. Tente novamente.' }, 500)
}

async function openaiErrorResponse(context: string, body: unknown) {
  console.error(`[cassie] ${context} — erro da OpenAI:`, body)
  await logServerError('cassie', `${context} — erro da OpenAI`, body)
  return jsonResponse({ error: 'Erro ao consultar a IA. Tente novamente.' }, 502)
}

// Fase 46 — rate limiting por usuário: a Cassie chama a OpenAI (custo
// real por mensagem) e qualquer cliente/admin/gestor autenticado
// consegue chamar `/chat` sem nenhum limite hoje. Contador vive no
// Postgres (`check_rate_limit`, migration-083) porque não há memória
// confiável compartilhada entre invocações do Deno.
async function checkRateLimit(userId: string, bucket: string, windowSeconds: number, maxHits: number): Promise<boolean> {
  const { data: allowed, error } = await getServiceClient().rpc('check_rate_limit', {
    p_user_id: userId,
    p_bucket: bucket,
    p_window_seconds: windowSeconds,
    p_max_hits: maxHits,
  })
  if (error) {
    await logServerError('cassie', `checkRateLimit: ${bucket}`, error)
    return true // fail-open — um problema de infra aqui não pode derrubar tráfego real
  }
  return allowed === true
}

async function enforceRateLimit(
  userId: string,
  checks: Array<{ bucket: string; windowSeconds: number; maxHits: number }>,
): Promise<Response | null> {
  for (const c of checks) {
    const ok = await checkRateLimit(userId, c.bucket, c.windowSeconds, c.maxHits)
    if (!ok) return jsonResponse({ error: 'Muitas requisições. Aguarde um pouco antes de tentar de novo.' }, 429)
  }
  return null
}

type CassieMode = 'assistente' | 'analista' | 'consultora' | 'auditora'
const CASSIE_MODES: CassieMode[] = ['assistente', 'analista', 'consultora', 'auditora']

// Quantos modos cada plano libera pro cliente (Fase 7 — especificação
// original; Fase 11b — Dominação passou a liberar os 4, antes faltava
// "auditora"). Admin/gestor sempre veem os 4, independente de plano,
// porque não estão presos ao plano de um cliente específico.
const PLAN_MODES: Record<string, CassieMode[]> = {
  validacao: ['assistente'],
  escala: ['assistente', 'analista'],
  dominacao: ['assistente', 'analista', 'consultora', 'auditora'],
}

function allowedModes(role: string, plan: string | null): CassieMode[] {
  if (role === 'admin' || role === 'gestor') return CASSIE_MODES
  return PLAN_MODES[plan ?? ''] ?? ['assistente']
}

async function requireCassieCaller(
  req: Request,
): Promise<{ userId: string; role: string; ownClientId: string | null } | Response> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return jsonResponse({ error: 'Não autenticado' }, 401)

  const anonClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '')
  const { data: userData, error: userError } = await anonClient.auth.getUser(token)
  if (userError || !userData.user) return jsonResponse({ error: 'Sessão inválida' }, 401)

  const supabase = getServiceClient()
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, client_id')
    .eq('id', userData.user.id)
    .single()
  if (profileError || !profile) return jsonResponse({ error: 'Perfil não encontrado' }, 403)
  if (profile.role !== 'cliente' && profile.role !== 'admin' && profile.role !== 'gestor') {
    return jsonResponse({ error: 'Não autorizado' }, 403)
  }
  return { userId: userData.user.id, role: profile.role as string, ownClientId: profile.client_id as string | null }
}

// Frase fixa usada quando a pergunta foge do escopo da Cassie — o
// front-end (src/lib/cassie-modes.ts) detecta esse texto exato pra
// exibir a bolha com estilo de alerta. Se mudar aqui, mudar lá também.
const OUT_OF_SCOPE_REPLY = 'Isso foge do que posso te ajudar por aqui — vou encaminhar para o atendimento humano da agência.'

const SYSTEM_PROMPT_BASE = `Você é a Cassie, a assistente de IA da Ametista Conversões, uma agência de marketing de performance.
Responda sempre em português do Brasil, de forma clara e direta.
Use só os dados do resumo fornecido abaixo — não invente números; se não tiver o dado, diga que não tem essa informação.
Não fale sobre outros clientes da agência que não o descrito no resumo abaixo.
Se a pergunta não tiver nenhuma relação com marketing, tráfego pago, desempenho ou a gestão do projeto/conta desse cliente, responda EXATAMENTE e só isso, sem mais nada: "${OUT_OF_SCOPE_REPLY}"`

const MODE_INSTRUCTIONS: Record<CassieMode, string> = {
  assistente:
    'Modo Assistente: tire dúvidas gerais sobre marketing digital e performance, de forma didática, usando os dados do resumo quando forem relevantes.',
  analista:
    'Modo Analista: foque em métricas (CPA, ROAS, CTR, conversões, investimento, receita) — traga os números exatos do resumo abaixo e explique o que eles significam.',
  consultora:
    'Modo Consultora: foque em estratégia, funil de conversão e recomendações de próximos passos, com base nos dados abaixo.',
  auditora:
    'Modo Auditora: foque em pendências e riscos (tarefas atrasadas, metas fora do prazo, reuniões canceladas) — aponte objetivamente o que precisa de atenção.',
}

interface ClientContextRow {
  name: string
  company: string | null
  plan: string | null
  health_score: number | null
}

async function fetchClient(supabase: SupabaseClient, clientId: string): Promise<ClientContextRow | null> {
  const { data } = await supabase.from('clients').select('name, company, plan, health_score').eq('id', clientId).single()
  return data as ClientContextRow | null
}

function computeConversions(projects: Array<{ cpa: number | null; spend: number | null }>): number {
  return projects.reduce((sum, p) => {
    if (!p.cpa || p.cpa <= 0 || !p.spend) return sum
    return sum + p.spend / p.cpa
  }, 0)
}

async function buildClientContext(supabase: SupabaseClient, client: ClientContextRow | null, clientId: string): Promise<string> {
  const [{ data: projects }, { data: tasks }, { data: snapshots }, { data: meetings }, { data: goals }, { data: comments }] =
    await Promise.all([
      supabase.from('projects').select('title, status, cpa, roas, ctr, spend, revenue, channel').eq('client_id', clientId),
      supabase.from('tasks').select('title, status, due_date, priority').eq('client_id', clientId),
      supabase
        .from('performance_snapshots')
        .select('spend, revenue, roas, ctr')
        .eq('client_id', clientId)
        .gte('snapshot_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)),
      supabase.from('meetings').select('title, date, status, cancellation_reason').eq('client_id', clientId).order('date', { ascending: false }).limit(10),
      supabase
        .from('smart_goals')
        .select('title, metric_type, target_value, current_value, target_date, status')
        .eq('client_id', clientId)
        .limit(10),
      supabase
        .from('comments')
        .select('title, content, author_role, created_at')
        .eq('client_id', clientId)
        .eq('entity_type', 'general')
        .order('created_at', { ascending: false })
        .limit(10),
    ])

  const lines: string[] = []

  lines.push(`Cliente: ${client?.name ?? 'desconhecido'}${client?.company ? ` (${client.company})` : ''}`)
  lines.push(`Plano: ${client?.plan ?? 'não informado'} · Health score: ${client?.health_score ?? 'não informado'}`)

  const projectList = projects ?? []
  if (projectList.length > 0) {
    lines.push('\nProjetos:')
    for (const p of projectList) {
      const projectConversions = p.cpa && p.cpa > 0 && p.spend ? Math.round(p.spend / p.cpa) : null
      lines.push(
        `- "${p.title}" (${p.status}, canal: ${p.channel ?? 'não informado'}) — CPA: ${p.cpa ?? '—'}, ROAS: ${p.roas ?? '—'}, CTR: ${p.ctr ?? '—'}, gasto: ${p.spend ?? '—'}, receita: ${p.revenue ?? '—'}, conversões estimadas: ${projectConversions ?? '—'}`,
      )
    }
    const totalConversions = Math.round(computeConversions(projectList))
    lines.push(`Conversões estimadas (total, somando todos os projetos, gasto ÷ CPA): ${totalConversions}`)
  } else {
    lines.push('\nSem projetos cadastrados.')
  }

  const today = new Date().toISOString().slice(0, 10)
  const allTasks = tasks ?? []
  const doneTasks = allTasks.filter((t) => t.status === 'done')
  const overdueTasks = allTasks.filter((t) => t.status !== 'done' && t.due_date && t.due_date < today)
  const openTasks = allTasks.filter((t) => t.status !== 'done' && (!t.due_date || t.due_date >= today))
  lines.push(`\nTarefas: ${doneTasks.length} concluídas, ${openTasks.length} em aberto, ${overdueTasks.length} atrasadas.`)
  if (overdueTasks.length > 0) {
    lines.push('Atrasadas: ' + overdueTasks.map((t) => `"${t.title}"`).join(', '))
  }

  const meetingList = meetings ?? []
  if (meetingList.length > 0) {
    lines.push('\nReuniões:')
    for (const m of meetingList) {
      lines.push(
        `- "${m.title}" em ${m.date ?? 'data não definida'} (${m.status})${m.cancellation_reason ? ` — cancelada: ${m.cancellation_reason}` : ''}`,
      )
    }
  } else {
    lines.push('\nSem reuniões registradas.')
  }

  const goalList = goals ?? []
  if (goalList.length > 0) {
    lines.push('\nMetas SMART:')
    for (const g of goalList) {
      lines.push(
        `- "${g.title}" (${g.metric_type ?? 'métrica não definida'}): ${g.current_value ?? 0} de ${g.target_value ?? '—'} — status: ${g.status}${g.target_date ? `, prazo: ${g.target_date}` : ''}`,
      )
    }
  } else {
    lines.push('\nSem metas SMART cadastradas.')
  }

  const commentList = comments ?? []
  if (commentList.length > 0) {
    lines.push('\nComentários recentes:')
    for (const c of commentList) {
      lines.push(`- (${c.author_role ?? '—'}) ${c.title ? `"${c.title}": ` : ''}${c.content}`)
    }
  } else {
    lines.push('\nSem comentários registrados.')
  }

  const snapshotList = snapshots ?? []
  if (snapshotList.length > 0) {
    const totalSpend = snapshotList.reduce((sum, s) => sum + (s.spend ?? 0), 0)
    const totalRevenue = snapshotList.reduce((sum, s) => sum + (s.revenue ?? 0), 0)
    const withRoas = snapshotList.filter((s) => s.roas != null)
    const avgRoas = withRoas.length > 0 ? withRoas.reduce((sum, s) => sum + (s.roas ?? 0), 0) / withRoas.length : null
    const withCtr = snapshotList.filter((s) => s.ctr != null)
    const avgCtr = withCtr.length > 0 ? withCtr.reduce((sum, s) => sum + (s.ctr ?? 0), 0) / withCtr.length : null
    lines.push(
      `\nÚltimos 30 dias: gasto total ${totalSpend.toFixed(2)}, receita total ${totalRevenue.toFixed(2)}, ROAS médio ${avgRoas?.toFixed(2) ?? '—'}, CTR médio ${avgCtr?.toFixed(2) ?? '—'}.`,
    )
  } else {
    lines.push('\nSem dados de desempenho sincronizados nos últimos 30 dias.')
  }

  return lines.join('\n')
}

function extractReplyText(data: { output?: Array<{ type: string; role?: string; content?: Array<{ type: string; text?: string }> }> }): string {
  const messages = (data.output ?? []).filter((item) => item.type === 'message' && item.role === 'assistant')
  const parts: string[] = []
  for (const message of messages) {
    for (const block of message.content ?? []) {
      if (block.type === 'output_text' && block.text) parts.push(block.text)
    }
  }
  return parts.join('\n').trim()
}

async function handleChat(req: Request) {
  const auth = await requireCassieCaller(req)
  if (auth instanceof Response) return auth
  const limited = await enforceRateLimit(auth.userId, [
    { bucket: 'cassie_chat_burst', windowSeconds: 300, maxHits: 20 },
    { bucket: 'cassie_chat_daily', windowSeconds: 86400, maxHits: 150 },
  ])
  if (limited) return limited

  let body: { client_id?: string; message?: string; mode?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Corpo inválido' }, 400)
  }
  const message = body.message?.trim()
  if (!message) return jsonResponse({ error: 'message é obrigatório' }, 400)
  if (!body.mode || !CASSIE_MODES.includes(body.mode as CassieMode)) {
    return jsonResponse({ error: 'mode inválido. Use um de: ' + CASSIE_MODES.join(', ') }, 400)
  }
  const mode = body.mode as CassieMode

  const supabase = getServiceClient()

  let targetClientId: string
  if (auth.role === 'cliente') {
    if (!auth.ownClientId) return jsonResponse({ error: 'Perfil sem cliente vinculado' }, 403)
    targetClientId = auth.ownClientId
  } else {
    if (!body.client_id) return jsonResponse({ error: 'client_id é obrigatório' }, 400)
    const { data: clientExists } = await supabase.from('clients').select('id').eq('id', body.client_id).maybeSingle()
    if (!clientExists) return jsonResponse({ error: 'Cliente não encontrado' }, 404)
    targetClientId = body.client_id
  }

  const client = await fetchClient(supabase, targetClientId)
  const modesForCaller = allowedModes(auth.role, client?.plan ?? null)
  if (!modesForCaller.includes(mode)) {
    return jsonResponse({ error: 'Esse modo não está liberado no plano atual.' }, 403)
  }

  const openaiKey = Deno.env.get('Openai_api_key')
  if (!openaiKey) {
    return jsonResponse({ error: 'A chave da OpenAI ainda não foi configurada nesta função (falta o segredo Openai_api_key).' }, 400)
  }

  const [contextText, { data: history, error: historyError }] = await Promise.all([
    buildClientContext(supabase, client, targetClientId),
    supabase
      .from('cassie_messages')
      .select('role, content')
      .eq('conversation_owner_id', auth.userId)
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT),
  ])
  if (historyError) return dbErrorResponse('handleChat: buscar histórico', historyError)

  const orderedHistory = [...(history ?? [])].reverse()

  const { error: insertUserError } = await supabase
    .from('cassie_messages')
    .insert({ client_id: targetClientId, conversation_owner_id: auth.userId, role: 'user', content: message, mode })
  if (insertUserError) return dbErrorResponse('handleChat: inserir mensagem do usuário', insertUserError)

  const openaiRes = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      instructions: `${SYSTEM_PROMPT_BASE}\n\n${MODE_INSTRUCTIONS[mode]}\n\n--- Dados do cliente ---\n${contextText}`,
      input: [...orderedHistory.map((m) => ({ role: m.role, content: m.content })), { role: 'user', content: message }],
    }),
  })
  const openaiBody = await openaiRes.json()
  if (!openaiRes.ok) {
    return openaiErrorResponse('handleChat', openaiBody)
  }

  const replyText = extractReplyText(openaiBody)
  if (!replyText) return jsonResponse({ error: 'A Cassie não conseguiu gerar uma resposta.' }, 502)

  const { error: insertReplyError } = await supabase
    .from('cassie_messages')
    .insert({ client_id: targetClientId, conversation_owner_id: auth.userId, role: 'assistant', content: replyText, mode })
  if (insertReplyError) return dbErrorResponse('handleChat: inserir resposta da Cassie', insertReplyError)

  return jsonResponse({ reply: replyText })
}

const OPEN_QUESTION_TYPES = ['text_short', 'text_paragraph']
const PERSUASIVE_COPY_ANSWER_LIMIT = 50 // limita o tamanho/custo do prompt

interface OpenAnswerRow {
  title: string
  answerText: string
}

/** Respostas de texto livre dos Google Forms conectados de um cliente
 * (Fase 8.4, "Comunicação Persuasiva") — mesma lógica de junção do
 * hook `useOpenTextAnswers` do front-end, só que rodando aqui pra
 * montar o prompt sem confiar em texto de resposta mandado pelo
 * cliente da API. */
async function fetchOpenTextAnswers(supabase: SupabaseClient, clientId: string, connectionIds: string[]): Promise<OpenAnswerRow[]> {
  const { data: questions } = await supabase
    .from('form_questions')
    .select('external_question_id, connection_id, title')
    .in('connection_id', connectionIds)
    .in('question_type', OPEN_QUESTION_TYPES)
  if (!questions || questions.length === 0) return []

  const titleByKey = new Map((questions as Array<{ connection_id: string; external_question_id: string; title: string }>).map((q) => [
    `${q.connection_id}|${q.external_question_id}`,
    q.title,
  ]))

  const { data: responses } = await supabase
    .from('form_responses')
    .select('connection_id, submitted_at, form_answers(external_question_id, answer_text)')
    .eq('client_id', clientId)
    .in('connection_id', connectionIds)
    .order('submitted_at', { ascending: false })
    .limit(PERSUASIVE_COPY_ANSWER_LIMIT)

  const rows: OpenAnswerRow[] = []
  for (const response of (responses ?? []) as Array<{
    connection_id: string
    form_answers: Array<{ external_question_id: string; answer_text: string | null }>
  }>) {
    for (const answer of response.form_answers) {
      const title = titleByKey.get(`${response.connection_id}|${answer.external_question_id}`)
      if (!title || !answer.answer_text?.trim()) continue
      rows.push({ title, answerText: answer.answer_text })
    }
  }
  return rows
}

const PERSUASIVE_COPY_SYSTEM_PROMPT_BASE = `Você é a Cassie, a assistente de IA da Ametista Conversões, uma agência de marketing de performance.
Sua tarefa é ajudar o gestor a escrever anúncios melhores usando a linguagem real do público dele, numa conversa com ida e volta.
Você recebe respostas abertas reais de um formulário de captação de leads (cada uma junto da pergunta que a originou) como contexto abaixo.
No primeiro pedido, com base SÓ nessas respostas (não invente informação que não esteja lá), sugira:
1. 5 headlines curtos (até 60 caracteres cada) pra anúncio, numerados de 1 a 5
2. 3 textos persuasivos mais longos (2 a 3 frases cada), numerados de 1 a 3
Use palavras, expressões e dores que o próprio público usou nas respostas sempre que possível.
Se o gestor pedir um ajuste pontual (ex: "deixe a headline 3 mais direta"), aplique o ajuste e responda com a LISTA INTEIRA atualizada (headlines + textos), não só o item que mudou — pra sempre ficar claro qual é a versão mais recente, pronta pra copiar.
Responda só com as duas listas, em português do Brasil, sem introdução nem comentário extra. Formato exato:
HEADLINES:
1. ...
2. ...
3. ...
4. ...
5. ...

TEXTOS:
1. ...
2. ...
3. ...`

const PERSUASIVE_COPY_HISTORY_LIMIT = 20

/** Rota conversacional (Fase 8.4b) — cada chamada é uma mensagem numa
 * conversa persistida em `persuasive_copy_messages`, escopada por
 * quem pediu + cliente + formulário (mesmo padrão de `handleChat`
 * com `cassie_messages`, só que sem o campo `mode`). O botão "Gerar
 * sugestões com IA" do front-end manda uma mensagem fixa por essa
 * mesma rota — não existe caminho especial pro primeiro pedido. */
async function handlePersuasiveCopy(req: Request) {
  const auth = await requireCassieCaller(req)
  if (auth instanceof Response) return auth
  if (auth.role !== 'admin' && auth.role !== 'gestor') {
    return jsonResponse({ error: 'Só admin/gestor pode gerar sugestões de comunicação persuasiva.' }, 403)
  }
  const limited = await enforceRateLimit(auth.userId, [
    { bucket: 'cassie_copy_burst', windowSeconds: 300, maxHits: 15 },
    { bucket: 'cassie_copy_daily', windowSeconds: 86400, maxHits: 100 },
  ])
  if (limited) return limited

  let body: { client_id?: string; connection_id?: string; message?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Corpo inválido' }, 400)
  }
  if (!body.client_id) return jsonResponse({ error: 'client_id é obrigatório' }, 400)
  const message = body.message?.trim()
  if (!message) return jsonResponse({ error: 'message é obrigatório' }, 400)

  const supabase = getServiceClient()

  const { data: clientExists } = await supabase.from('clients').select('id').eq('id', body.client_id).maybeSingle()
  if (!clientExists) return jsonResponse({ error: 'Cliente não encontrado' }, 404)

  let connectionIds: string[]
  if (body.connection_id) {
    connectionIds = [body.connection_id]
  } else {
    const { data: assets } = await supabase.from('digital_assets').select('id').eq('client_id', body.client_id)
    const assetIds = ((assets ?? []) as Array<{ id: string }>).map((a) => a.id)
    if (assetIds.length === 0) return jsonResponse({ error: 'Esse cliente não tem nenhum ativo digital cadastrado.' }, 400)

    const { data: connections } = await supabase
      .from('digital_asset_connections')
      .select('id')
      .eq('provider', 'google_forms')
      .in('digital_asset_id', assetIds)
    connectionIds = ((connections ?? []) as Array<{ id: string }>).map((c) => c.id)
  }
  if (connectionIds.length === 0) {
    return jsonResponse({ error: 'Esse cliente não tem nenhum Google Forms conectado.' }, 400)
  }

  const answers = await fetchOpenTextAnswers(supabase, body.client_id, connectionIds)
  if (answers.length === 0) {
    return jsonResponse(
      { error: 'Nenhuma resposta aberta sincronizada ainda pra esse cliente. Sincronize um Google Forms em "Integrações" primeiro.' },
      400,
    )
  }

  const openaiKey = Deno.env.get('Openai_api_key')
  if (!openaiKey) {
    return jsonResponse({ error: 'A chave da OpenAI ainda não foi configurada nesta função (falta o segredo Openai_api_key).' }, 400)
  }

  let historyQuery = supabase
    .from('persuasive_copy_messages')
    .select('role, content')
    .eq('conversation_owner_id', auth.userId)
    .eq('client_id', body.client_id)
    .order('created_at', { ascending: false })
    .limit(PERSUASIVE_COPY_HISTORY_LIMIT)
  historyQuery = body.connection_id ? historyQuery.eq('connection_id', body.connection_id) : historyQuery.is('connection_id', null)
  const { data: history, error: historyError } = await historyQuery
  if (historyError) return dbErrorResponse('handlePersuasiveCopy: buscar histórico', historyError)
  const orderedHistory = [...(history ?? [])].reverse()

  const { error: insertUserError } = await supabase.from('persuasive_copy_messages').insert({
    client_id: body.client_id,
    connection_id: body.connection_id ?? null,
    conversation_owner_id: auth.userId,
    role: 'user',
    content: message,
  })
  if (insertUserError) return dbErrorResponse('handlePersuasiveCopy: inserir mensagem do usuário', insertUserError)

  const answersText = answers.map((a) => `Pergunta: "${a.title}"\nResposta: ${a.answerText}`).join('\n\n')

  const openaiRes = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      instructions: `${PERSUASIVE_COPY_SYSTEM_PROMPT_BASE}\n\n--- Respostas abertas do público ---\n${answersText}`,
      input: [...orderedHistory.map((m) => ({ role: m.role, content: m.content })), { role: 'user', content: message }],
    }),
  })
  const openaiBody = await openaiRes.json()
  if (!openaiRes.ok) {
    return openaiErrorResponse('handlePersuasiveCopy', openaiBody)
  }

  const replyText = extractReplyText(openaiBody)
  if (!replyText) return jsonResponse({ error: 'A IA não conseguiu gerar sugestões.' }, 502)

  const { error: insertReplyError } = await supabase.from('persuasive_copy_messages').insert({
    client_id: body.client_id,
    connection_id: body.connection_id ?? null,
    conversation_owner_id: auth.userId,
    role: 'assistant',
    content: replyText,
  })
  if (insertReplyError) return dbErrorResponse('handlePersuasiveCopy: inserir resposta da IA', insertReplyError)

  return jsonResponse({ reply: replyText })
}

async function routeRequest(req: Request, url: URL): Promise<Response> {
  try {
    if (req.method === 'POST' && url.pathname.endsWith('/chat')) return await handleChat(req)
    if (req.method === 'POST' && url.pathname.endsWith('/persuasive-copy')) return await handlePersuasiveCopy(req)
    return jsonResponse({ error: 'Rota não encontrada. Use /chat ou /persuasive-copy.' }, 404)
  } catch (err) {
    console.error('[cassie] erro inesperado:', err)
    await logServerError('cassie', 'erro inesperado', err)
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
