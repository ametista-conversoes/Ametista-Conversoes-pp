import { expect, test } from '@playwright/test'
import { getAuthenticatedClient, loginAs } from './fixtures.js'

const RUN_ID = Date.now()
const CLIENT_NAME = `Teste Recorrencia ${RUN_ID}`
const ACTIVITY_TITLE = `Atividade Recorrente ${RUN_ID}`
const STALE_ACTIVITY_TITLE = `Atividade Antiga ${RUN_ID}`
const TASK_TITLE = `Tarefa Recorrente ${RUN_ID}`
const PLAIN_TASK_TITLE = `Tarefa Simples ${RUN_ID}`

let clientId: string
let activityId: string
let staleActivityId: string

test.beforeAll(async () => {
  const supabase = await getAuthenticatedClient('admin')
  const { data: client, error } = await supabase
    .from('clients')
    .insert({ name: CLIENT_NAME, plan: 'validacao' })
    .select('id')
    .single()
  if (error) throw error
  clientId = client.id

  const { data: activity, error: activityError } = await supabase
    .from('activity_checklist_items')
    .insert({ client_id: clientId, title: ACTIVITY_TITLE, completed: false, recurrence_interval: '7' })
    .select('id')
    .single()
  if (activityError) throw activityError
  activityId = activity.id

  const { data: staleActivity, error: staleError } = await supabase
    .from('activity_checklist_items')
    .insert({ client_id: clientId, title: STALE_ACTIVITY_TITLE, completed: false })
    .select('id')
    .single()
  if (staleError) throw staleError
  staleActivityId = staleActivity.id

  const { error: taskError } = await supabase
    .from('client_tasks')
    .insert({ client_id: clientId, title: TASK_TITLE, status: 'todo', recurrence_interval: 'cadencia_otimizacao' })
  if (taskError) throw taskError

  // Tarefa SEM recorrencia -- usada só pro risco (item 36): uma tarefa
  // COM recorrência some da lista principal na hora que é concluída
  // (Fase 36.2, comportamento correto, já confirmado por este mesmo
  // teste), então não dá pra ver o risco nela ali.
  const { error: plainTaskError } = await supabase
    .from('client_tasks')
    .insert({ client_id: clientId, title: PLAIN_TASK_TITLE, status: 'todo' })
  if (plainTaskError) throw plainTaskError
})

test.afterAll(async () => {
  const supabase = await getAuthenticatedClient('admin')
  if (clientId) await supabase.from('clients').delete().eq('id', clientId)
})

test('item 34/28/36 -- concluir item recorrente some da lista, aparece em Recorrentes com contagem, badge e risco', async ({ page }) => {
  await loginAs(page, 'gestor')
  await page.goto('/activities')

  const activityRow = page.locator('div', { hasText: ACTIVITY_TITLE }).filter({ has: page.getByRole('checkbox') }).last()
  await expect(activityRow.getByText('7 dias', { exact: false })).toBeVisible()
  await activityRow.getByRole('checkbox').click()
  await expect(page.getByText(ACTIVITY_TITLE, { exact: true })).not.toBeVisible()

  await page.getByRole('button', { name: /Recorrentes/ }).click()
  const dialog = page.getByRole('dialog')
  const recurrentRow = dialog.locator('div.rounded-lg', { hasText: ACTIVITY_TITLE })
  await expect(recurrentRow.getByText(/Vence em \d+ dia/)).toBeVisible()
  await page.keyboard.press('Escape')

  // Item 28 -- mesma verificacao do lado de Tarefas do Cliente (badge de
  // recorrencia visivel na lista principal, antes de concluir). Filtra
  // pelo cliente de teste primeiro pra eliminar ambiguidade numa lista
  // compartilhada com outros clientes.
  await page.goto('/client-tasks')
  await page.getByRole('combobox').click()
  await page.getByRole('option', { name: CLIENT_NAME, exact: true }).click()

  const taskRow = page.locator('div.rounded-lg', { hasText: TASK_TITLE })
  await expect(taskRow.getByText('cadência de otimização', { exact: false })).toBeVisible()
  await taskRow.getByText('A fazer', { exact: true }).click()
  await page.getByRole('menuitem', { name: 'Concluída' }).click()

  // A tarefa recorrente concluída some da lista principal NA HORA
  // (Fase 36.2) -- não fica ali pra ver riscada, vai direto pro
  // diálogo "Recorrentes" (testado abaixo, no teste do item 27).
  await expect(page.getByText(TASK_TITLE, { exact: true })).not.toBeVisible()

  // Item 36 -- risco em tarefa CONCLUÍDA SEM recorrência (essa sim fica
  // visível na lista principal, riscada).
  const plainRow = page.locator('div.rounded-lg', { hasText: PLAIN_TASK_TITLE })
  await plainRow.getByText('A fazer', { exact: true }).click()
  await page.getByRole('menuitem', { name: 'Concluída' }).click()
  await expect(plainRow.getByText('Concluída', { exact: true })).toBeVisible()
  await expect(plainRow.getByText(PLAIN_TASK_TITLE, { exact: true })).toHaveCSS('text-decoration-line', 'line-through')

  // Item 36 -- Kanban nao ganha botao Recorrentes.
  await page.goto('/kanban')
  await expect(page.getByRole('button', { name: /Recorrentes/ })).not.toBeVisible()
})

