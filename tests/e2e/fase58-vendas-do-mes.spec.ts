import { expect, test } from '@playwright/test'
import { getAuthenticatedClient, loginAs } from './fixtures.js'

// Fase 58 — o cliente informa as "Vendas do mês" no Dashboard. Usa o mês de
// 2 meses atrás (opção do seletor) pra não mexer no mês corrente da conta de
// teste; a linha é apagada no fim.
const back2 = new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1)
const MONTH_ISO = `${back2.getFullYear()}-${String(back2.getMonth() + 1).padStart(2, '0')}-01`
let clientId = ''

test.beforeAll(async () => {
  const cliente = await getAuthenticatedClient('cliente')
  const { data: userData } = await cliente.auth.getUser()
  const { data: profile } = await cliente.from('profiles').select('client_id').eq('id', userData.user!.id).single()
  clientId = profile!.client_id
  const gestor = await getAuthenticatedClient('gestor')
  await gestor.from('client_monthly_sales').delete().eq('client_id', clientId).eq('month', MONTH_ISO)
})

test.afterAll(async () => {
  const gestor = await getAuthenticatedClient('gestor')
  await gestor.from('client_monthly_sales').delete().eq('client_id', clientId).eq('month', MONTH_ISO)
})

test('cliente informa as vendas do mês no Dashboard e o valor fica gravado', async ({ page }) => {
  await loginAs(page, 'cliente')
  await page.goto('/dashboard')
  const card = page.locator('div.rounded-xl', { has: page.getByText('Vendas do mês', { exact: true }) })
  await card.getByRole('combobox', { name: 'Mês' }).click()
  await page.getByRole('option').nth(2).click()
  await expect(card).toContainText('Ainda não informado')

  await card.getByRole('spinbutton', { name: 'Número de vendas' }).fill('17')
  await card.getByRole('button', { name: 'Salvar' }).click()
  await expect(card).toContainText('Informado: 17 venda(s)')

  const gestor = await getAuthenticatedClient('gestor')
  const { data } = await gestor.from('client_monthly_sales').select('sales').eq('client_id', clientId).eq('month', MONTH_ISO).single()
  expect(data?.sales).toBe(17)
})

test('RLS: cliente não grava vendas de outro cliente', async () => {
  const admin = await getAuthenticatedClient('admin')
  const { data: other } = await admin.from('clients').select('id').neq('id', clientId).limit(1).single()
  const cliente = await getAuthenticatedClient('cliente')
  const { error } = await cliente.from('client_monthly_sales').insert({ client_id: other!.id, month: MONTH_ISO, sales: 1 })
  expect(error).not.toBeNull()
})
