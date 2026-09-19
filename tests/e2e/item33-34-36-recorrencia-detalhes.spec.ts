import { expect, test } from '@playwright/test'
import { getAuthenticatedClient, loginAs } from './fixtures.js'

const RUN_ID = Date.now()
const CLIENT_NAME = `Teste Colapso ${RUN_ID}`
const STALE_TITLE = `Item Antigo Sem Recorrencia ${RUN_ID}`
const DORMANT_TITLE = `Tarefa Reabrir ${RUN_ID}`
const MID_CYCLE_TITLE = `Tarefa Meio do Prazo ${RUN_ID}`
const TEMPLATE_NAME = `Modelo Badge Recorrencia ${RUN_ID}`
const TEMPLATE_ITEM_TITLE = `Etapa Recorrente do Modelo ${RUN_ID}`

let clientId: string
let templateId: string

test.beforeAll(async () => {
  const admin = await getAuthenticatedClient('admin')
  const { data: client, error } = await admin.from('clients').insert({ name: CLIENT_NAME, plan: 'validacao' }).select('id').single()
  if (error) throw error
  clientId = client.id

  // Item 33 -- sem recorrência, concluído há 2 dias (> 1 dia de graça): some da
  // lista principal por padrão, some junto no toggle "Mostrar concluídas".
  const { error: staleErr } = await admin.from('activity_checklist_items').insert({
    client_id: clientId,
    title: STALE_TITLE,
    completed: true,
    completed_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  })
  if (staleErr) throw staleErr

  // Item 34 -- recorrente já concluído, pronto pro "Reabrir agora".
  const { error: dormantErr } = await admin.from('client_tasks').insert({
    client_id: clientId,
    title: DORMANT_TITLE,
    status: 'done',
    recurrence_interval: '30',
    completed_at: new Date().toISOString(),
  })
  if (dormantErr) throw dormantErr

  // Item 34 -- caso intermediário: recorrência de 30 dias, concluído há 5 dias
  // (faltam 25) -- ainda dentro do prazo, não deve sumir do diálogo nem voltar
  // sozinho pra lista principal.
  const { error: midErr } = await admin.from('client_tasks').insert({
    client_id: clientId,
    title: MID_CYCLE_TITLE,
    status: 'done',
    recurrence_interval: '30',
    completed_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  })
  if (midErr) throw midErr

  // Item 36 -- badge de recorrência no CARD DO MODELO (não instanciado).
  // "Workflow de Atividades" mora em activity_templates.items -- diferente
  // do "Workflow Operacional" (workflow_templates.steps).
  const { data: template, error: templateErr } = await admin
    .from('activity_templates')
    .insert({ name: TEMPLATE_NAME, items: [{ title: TEMPLATE_ITEM_TITLE, category: 'teste', recurrence: '7' }] })
    .select('id')
    .single()
  if (templateErr) throw templateErr
  templateId = template.id
})

test.afterAll(async () => {
  const admin = await getAuthenticatedClient('admin')
  if (clientId) await admin.from('clients').delete().eq('id', clientId)
  if (templateId) await admin.from('activity_templates').delete().eq('id', templateId)
})

test('item 33 -- item concluído sem recorrência colapsa atrás de "Mostrar concluídas há mais de 1 dia"', async ({ page }) => {
  await loginAs(page, 'gestor')
  await page.goto('/activities')
  await page.getByRole('combobox').click()
  await page.getByRole('option', { name: CLIENT_NAME, exact: true }).click()

  await expect(page.getByText(STALE_TITLE, { exact: true })).not.toBeVisible()
  const toggle = page.getByRole('button', { name: /Mostrar concluídas há mais de 1 dia \(1\)/ })
  await expect(toggle).toBeVisible()
  await toggle.click()

  const row = page.locator('div', { hasText: STALE_TITLE }).last()
  await expect(row.getByText(STALE_TITLE, { exact: true })).toBeVisible()
})

test('item 34 -- "Reabrir agora" volta a tarefa recorrente pra lista principal; caso intermediário mantém no diálogo', async ({ page }) => {
  await loginAs(page, 'gestor')
  await page.goto('/client-tasks')
  await page.getByRole('combobox').click()
  await page.getByRole('option', { name: CLIENT_NAME, exact: true }).click()

  await page.getByRole('button', { name: /Recorrentes/ }).click()
  const dialog = page.getByRole('dialog')

  // Caso intermediário -- ainda dentro do prazo (30 dias, concluído há 5):
  // continua no diálogo, com a contagem certa, nunca "vence em 30 dias" errado.
  const midRow = dialog.locator('div.rounded-lg', { hasText: MID_CYCLE_TITLE })
  await expect(midRow).toBeVisible()
  await expect(midRow.getByText(/Vence em 2[4-6] dias/)).toBeVisible()

  // "Reabrir agora" na outra tarefa.
  await dialog.getByRole('button', { name: `Reabrir "${DORMANT_TITLE}" agora` }).click()
  await expect(dialog.locator('div.rounded-lg', { hasText: DORMANT_TITLE })).not.toBeVisible()
  await page.keyboard.press('Escape')

  const mainRow = page.locator('div.rounded-lg', { hasText: DORMANT_TITLE })
  await expect(mainRow).toBeVisible()
  await expect(mainRow.getByText('A fazer', { exact: true })).toBeVisible()
})

test('item 36 -- badge de recorrência aparece no card do MODELO de Workflow de Atividades', async ({ page }) => {
  await loginAs(page, 'gestor')
  await page.goto('/workflows')
  await page.getByRole('tab', { name: 'Atividades' }).click()

  const card = page.locator('div', { hasText: TEMPLATE_NAME }).filter({ has: page.getByText(TEMPLATE_ITEM_TITLE) })
  await expect(card.getByText('7 dias', { exact: false })).toBeVisible()
})
