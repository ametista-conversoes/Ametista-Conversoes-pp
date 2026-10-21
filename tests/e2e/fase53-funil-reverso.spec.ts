import { expect, test } from '@playwright/test'
import { getAuthenticatedClient, loginAs } from './fixtures.js'

// Cliente 100% descartável (criado e apagado aqui; as metas caem junto
// por cascade) — nunca toca em cliente real nem nos clientes demo.
const CLIENT_NAME = `E2E Funil reverso ${Date.now()}`
let clientId: string | null = null

test.beforeAll(async () => {
  const supabase = await getAuthenticatedClient('admin')
  const { data, error } = await supabase
    .from('clients')
    .insert({ name: CLIENT_NAME, leads_to_close: 10, average_ticket: 1500 })
    .select('id')
    .single()
  if (error) throw error
  clientId = data.id
  // Meta de CPA já existente: o funil deve ler o alvo dela e ATUALIZAR, não duplicar.
  const { error: goalError } = await supabase
    .from('smart_goals')
    .insert({ title: 'CPA do mês', client_id: clientId, metric_type: 'cpa', target_value: 30, current_value: 0, status: 'on_track' })
  if (goalError) throw goalError
})

test.afterAll(async () => {
  const supabase = await getAuthenticatedClient('admin')
  if (clientId) await supabase.from('clients').delete().eq('id', clientId)
})

test('Montar funil: modo verba calcula, salva e atualiza a meta existente', async ({ page }) => {
  await loginAs(page, 'gestor')
  await page.goto('/smart-goals')
  await page.getByRole('combobox').first().click()
  await page.getByRole('option', { name: CLIENT_NAME }).click()

  await page.getByRole('button', { name: 'Montar funil' }).click()
  const dialog = page.getByRole('dialog')
  // CPA-alvo veio da meta SMART existente; leads p/ venda e ticket, da ficha.
  await expect(dialog.getByLabel('CPA-alvo (R$)')).toHaveValue('30')
  await expect(dialog.getByLabel('Leads p/ fechar 1 venda')).toHaveValue('10')
  await expect(dialog.getByText('Origem: meta SMART')).toBeVisible()

  await dialog.getByLabel('Verba mensal (R$)').fill('3000')
  await dialog.getByLabel('CTR esperado (%)').fill('2')
  await dialog.getByLabel('Taxa de conversão — clique → lead (%)').fill('5')
  await dialog.getByLabel('Taxa de qualificação — lead → qualificado (%)').fill('40')

  // 3000 ÷ 30 = 100 leads → 2000 cliques → 100.000 impressões → 10 vendas
  const row = (name: string) => dialog.getByRole('row').filter({ has: page.getByRole('cell', { name, exact: true }) })
  await expect(row('Leads')).toContainText('100')
  await expect(row('Cliques')).toContainText('2.000')
  await expect(row('Impressões')).toContainText('100.000')
  await expect(row('CPA')).toContainText('atualiza')
  await expect(row('Cliques')).toContainText('cria')
  await page.screenshot({ path: 'test-results/fase53-funil-dialogo.png', fullPage: true })

  await dialog.getByRole('button', { name: /^Salvar \d+ meta/ }).click()
  await expect(dialog).toBeHidden()

  await expect(page.getByText(`Funil — ${CLIENT_NAME}`)).toBeVisible()
  await expect(page.getByText('Funil — Cliques', { exact: true })).toBeVisible()
  await page.screenshot({ path: 'test-results/fase53-funil-pagina.png', fullPage: true })

  const supabase = await getAuthenticatedClient('admin')
  const { data: goals } = await supabase.from('smart_goals').select('metric_type, target_value').eq('client_id', clientId!)
  const cpaGoals = (goals ?? []).filter((g) => g.metric_type === 'cpa')
  expect(cpaGoals).toHaveLength(1) // atualizou, não duplicou
  expect(Number(cpaGoals[0].target_value)).toBe(30)
  expect(Number((goals ?? []).find((g) => g.metric_type === 'impressoes')?.target_value)).toBe(100000)
  expect(Number((goals ?? []).find((g) => g.metric_type === 'orcamento')?.target_value)).toBe(3000)
})
