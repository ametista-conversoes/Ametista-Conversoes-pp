import { expect, test } from '@playwright/test'
import { getAuthenticatedClient, loginAs } from './fixtures.js'

const RUN_ID = Date.now()
const APPROVAL_TITLE = `Criativo Teste Playwright ${RUN_ID}`
const REVISION_FEEDBACK = 'Ajustar a cor de fundo, por favor.'
const REVIEW_TASK_TITLE = `Revisar: ${APPROVAL_TITLE}`

let clientId: string
let approvalId: string

test.beforeAll(async () => {
  // a conta de cliente de teste já é dona de um cliente de verdade — a
  // aprovação precisa ser criada pra ESSE client_id, senão a conta de
  // teste não vai enxergar/poder responder ela.
  const clientAuth = await getAuthenticatedClient('cliente')
  const { data: userData, error: userError } = await clientAuth.auth.getUser()
  if (userError || !userData.user) throw userError ?? new Error('Conta de cliente de teste sem sessão')
  const { data: profile, error: profileError } = await clientAuth
    .from('profiles')
    .select('client_id')
    .eq('id', userData.user.id)
    .single()
  if (profileError || !profile?.client_id) throw profileError ?? new Error('Conta de cliente de teste sem client_id')
  clientId = profile.client_id

  const gestorAuth = await getAuthenticatedClient('gestor')
  const { data: approval, error: approvalError } = await gestorAuth
    .from('approvals')
    .insert({ title: APPROVAL_TITLE, client_id: clientId, file_url: null, file_type: null })
    .select('id')
    .single()
  if (approvalError) throw approvalError
  approvalId = approval.id
})

test.afterAll(async () => {
  const gestorAuth = await getAuthenticatedClient('gestor')
  if (approvalId) await gestorAuth.from('approvals').delete().eq('id', approvalId)
  await gestorAuth.from('tasks').delete().eq('title', REVIEW_TASK_TITLE)
})

test('cliente pede revisão de uma aprovação e a agência recebe uma tarefa automaticamente', async ({ page }) => {
  await loginAs(page, 'cliente')
  await page.goto('/files')
  await page.getByRole('tab', { name: 'Aprovações' }).click()

  const approvalRow = page
    .getByText(APPROVAL_TITLE, { exact: true })
    .locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]')
  await approvalRow.getByRole('button', { name: 'Pedir revisão' }).click()

  await page.getByPlaceholder('Descreva o motivo ou o que precisa mudar...').fill(REVISION_FEEDBACK)
  await page.getByRole('button', { name: 'Confirmar' }).click()

  await expect(approvalRow.getByText('Revisão pedida')).toBeVisible()

  // A tarefa nasce de um gatilho no banco — confere lá primeiro (separa
  // "gatilho não rodou" de "tela ainda carregando").
  const gestorAuth = await getAuthenticatedClient('gestor')
  await expect
    .poll(async () => {
      const { data } = await gestorAuth.from('tasks').select('id').eq('title', REVIEW_TASK_TITLE)
      return data?.length ?? 0
    }, { timeout: 15_000 })
    .toBe(1)

  // Primeiro arquivo da suíte: pega o servidor de dev ainda compilando a
  // Central de Informações pela 1ª vez — por isso o tempo maior só aqui.
  await loginAs(page, 'gestor')
  await page.goto(`/clients/${clientId}`)
  await expect(page.getByText(REVIEW_TASK_TITLE, { exact: true })).toBeVisible({ timeout: 20_000 })
})
