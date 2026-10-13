import { expect, test } from '@playwright/test'
import { getAuthenticatedClient, loginAs } from './fixtures.js'

const RUN_ID = Date.now()
const CLIENT_NAME = `Teste Fase50a Demo ${RUN_ID}`

let clientId: string

test.beforeAll(async () => {
  const supabase = await getAuthenticatedClient('admin')
  const { data: client, error } = await supabase
    .from('clients')
    .insert({ name: CLIENT_NAME, is_demo: true, status: 'active' })
    .select('id')
    .single()
  if (error) throw error
  clientId = client.id
})

test.afterAll(async () => {
  const supabase = await getAuthenticatedClient('admin')
  if (clientId) await supabase.from('clients').delete().eq('id', clientId)
})

test('selo "Demonstração" aparece no card e na ficha de um cliente is_demo', async ({ page }) => {
  await loginAs(page, 'gestor')
  await page.goto('/clients')

  const card = page.locator('.cursor-pointer', { hasText: CLIENT_NAME })
  await expect(card.getByText('Demonstração')).toBeVisible()

  await card.click()
  await expect(page).toHaveURL(`/clients/${clientId}`)
  await expect(page.getByText('Demonstração').first()).toBeVisible()
})
