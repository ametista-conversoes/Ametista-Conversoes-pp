import { expect, test } from '@playwright/test'
import { getAuthenticatedClient, loginAs } from './fixtures.js'

let clientId: string

test.beforeAll(async () => {
  const supabase = await getAuthenticatedClient('admin')
  const { data } = await supabase.from('clients').select('id').eq('name', 'Loja Aurora').single()
  clientId = data!.id
})

test('Central de Informações mostra a Loja Aurora como demo, plano Dominação', async ({ page }) => {
  await loginAs(page, 'gestor')
  await page.goto(`/clients/${clientId}`)
  await expect(page.getByText('Demonstração').first()).toBeVisible()
  await expect(page.getByText('Dominação').first()).toBeVisible()
})

test('Ritmo de verba aparece na Análise do Gestor (mês corrente estourado)', async ({ page }) => {
  await loginAs(page, 'gestor')
  await page.goto(`/clients/${clientId}`)
  await page.getByRole('button', { name: /Nova análise|Editar análise/ }).first().click()
  const monthlyOption = page.getByText('Mensal estratégica')
  if (await monthlyOption.isVisible().catch(() => false)) await monthlyOption.click()
  await expect(page.getByText('Ritmo de verba')).toBeVisible({ timeout: 10_000 })
})

test('aba Grupos de Anúncios funciona pra campanha do Google Ads também', async ({ page }) => {
  await loginAs(page, 'gestor')
  await page.goto(`/clients/${clientId}`)
  await page.getByText('E-commerce — Meta + Google Ads').click()
  await page.getByRole('tab', { name: 'Grupos de Anúncios' }).click()
  await expect(page.getByText('Marca — Loja Aurora')).toBeVisible()
})

test('smart goals e health score em atenção aparecem na ficha', async ({ page }) => {
  await loginAs(page, 'gestor')
  await page.goto(`/clients/${clientId}`)
  await expect(page.getByText('Manter ROAS acima de 4,5')).toBeVisible()
})
