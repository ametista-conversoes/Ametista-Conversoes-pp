import { expect, test } from '@playwright/test'
import { getAuthenticatedClient, loginAs } from './fixtures.js'

const RUN_ID = Date.now()
const LEAD_NAME = `Lead Manual Teste ${RUN_ID}`

let realClientId: string

test.beforeAll(async () => {
  const clientAuth = await getAuthenticatedClient('cliente')
  const { data: userData, error: userError } = await clientAuth.auth.getUser()
  if (userError || !userData.user) throw userError ?? new Error('Conta de cliente de teste sem sessão')
  const { data: profile, error: profileError } = await clientAuth
    .from('profiles')
    .select('client_id')
    .eq('id', userData.user.id)
    .single()
  if (profileError || !profile?.client_id) throw profileError ?? new Error('Conta de cliente de teste sem client_id')
  realClientId = profile.client_id
})

test.afterAll(async () => {
  const admin = await getAuthenticatedClient('admin')
  await admin.from('manual_leads').delete().eq('name', LEAD_NAME)
})

test('item 37 Bloco 3 -- registrar lead manual no Portal Cliente, sem achar nada na busca, e trocar status', async ({ page }) => {
  await loginAs(page, 'cliente')
  await page.goto('/leads')

  await page.getByRole('button', { name: 'Registrar lead manual' }).click()
  const dialog = page.getByRole('dialog')

  await dialog.getByPlaceholder('Digite pra buscar...').fill('termo-que-nao-deve-existir-em-nenhuma-resposta')
  await expect(dialog.getByText('Nenhuma resposta de formulário encontrada com esse termo.')).toBeVisible()

  await dialog.getByPlaceholder('Nome').fill(LEAD_NAME)
  await dialog.getByRole('button', { name: 'Registrar como lead qualificado' }).click()

  const row = dialog.locator('div.rounded-lg', { hasText: LEAD_NAME })
  await expect(row.getByText('Qualificado', { exact: true })).toBeVisible()

  // Confirma direto no banco: nasce "qualificado", client_id certo.
  const admin = await getAuthenticatedClient('admin')
  const { data: leadRow } = await admin.from('manual_leads').select('status, client_id').eq('name', LEAD_NAME).single()
  expect(leadRow?.status).toBe('qualificado')
  expect(leadRow?.client_id).toBe(realClientId)

  // Troca o status pelo badge -- confirma que persiste.
  await row.getByText('Qualificado', { exact: true }).click()
  await page.getByRole('menuitem', { name: 'Venda' }).click()
  await expect(row.getByText('Venda', { exact: true })).toBeVisible()

  const { data: updated } = await admin.from('manual_leads').select('status').eq('name', LEAD_NAME).single()
  expect(updated?.status).toBe('venda')
})
