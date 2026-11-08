import { expect, test } from '@playwright/test'
import { getAuthenticatedClient, loginAs } from './fixtures.js'

// Fase 63 — aba Leads para volume: marcar o status é opcional, um mês por vez,
// paginação e marcação de vários leads de uma vez. Leads criados pelo webhook
// do formulário do site num ativo temporário do cliente de teste (apagado no
// fim, os leads vão junto em cascata).
test.describe.configure({ mode: 'serial' })

const FUNCTION_URL = `${process.env.VITE_SUPABASE_URL}/functions/v1/integrations/site-form-webhook`
let clientId = ''
let assetId = ''

test.beforeAll(async () => {
  const cliente = await getAuthenticatedClient('cliente')
  const { data: userData } = await cliente.auth.getUser()
  const { data: profile } = await cliente.from('profiles').select('client_id').eq('id', userData.user!.id).single()
  clientId = profile!.client_id

  const gestor = await getAuthenticatedClient('gestor')
  const { data: asset } = await gestor
    .from('digital_assets')
    .insert({ name: 'E2E leads em massa', type: 'site_form', client_id: clientId, status: 'active' })
    .select('id')
    .single()
  assetId = asset!.id
  const { data: connection } = await gestor
    .from('digital_asset_connections')
    .select('webhook_key')
    .eq('digital_asset_id', assetId)
    .single()
  for (const n of [1, 2, 3]) {
    const body = new URLSearchParams({ Nome: `Massa E2E ${n}`, WhatsApp: `1196666000${n}` }).toString()
    const res = await fetch(`${FUNCTION_URL}?k=${encodeURIComponent(connection!.webhook_key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    expect(res.status).toBe(200)
  }
})

test.afterAll(async () => {
  const gestor = await getAuthenticatedClient('gestor')
  if (assetId) await gestor.from('digital_assets').delete().eq('id', assetId)
})

test('cliente marca vários leads de uma vez como Qualificado', async ({ page }) => {
  await loginAs(page, 'cliente')
  await page.goto('/leads')
  await expect(page.getByText('Marcar o status de cada lead é opcional.')).toBeVisible()
  await page.getByRole('button', { name: 'Formulário do site' }).click()

  for (const n of [1, 2, 3]) {
    const card = page.locator('div.rounded-xl', { hasText: `Massa E2E ${n}` })
    await card.getByRole('checkbox', { name: 'Selecionar lead' }).check()
  }
  await expect(page.getByText('3 selecionado(s)')).toBeVisible()
  await page.getByRole('toolbar', { name: 'Marcar leads selecionados' }).getByRole('button', { name: 'Qualificado', exact: true }).click()
  await expect(page.getByText('3 lead(s) atualizado(s).')).toBeVisible()

  const gestor = await getAuthenticatedClient('gestor')
  const { data } = await gestor
    .from('form_responses')
    .select('status, form_answers!inner(answer_text)')
    .eq('client_id', clientId)
    .eq('source', 'site_form')
    .like('form_answers.answer_text', 'Massa E2E%')
  expect(data).toHaveLength(3)
  expect(data!.every((r) => r.status === 'qualificado')).toBe(true)
})

test('RLS: cliente não marca em massa lead de outro cliente', async () => {
  const admin = await getAuthenticatedClient('admin')
  const { data: other } = await admin.from('form_responses').select('id').neq('client_id', clientId).limit(1)
  test.skip(!other || other.length === 0, 'Nenhum lead de outro cliente para testar')
  const cliente = await getAuthenticatedClient('cliente')
  const { error } = await cliente.rpc('set_form_responses_status', { p_response_ids: [other![0].id], p_status: 'venda' })
  expect(error).not.toBeNull()
})
