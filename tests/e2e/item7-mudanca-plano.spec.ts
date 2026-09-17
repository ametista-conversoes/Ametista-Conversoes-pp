import { expect, test } from '@playwright/test'
import { getAuthenticatedClient, loginAs } from './fixtures.js'

const RUN_ID = Date.now()
const CLIENT_NAME = `Teste Item7 ${RUN_ID}`

let clientId: string

test.beforeAll(async () => {
  const supabase = await getAuthenticatedClient('admin')
  const { data, error } = await supabase
    .from('clients')
    .insert({ name: CLIENT_NAME, plan: 'validacao' })
    .select('id')
    .single()
  if (error) throw error
  clientId = data.id
})

test.afterAll(async () => {
  const supabase = await getAuthenticatedClient('admin')
  if (clientId) await supabase.from('clients').delete().eq('id', clientId)
})

test('trocar o plano do cliente na Central de Informações e salvar', async ({ page }) => {
  await loginAs(page, 'gestor')
  await page.goto(`/clients/${clientId}`)

  await page.getByText('Validação', { exact: true }).click()
  await page.getByRole('option', { name: 'Dominação', exact: true }).click()

  await page.getByRole('button', { name: 'Salvar', exact: true }).click()

  // Se der erro, um toast de erro aparece na hora -- captura os dois
  // desfechos possíveis pra não travar no timeout.
  const successToast = page.getByText('Dados do cliente atualizados', { exact: false })
  const errorToast = page.getByText('Não foi possível atualizar os dados do cliente', { exact: false })
  await expect(successToast.or(errorToast)).toBeVisible({ timeout: 10_000 })

  if (await errorToast.isVisible()) {
    throw new Error('Salvar deu erro de verdade ao trocar o plano -- reproduziu o bug do item 7.')
  }

  await page.reload()
  await expect(page.getByText('Dominação', { exact: true })).toBeVisible()
})
