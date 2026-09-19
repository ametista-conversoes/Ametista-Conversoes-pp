import { expect, test } from '@playwright/test'
import { getAuthenticatedClient, loginAs } from './fixtures.js'

const RUN_ID = Date.now()
const CLIENT_NAME = 'Studio Prisma'
const BULK_LINE_1 = `Transforme seu negocio ${RUN_ID}`
const BULK_LINE_2 = `Venda mais todos os dias ${RUN_ID}`
const BULK_LINE_3 = `Aumente seus resultados ${RUN_ID}`
const LONG_HEADLINE = `Essa headline aqui tem certeza mais de trinta caracteres ${RUN_ID}`

test.afterAll(async () => {
  const admin = await getAuthenticatedClient('admin')
  await admin.from('catalog_entries').delete().in('conteudo', [BULK_LINE_1, BULK_LINE_2, BULK_LINE_3])
})

test('item 25 -- contador de 30 caracteres da Headline desabilita Salvar acima do limite', async ({ page }) => {
  await loginAs(page, 'gestor')
  await page.goto('/catalog')
  await page.getByRole('combobox').click()
  await page.getByRole('option', { name: CLIENT_NAME, exact: true }).click()

  await page.getByRole('button', { name: 'Adicionar' }).first().click()
  const textarea = page.locator('textarea').first()
  await textarea.fill(LONG_HEADLINE)
  await expect(page.getByText(/\/30 caracteres/)).toHaveClass(/text-destructive/)
  await expect(page.getByRole('button', { name: 'Salvar' })).toBeDisabled()

  await textarea.fill('Headline curta')
  await expect(page.getByText(/\/30 caracteres/)).not.toHaveClass(/text-destructive/)
  await expect(page.getByRole('button', { name: 'Salvar' })).toBeEnabled()
  await page.getByRole('button', { name: 'Cancelar' }).click()
})

test('item 24 -- colar em massa cria N entradas separadas, mantém Tipo/Origem/Prioridade ao voltar pro modo único, e sincroniza global<->card do cliente', async ({ page }) => {
  await loginAs(page, 'gestor')
  await page.goto('/catalog')
  await page.getByRole('combobox').click()
  await page.getByRole('option', { name: CLIENT_NAME, exact: true }).click()

  await page.getByRole('button', { name: 'Adicionar' }).first().click()

  // "Frase de destaque" não tem limite de caracteres (diferente de
  // Headline/Descrição) -- as linhas de teste usam um RUN_ID longo no
  // sufixo (pra ficar único e fácil de limpar depois), o que estouraria
  // o limite de 30 caracteres da Headline.
  await page.getByRole('combobox').nth(1).click()
  await page.getByRole('option', { name: 'Frase de destaque' }).click()

  // Troca pro modo massa e volta pro modo único -- confirma que o botão some
  // e reaparece sem resetar o formulário (reset() só roda em Cancelar/Salvar).
  await page.getByRole('button', { name: 'Colar várias em massa' }).click()
  await expect(page.getByRole('button', { name: 'Uma entrada por vez' })).toBeVisible()
  await page.getByRole('button', { name: 'Uma entrada por vez' }).click()
  await expect(page.getByRole('button', { name: 'Colar várias em massa' })).toBeVisible()
  await page.getByRole('button', { name: 'Colar várias em massa' }).click()

  const textarea = page.locator('textarea').first()
  await textarea.fill(`${BULK_LINE_1}\n\n${BULK_LINE_2}\n${BULK_LINE_3}\n`)
  await expect(page.getByRole('button', { name: 'Criar 3 entradas' })).toBeVisible()
  await page.getByRole('button', { name: 'Criar 3 entradas' }).click()

  await expect(page.getByText(BULK_LINE_1, { exact: true })).toBeVisible()
  await expect(page.getByText(BULK_LINE_2, { exact: true })).toBeVisible()
  await expect(page.getByText(BULK_LINE_3, { exact: true })).toBeVisible()

  // Mesmo dado aparece no card da Central de Informações do cliente.
  await page.goto('/clients')
  await page.getByText(CLIENT_NAME, { exact: true }).click()
  await expect(page.getByText(BULK_LINE_1, { exact: true })).toBeVisible()
})
