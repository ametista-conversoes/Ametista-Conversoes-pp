import { expect, test } from '@playwright/test'
import { getAuthenticatedClient, loginAs } from './fixtures.js'

const RUN_ID = Date.now()
const VALIDACAO_CLIENT = `Teste Plataforma Validacao ${RUN_ID}`
const ESCALA_CLIENT = `Teste Plataforma Escala ${RUN_ID}`
const EXCLUSIVE_ITEM_TITLE = `Item exclusivo Meta ${RUN_ID}`

let validacaoClientId: string
let escalaClientId: string

test.beforeAll(async () => {
  const admin = await getAuthenticatedClient('admin')
  const { data: c1, error: e1 } = await admin
    .from('clients')
    .insert({ name: VALIDACAO_CLIENT, plan: 'validacao', chosen_platform: 'meta' })
    .select('id')
    .single()
  if (e1) throw e1
  validacaoClientId = c1.id

  const { error: e2 } = await admin.from('activity_checklist_items').insert({
    client_id: validacaoClientId,
    title: EXCLUSIVE_ITEM_TITLE,
    completed: true,
    completed_at: new Date().toISOString(),
    platform_scope: ['meta'],
  })
  if (e2) throw e2

  const { data: c2, error: e3 } = await admin
    .from('clients')
    .insert({ name: ESCALA_CLIENT, plan: 'escala' })
    .select('id')
    .single()
  if (e3) throw e3
  escalaClientId = c2.id
})

test.afterAll(async () => {
  const admin = await getAuthenticatedClient('admin')
  if (validacaoClientId) await admin.from('clients').delete().eq('id', validacaoClientId)
  if (escalaClientId) await admin.from('clients').delete().eq('id', escalaClientId)
})

test('item 9 -- trocar plataforma com item concluído exclusivo pede confirmação; Escala não mostra o card', async ({ page }) => {
  await loginAs(page, 'gestor')
  await page.goto('/clients')
  await page.getByText(VALIDACAO_CLIENT, { exact: true }).click()

  await expect(page.getByText('Plataforma Escolhida', { exact: true })).toBeVisible()
  await page.getByRole('combobox').filter({ hasText: 'Meta Ads' }).click()
  await page.getByRole('option', { name: 'Google Ads', exact: true }).click()

  const dialog = page.getByRole('dialog', { name: 'Trocar de plataforma?' })
  await expect(dialog.getByText(/já tem 1 tarefa concluída de Meta Ads/)).toBeVisible()
  await dialog.getByRole('button', { name: 'Trocar mesmo assim' }).click()
  await expect(dialog).not.toBeVisible()

  const admin = await getAuthenticatedClient('admin')
  const { data: updated } = await admin.from('clients').select('chosen_platform').eq('id', validacaoClientId).single()
  expect(updated?.chosen_platform).toBe('google')

  await page.goto('/clients')
  await page.getByText(ESCALA_CLIENT, { exact: true }).click()
  await expect(page.getByText('Plataforma Escolhida', { exact: true })).not.toBeVisible()
})
