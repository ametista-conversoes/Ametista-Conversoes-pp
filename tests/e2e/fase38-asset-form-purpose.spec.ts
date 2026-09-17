import { expect, test } from '@playwright/test'
import { getAuthenticatedClient, loginAs } from './fixtures.js'

const RUN_ID = Date.now()
const CLIENT_NAME = `Teste Fase38 ${RUN_ID}`
const ASSET_NAME = `Formulario Teste ${RUN_ID}`

let clientId: string

test.beforeAll(async () => {
  const supabase = await getAuthenticatedClient('admin')
  const { data: client, error } = await supabase.from('clients').insert({ name: CLIENT_NAME }).select('id').single()
  if (error) throw error
  clientId = client.id
})

test.afterAll(async () => {
  const supabase = await getAuthenticatedClient('admin')
  if (clientId) await supabase.from('clients').delete().eq('id', clientId)
})

test('Tipo "Formulario (Google Forms)" revela o campo Proposito, salva e persiste', async ({ page }) => {
  await loginAs(page, 'gestor')
  await page.goto('/assets')

  await page.getByRole('button', { name: 'Novo ativo' }).click()
  await page.getByLabel('Nome').fill(ASSET_NAME)

  await page.getByLabel('Cliente').click()
  await page.getByRole('option', { name: CLIENT_NAME, exact: true }).click()

  // Antes de escolher o Tipo, o campo Proposito nao deve existir.
  await expect(page.getByText('Propósito deste formulário')).not.toBeVisible()

  await page.getByLabel('Tipo (opcional)').click()
  await page.getByRole('option', { name: 'Formulário (Google Forms)' }).click()

  await expect(page.getByText('Propósito deste formulário')).toBeVisible()

  await page.getByLabel('Propósito deste formulário').click()
  await page.getByRole('option', { name: /Formulário de Vendas/ }).click()

  await page.getByRole('button', { name: 'Criar ativo' }).click()
  await expect(page.getByText('Ativo criado.')).toBeVisible()

  // Confirma no banco que o form_purpose foi salvo como 'vendas'.
  const supabase = await getAuthenticatedClient('admin')
  const { data: created, error } = await supabase
    .from('digital_assets')
    .select('id, form_purpose, type')
    .eq('name', ASSET_NAME)
    .single()
  if (error) throw error
  expect(created.type).toBe('google_forms')
  expect(created.form_purpose).toBe('vendas')

  // Reabrir pra editar -> confirma que persistiu selecionado na UI.
  await page.getByText(ASSET_NAME).locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]').getByLabel(`Editar ${ASSET_NAME}`).click()
  await expect(page.getByText('Formulário de Vendas', { exact: false }).first()).toBeVisible()
})

test('trocar o Tipo de volta pra outro limpa o proposito (form_purpose vira null)', async ({ page }) => {
  const supabase = await getAuthenticatedClient('admin')
  const { data: asset, error } = await supabase
    .from('digital_assets')
    .insert({ name: `${ASSET_NAME} B`, client_id: clientId, type: 'google_forms', form_purpose: 'perdido', status: 'active' })
    .select('id')
    .single()
  if (error) throw error

  await loginAs(page, 'gestor')
  await page.goto('/assets')

  await page.getByText(`${ASSET_NAME} B`).locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]').getByLabel(`Editar ${ASSET_NAME} B`).click()
  await expect(page.getByText('Propósito deste formulário')).toBeVisible()

  await page.getByLabel('Tipo (opcional)').click()
  await page.getByRole('option', { name: 'Pixel' }).click()
  await expect(page.getByText('Propósito deste formulário')).not.toBeVisible()

  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.getByText('Ativo atualizado.')).toBeVisible()

  const { data: updated, error: updatedError } = await supabase
    .from('digital_assets')
    .select('form_purpose, type')
    .eq('id', asset.id)
    .single()
  if (updatedError) throw updatedError
  expect(updated.type).toBe('pixel')
  expect(updated.form_purpose).toBeNull()

  await supabase.from('digital_assets').delete().eq('id', asset.id)
})
