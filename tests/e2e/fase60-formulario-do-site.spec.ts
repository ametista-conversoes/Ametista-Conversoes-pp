import { expect, test } from '@playwright/test'
import { getAuthenticatedClient, loginAs } from './fixtures.js'

// Fase 60 — formulário do site (Elementor) virando lead. Ponta a ponta contra
// a Edge Function de verdade, no cliente da conta de teste. O ativo criado é
// apagado no fim (a conexão e os leads vão junto, em cascata).
test.describe.configure({ mode: 'serial' })

const FUNCTION_URL = `${process.env.VITE_SUPABASE_URL}/functions/v1/integrations/site-form-webhook`
let clientId = ''
let assetId = ''
let key = ''

test.beforeAll(async () => {
  const cliente = await getAuthenticatedClient('cliente')
  const { data: userData } = await cliente.auth.getUser()
  const { data: profile } = await cliente.from('profiles').select('client_id').eq('id', userData.user!.id).single()
  clientId = profile!.client_id

  const gestor = await getAuthenticatedClient('gestor')
  const { data: asset, error } = await gestor
    .from('digital_assets')
    .insert({ name: 'E2E formulário do site', type: 'site_form', client_id: clientId, status: 'active' })
    .select('id')
    .single()
  expect(error).toBeNull()
  assetId = asset!.id
  const { data: connection } = await gestor
    .from('digital_asset_connections')
    .select('webhook_key')
    .eq('digital_asset_id', assetId)
    .eq('provider', 'site_form')
    .single()
  key = connection!.webhook_key
})

test.afterAll(async () => {
  const gestor = await getAuthenticatedClient('gestor')
  if (assetId) await gestor.from('digital_assets').delete().eq('id', assetId)
})

function post(body: string, contentType: string, query = '') {
  return fetch(`${FUNCTION_URL}?k=${encodeURIComponent(key)}${query}`, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body,
  })
}

test('ativo novo já nasce com chave; chave errada = 401; cliente não lê a chave', async () => {
  expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/)
  const bad = await fetch(`${FUNCTION_URL}?k=chave-errada`, { method: 'POST', body: 'Nome=x' })
  expect(bad.status).toBe(401)

  const cliente = await getAuthenticatedClient('cliente')
  const { data } = await cliente.from('digital_asset_connections').select('webhook_key').eq('digital_asset_id', assetId)
  expect(data ?? []).toHaveLength(0)
})

test('teste (&test=1) só interpreta, não cria lead', async () => {
  const res = await post('Nome=Teste&utm_source=x', 'application/x-www-form-urlencoded', '&test=1')
  expect(res.status).toBe(200)
  expect(await res.json()).toMatchObject({ ok: true, test: true, tracking: { utm_source: 'x' } })
  const gestor = await getAuthenticatedClient('gestor')
  const { count } = await gestor.from('form_responses').select('id', { count: 'exact', head: true }).eq('client_id', clientId).eq('source', 'site_form')
  expect(count).toBe(0)
})

test('Elementor "Dados avançados" vira lead Novo com UTM; reenvio em 2 min não duplica', async () => {
  const body = new URLSearchParams({
    'fields[name][title]': 'Nome',
    'fields[name][value]': 'Lead E2E',
    'fields[whatsapp][title]': 'WhatsApp',
    'fields[whatsapp][value]': '(11) 97777-0001',
    'fields[utm_source][value]': 'teste',
    'fields[utm_campaign][value]': 'Campanha E2E',
    'fields[utm_content][value]': '#001 | VID | Teste | v1',
    'meta[page_url][value]': 'https://exemplo.com.br/lp',
  }).toString()
  expect((await post(body, 'application/x-www-form-urlencoded')).status).toBe(200)
  const again = await post(body, 'application/x-www-form-urlencoded')
  expect(await again.json()).toMatchObject({ ok: true, duplicate: true })

  const gestor = await getAuthenticatedClient('gestor')
  const { data: leads } = await gestor
    .from('form_responses')
    .select('status, source, utm_source, utm_campaign, utm_content, page_url, form_answers(external_question_id, answer_text)')
    .eq('client_id', clientId)
    .eq('source', 'site_form')
  expect(leads).toHaveLength(1)
  expect(leads![0]).toMatchObject({
    status: 'novo',
    utm_source: 'teste',
    utm_campaign: 'Campanha E2E',
    utm_content: '#001 | VID | Teste | v1',
    page_url: 'https://exemplo.com.br/lp',
  })
  expect(leads![0].form_answers).toEqual(
    expect.arrayContaining([
      { external_question_id: 'name', answer_text: 'Lead E2E' },
      { external_question_id: 'whatsapp', answer_text: '(11) 97777-0001' },
    ]),
  )
})

test('modo simples e JSON também viram lead', async () => {
  expect((await post('Nome=Simples&E-mail=simples%40exemplo.com', 'application/x-www-form-urlencoded')).status).toBe(200)
  expect((await post(JSON.stringify({ Nome: 'Json', Telefone: '11966660002' }), 'application/json')).status).toBe(200)
  const gestor = await getAuthenticatedClient('gestor')
  const { count } = await gestor.from('form_responses').select('id', { count: 'exact', head: true }).eq('client_id', clientId).eq('source', 'site_form')
  expect(count).toBe(3)
})

test('gestor vê a URL no card do ativo e o teste responde', async ({ page }) => {
  await loginAs(page, 'gestor')
  await page.goto('/assets')
  const card = page.locator('div.rounded-xl', { has: page.getByText('E2E formulário do site', { exact: true }) })
  await expect(card).toContainText(`site-form-webhook?k=${key}`)
  await expect(card).toContainText('Último lead recebido em')
  await card.getByRole('button', { name: 'Enviar lead de teste' }).click()
  await expect(page.getByText(/URL funcionando: 2 campo\(s\) lido\(s\)/)).toBeVisible()
})

test('cliente vê o lead do site na aba Leads, com origem e anúncio', async ({ page }) => {
  await loginAs(page, 'cliente')
  await page.goto('/leads')
  const card = page.locator('div.rounded-xl', { hasText: 'Lead E2E' })
  await expect(card).toContainText('Formulário do site')
  await expect(card).toContainText('#001 | VID | Teste | v1')
  await expect(card).toContainText('Novo')
})
