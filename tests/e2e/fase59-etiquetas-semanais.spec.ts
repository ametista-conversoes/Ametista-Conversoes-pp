import { expect, test } from '@playwright/test'
import { getAuthenticatedClient, loginAs } from './fixtures.js'
import { recentWeekStarts, weekMonthIso } from '../../src/lib/label-funnel.js'

// Fase 59 — o cliente registra a contagem semanal das etiquetas do WhatsApp
// no Dashboard; a soma de "Venda" das semanas vira as "Vendas do mês". Usa a
// 4ª semana do seletor (a mais antiga); as linhas criadas são apagadas no fim
// e as vendas do mês voltam ao valor de antes.
const today = new Date()
const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
const WEEK = recentWeekStarts(todayIso, 4)[3]
const MONTH = weekMonthIso(WEEK)
let clientId = ''
let previousSales: number | null = null

test.beforeAll(async () => {
  const cliente = await getAuthenticatedClient('cliente')
  const { data: userData } = await cliente.auth.getUser()
  const { data: profile } = await cliente.from('profiles').select('client_id').eq('id', userData.user!.id).single()
  clientId = profile!.client_id
  const gestor = await getAuthenticatedClient('gestor')
  const { data } = await gestor.from('client_monthly_sales').select('sales').eq('client_id', clientId).eq('month', MONTH).maybeSingle()
  previousSales = data?.sales ?? null
  await gestor.from('client_weekly_labels').delete().eq('client_id', clientId).eq('week_start', WEEK)
})

test.afterAll(async () => {
  const gestor = await getAuthenticatedClient('gestor')
  await gestor.from('client_weekly_labels').delete().eq('client_id', clientId).eq('week_start', WEEK)
  if (previousSales == null) {
    await gestor.from('client_monthly_sales').delete().eq('client_id', clientId).eq('month', MONTH)
  } else {
    await gestor.from('client_monthly_sales').upsert({ client_id: clientId, month: MONTH, sales: previousSales }, { onConflict: 'client_id,month' })
  }
})

test('cliente registra as etiquetas da semana e as vendas do mês viram a soma', async ({ page }) => {
  await loginAs(page, 'cliente')
  await page.goto('/dashboard')
  const card = page.locator('div.rounded-xl', { has: page.getByText('Etiquetas da semana', { exact: true }) })
  await card.getByRole('combobox', { name: 'Semana' }).click()
  await page.getByRole('option').nth(3).click()

  await card.getByLabel('Novo').fill('10')
  await card.getByLabel('Qualificado').fill('5')
  await card.getByLabel('Agendado').fill('3')
  await card.getByLabel('Venda').fill('2')
  await card.getByLabel('Perdido').fill('4')
  await card.getByRole('button', { name: 'Salvar' }).click()
  await expect(card).toContainText('Registrada')

  const gestor = await getAuthenticatedClient('gestor')
  const { data: weeks } = await gestor.from('client_weekly_labels').select('week_start, venda').eq('client_id', clientId)
  const expected = (weeks ?? []).filter((w) => weekMonthIso(w.week_start) === MONTH).reduce((sum, w) => sum + w.venda, 0)
  const { data: sales } = await gestor.from('client_monthly_sales').select('sales').eq('client_id', clientId).eq('month', MONTH).single()
  expect(sales?.sales).toBe(expected)
})

test('gestor vê o funil das etiquetas na ficha do cliente', async ({ page }) => {
  await loginAs(page, 'gestor')
  await page.goto(`/clients/${clientId}`)
  const card = page.locator('div.rounded-xl', { has: page.getByText('Etiquetas do WhatsApp', { exact: true }) })
  await expect(card).toBeVisible()
  await expect(card).toContainText('Qualificados')
  await expect(card).toContainText('dos agendados')
})

test('RLS: cliente não grava etiquetas de outro cliente', async () => {
  const admin = await getAuthenticatedClient('admin')
  const { data: other } = await admin.from('clients').select('id').neq('id', clientId).limit(1).single()
  const cliente = await getAuthenticatedClient('cliente')
  const { error } = await cliente.from('client_weekly_labels').insert({ client_id: other!.id, week_start: WEEK, novo: 1 })
  expect(error).not.toBeNull()
})
