import { expect, test } from '@playwright/test'
import { getAuthenticatedClient, loginAs } from './fixtures.js'

const RUN_ID = Date.now()
const STEP_TITLE = `Etapa Workflow Cliente ${RUN_ID}`
const TEMPLATE_NAME = `Workflow Cliente Teste ${RUN_ID}`

let templateId: string
let realClientId: string
let realClientName: string

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

  const admin = await getAuthenticatedClient('admin')
  const { data: clientRow, error: clientRowError } = await admin.from('clients').select('name').eq('id', realClientId).single()
  if (clientRowError || !clientRow) throw clientRowError ?? new Error('Cliente real não encontrado')
  realClientName = clientRow.name

  const { data: template, error } = await admin
    .from('client_workflow_templates')
    .insert({ name: TEMPLATE_NAME, steps: [{ title: STEP_TITLE, category: 'teste' }] })
    .select('id')
    .single()
  if (error) throw error
  templateId = template.id
})

test.afterAll(async () => {
  const admin = await getAuthenticatedClient('admin')
  if (templateId) await admin.from('client_workflow_templates').delete().eq('id', templateId)
  await admin.from('client_tasks').delete().eq('title', STEP_TITLE)
})

test('item 21 -- aplicar Workflow do Cliente cria a tarefa em client_tasks e aparece em /tasks do Portal Cliente', async ({ page }) => {
  await loginAs(page, 'gestor')
  await page.goto('/workflows')
  await page.getByRole('tab', { name: 'Workflows do Cliente' }).click()

  const templateCard = page.getByText(TEMPLATE_NAME, { exact: true }).locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]')
  await templateCard.getByRole('button', { name: 'Aplicar a clientes' }).click()

  const dialog = page.getByRole('dialog')
  await dialog.getByText(realClientName, { exact: true }).click()
  await dialog.getByRole('button', { name: /Aplicar \(\d+\)/ }).click()
  await expect(page.getByText(/tarefa\(s\) criadas/)).toBeVisible()

  await loginAs(page, 'cliente')
  await page.goto('/tasks')
  await expect(page.getByText(STEP_TITLE, { exact: true })).toBeVisible()

  // Confirma direto no banco que caiu em client_tasks (não em tasks/Kanban).
  const admin = await getAuthenticatedClient('admin')
  const { data: row } = await admin.from('client_tasks').select('id, status, client_id').eq('title', STEP_TITLE).maybeSingle()
  expect(row).not.toBeNull()
  expect(row?.status).toBe('backlog')
  expect(row?.client_id).toBe(realClientId)
})
