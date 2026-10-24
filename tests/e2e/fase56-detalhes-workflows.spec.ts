import { expect, test } from '@playwright/test'
import { getAuthenticatedClient, loginAs } from './fixtures.js'

// Fase 56 — "?" ao lado do item abre o card "Como fazer". Os modelos já têm
// details (migration-105); a tarefa do cliente é criada aqui e apagada no fim.
const RUN_ID = Date.now()
const TASK_TITLE = `Tarefa com detalhes ${RUN_ID}`
const TASK_DETAILS = `Passo 1: abrir o painel.\nPasso 2: ver https://exemplo.com/guia-${RUN_ID}`
let taskId: string | null = null

test.beforeAll(async () => {
  const cliente = await getAuthenticatedClient('cliente')
  const { data: userData } = await cliente.auth.getUser()
  const { data: profile } = await cliente.from('profiles').select('client_id').eq('id', userData.user!.id).single()
  const gestor = await getAuthenticatedClient('gestor')
  const { data, error } = await gestor
    .from('client_tasks')
    .insert({ title: TASK_TITLE, client_id: profile!.client_id, status: 'todo', details: TASK_DETAILS })
    .select('id')
    .single()
  if (error) throw error
  taskId = data.id
})

test.afterAll(async () => {
  const gestor = await getAuthenticatedClient('gestor')
  if (taskId) await gestor.from('client_tasks').delete().eq('id', taskId)
})

test('modelo: "?" no card abre o como fazer; editor mostra "Detalhes (preenchido)"', async ({ page }) => {
  await loginAs(page, 'admin')
  await page.goto('/workflows')
  await page.getByRole('tab', { name: 'Workflows de Atividades' }).click()

  await page.getByRole('button', { name: /^Detalhes: Criar a conta do GA4/ }).first().click()
  const card = page.getByRole('dialog').filter({ hasText: 'Como fazer' })
  await expect(card).toBeVisible()
  await expect(card).toContainText('Criar a conta do GA4')
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Editar 2.5 — Rastreamento GA4 + Tag Manager' }).click()
  const editor = page.getByRole('dialog')
  await editor.getByRole('button', { name: 'Detalhes (preenchido)' }).first().click()
  await expect(editor.locator('textarea').first()).not.toHaveValue('')
})

test('Portal do Cliente: "?" na tarefa mostra os detalhes com link clicável', async ({ page }) => {
  await loginAs(page, 'cliente')
  await page.goto('/tasks')
  await page.getByRole('button', { name: `Detalhes: ${TASK_TITLE}` }).click()
  const card = page.getByRole('dialog').filter({ hasText: 'Como fazer' })
  await expect(card).toContainText('Passo 1: abrir o painel.')
  await expect(card.getByRole('link', { name: `https://exemplo.com/guia-${RUN_ID}` })).toHaveAttribute('target', '_blank')
  await page.screenshot({ path: 'test-results/fase56-detalhes-cliente.png' })
})

test('checklist do gestor: item aplicado mostra o "?"', async ({ page }) => {
  await loginAs(page, 'gestor')
  await page.goto('/activities')
  await expect(page.getByRole('button', { name: /^Detalhes: / }).first()).toBeVisible({ timeout: 15_000 })
})