test('item 32/33 -- item sem recorrencia colapsa em 1 dia e arquiva em 30; item COM recorrencia nunca arquiva', async ({ page }) => {
  const supabase = await getAuthenticatedClient('admin')

  // Forca a atividade recorrente (ja concluida no teste anterior) pra
  // muito além do prazo de arquivamento (31 dias) -- item 32: mesmo
  // assim NUNCA deve ser arquivada de verdade.
  const { error: err1 } = await supabase
    .from('activity_checklist_items')
    .update({ completed_at: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString() })
    .eq('id', activityId)
  if (err1) throw err1

  // Marca e envelhece a atividade SEM recorrencia -- item 33: 31 dias
  // deve arquivar de verdade.
  const { error: err2 } = await supabase
    .from('activity_checklist_items')
    .update({ completed: true, completed_at: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString() })
    .eq('id', staleActivityId)
  if (err2) throw err2

  await loginAs(page, 'gestor')
  await page.goto('/activities')
  await page.waitForTimeout(1500) // useAutoArchiveOldTasks roda no mount

  // Item recorrente vencido -- volta a ser PENDENTE na lista principal
  // (nunca aparece em "Arquivadas").
  await expect(page.getByText(ACTIVITY_TITLE, { exact: true })).toBeVisible()

  // Item sem recorrencia, 31 dias -- sumiu da lista principal e foi
  // pro arquivo de verdade.
  await expect(page.getByText(STALE_ACTIVITY_TITLE, { exact: true })).not.toBeVisible()

  await page.getByRole('button', { name: /Arquivadas/ }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText(STALE_ACTIVITY_TITLE, { exact: true })).toBeVisible()
  // O item recorrente NUNCA deve aparecer DENTRO do diálogo Arquivadas.
  await expect(dialog.getByText(ACTIVITY_TITLE, { exact: true })).not.toBeVisible()
})

test('item 27 -- cadencia de plano muda o prazo de recorrencia sem editar o item', async ({ page }) => {
  const supabase = await getAuthenticatedClient('admin')

  // Cliente comeca em 'validacao' (30 dias de cadencia de otimizacao).
  // Muda pra 'dominacao' (7 dias) -- o prazo de recorrencia da MESMA
  // tarefa (client_tasks, concluida no 1o teste) deve mudar junto, sem
  // editar a tarefa em si.
  const { error } = await supabase.from('clients').update({ plan: 'dominacao' }).eq('id', clientId)
  if (error) throw error

  await loginAs(page, 'gestor')
  await page.goto('/client-tasks')
  await page.getByRole('button', { name: /Recorrentes/ }).click()
  const dialog = page.getByRole('dialog')
  const row = dialog.locator('div.rounded-lg', { hasText: TASK_TITLE })
  await expect(row).toBeVisible()
  // Cadencia de otimizacao da Dominacao = 7 dias -- nunca deveria
  // mostrar "30 dias" (prazo antigo de Validacao).
  await expect(row.getByText('30 dias', { exact: false })).not.toBeVisible()
  await expect(row.getByText(/Vence em \d+ dia/)).toBeVisible()
})

test('item 27/205 -- client_task recorrente vencida volta sozinha pra "A fazer" na lista principal', async ({ page }) => {
  const supabase = await getAuthenticatedClient('admin')

  // Forca completed_at bem alem do prazo (cliente ja esta em
  // 'dominacao' = 7 dias, desde o teste anterior).
  const { error } = await supabase
    .from('client_tasks')
    .update({ completed_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString() })
    .eq('client_id', clientId)
    .eq('title', TASK_TITLE)
  if (error) throw error

  await loginAs(page, 'gestor')
  await page.goto('/client-tasks')
  await page.getByRole('combobox').click()
  await page.getByRole('option', { name: CLIENT_NAME, exact: true }).click()

  // Volta pra lista principal, como "A fazer" -- mesma linha, sem
  // duplicar (nunca aparece 2x na lista).
  const row = page.locator('div.rounded-lg', { hasText: TASK_TITLE })
  await expect(row).toHaveCount(1)
  await expect(row.getByText('A fazer', { exact: true })).toBeVisible()
})
