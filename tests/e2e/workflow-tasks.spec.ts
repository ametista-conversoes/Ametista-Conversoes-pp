import { expect, test } from '@playwright/test'
import { getAuthenticatedClient, loginAs } from './fixtures.js'

const RUN_ID = Date.now()
const CLIENT_NAME = `Teste Playwright Workflow ${RUN_ID}`
const PROJECT_TITLE = `Projeto Teste ${RUN_ID}`
const TEMPLATE_NAME = `Workflow Teste ${RUN_ID}`
const STEP_TITLES = [`Etapa A ${RUN_ID}`, `Etapa B ${RUN_ID}`]

let clientId: string
let templateId: string

test.beforeAll(async () => {
  // criar um Workflow Operacional é ação exclusiva de admin (gestor só lê
  // e aplica) — só cliente/projeto aceitam admin ou gestor.
  const supabase = await getAuthenticatedClient('admin')

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .insert({ name: CLIENT_NAME })
    .select('id')
    .single()
  if (clientError) throw clientError
  clientId = client.id

  const { error: projectError } = await supabase
    .from('projects')
    .insert({ title: PROJECT_TITLE, client_id: clientId })
  if (projectError) throw projectError

  const steps = STEP_TITLES.map((title) => ({ title, category: 'teste' }))
  const { data: template, error: templateError } = await supabase
    .from('workflow_templates')
    .insert({ name: TEMPLATE_NAME, steps })
    .select('id')
    .single()
  if (templateError) throw templateError
  templateId = template.id
})

test.afterAll(async () => {
  const supabase = await getAuthenticatedClient('admin')
  // apagar o cliente já leva o projeto e as tarefas junto (on delete cascade)
  if (clientId) await supabase.from('clients').delete().eq('id', clientId)
  if (templateId) await supabase.from('workflow_templates').delete().eq('id', templateId)
})

test('aplicar um workflow cria as tarefas certas no projeto escolhido', async ({ page }) => {
  await loginAs(page, 'gestor')
  await page.goto('/workflows')

  const templateCard = page
    .getByText(TEMPLATE_NAME, { exact: true })
    .locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]')
  await templateCard.getByRole('button', { name: 'Aplicar Workflow' }).click()

  // Diálogo atual (pós-Fase 21/26): cliente, "Aplicar em..." (projeto ou
  // Kanban solto) e, só quando "projeto" é escolhido, um 3º select com o
  // projeto — não é mais um combobox único "Cliente — Projeto".
  await page.getByRole('combobox').first().click()
  await page.getByRole('option', { name: CLIENT_NAME, exact: true }).click()

  await page.getByRole('combobox').nth(1).click()
  await page.getByRole('option', { name: 'Tarefas de um projeto (Kanban interno)' }).click()

  await page.getByRole('combobox').nth(2).click()
  await page.getByRole('option', { name: PROJECT_TITLE, exact: true }).click()

  await page.getByRole('button', { name: 'Aplicar', exact: true }).click()

  await expect(page.getByText('2 tarefas criadas no projeto escolhido.')).toBeVisible()

  await page.goto(`/clients/${clientId}`)
  await expect(page.getByText(STEP_TITLES[0], { exact: true })).toBeVisible()
  await expect(page.getByText(STEP_TITLES[1], { exact: true })).toBeVisible()
})
