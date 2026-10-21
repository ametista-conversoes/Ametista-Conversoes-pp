import { expect, test } from '@playwright/test'
import { getAuthenticatedClient, loginAs } from './fixtures.js'

// Roda em cima da Clínica Sorriso (demo): projeto com Teste A/B do tipo
// "Anúncio", gasto mínimo R$150 e 4 campanhas vinculadas como variantes.
// Tudo o que o teste muda é desfeito no fim (gasto mínimo volta a 150,
// log e criativo temporários são apagados).
const PROJECT_TITLE = 'Avaliação Odontológica — Meta Ads'
const DEMO_MIN_SPEND = 150
const RUN_ID = Date.now()
let clientId: string
let projectId: string

test.beforeAll(async () => {
  const admin = await getAuthenticatedClient('admin')
  const { data: client } = await admin.from('clients').select('id').eq('name', 'Clínica Sorriso (demo)').single()
  clientId = client!.id
  const { data: project } = await admin.from('projects').select('id').eq('client_id', clientId).eq('title', PROJECT_TITLE).single()
  projectId = project!.id
})

test.afterAll(async () => {
  const admin = await getAuthenticatedClient('admin')
  await admin.from('projects').update({ test_min_spend: DEMO_MIN_SPEND }).eq('id', projectId)
  await admin.from('catalog_entries').delete().eq('client_id', clientId).like('conteudo', `%${RUN_ID}%`)
})

test('item 18 -- gasto mínimo marca "Dados insuficientes" e tira o destaque; tipo "Anúncio" mostra log manual', async ({ page }) => {
  await loginAs(page, 'gestor')
  await page.goto(`/clients/${clientId}`)
  await page.getByText(PROJECT_TITLE, { exact: true }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('tab', { name: 'Testes' }).click()

  function variantCard(name: string) {
    return dialog.getByText(name, { exact: true }).locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]')
  }
  async function setMinSpend(value: string) {
    await dialog.getByRole('button', { name: /R\$/ }).first().click()
    await dialog.getByPlaceholder('Ex: 100').fill(value)
    await dialog.getByPlaceholder('Ex: 100').press('Enter')
  }

  // Mínimo acima do gasto de qualquer variante: todas "Dados insuficientes", nenhuma destacada.
  await setMinSpend('99999999')
  await expect(dialog.getByText('Dados insuficientes', { exact: true })).toHaveCount(4)
  await expect(dialog.locator('.text-emerald-400')).toHaveCount(0)

  // Volta ao mínimo do demo: variantes elegíveis e quem bate a média ganha destaque verde.
  await setMinSpend(String(DEMO_MIN_SPEND))
  await expect(dialog.getByText('Dados insuficientes', { exact: true })).toHaveCount(0)
  await expect(dialog.locator('.text-emerald-400').first()).toBeVisible()

  // Tipo "Anúncio" -- log manual de troca de criativo (registra e apaga).
  const video = variantCard('Teste A/B — Vídeo')
  const note = `troquei pro criativo novo ${RUN_ID}`
  await expect(video.getByText('Log de troca de anúncio', { exact: true })).toBeVisible()
  await video.getByRole('button', { name: 'Registrar' }).click()
  await video.getByPlaceholder(/troquei pra anúncio/).fill(note)
  await video.getByRole('button', { name: 'Salvar' }).click()
  await expect(video.getByText(note, { exact: false })).toBeVisible()
  await video
    .getByText(note, { exact: false })
    .locator('xpath=ancestor::*[.//button][1]')
    .getByRole('button')
    .filter({ has: page.locator('.lucide-trash-2') })
    .first()
    .click()
  await expect(video.getByText(note, { exact: false })).toHaveCount(0)
})

test('item 19 -- Catálogo: vincular criativo a uma variante do Teste A/B mostra o resultado herdado; apagar sem confirmação', async ({ page }) => {
  const admin = await getAuthenticatedClient('admin')
  const entryContent = `Criativo teste grupo ${RUN_ID}`
  const { error } = await admin.from('catalog_entries').insert({
    client_id: clientId,
    catalog_type: 'criativo',
    tipo: 'headline',
    conteudo: entryContent,
    origem: 'manual',
    status: 'rascunho',
    prioridade: 'media',
  })
  if (error) throw error

  await loginAs(page, 'gestor')
  await page.goto(`/clients/${clientId}`)

  const row = page.locator('div.rounded-lg', { hasText: entryContent })
  await row.getByRole('combobox').click()
  await page.getByRole('option', { name: `${PROJECT_TITLE} — Teste A/B — Vídeo` }).click()

  await row.getByText('Rascunho', { exact: true }).click()
  await page.getByRole('menuitem', { name: 'Em Teste' }).click()
  await expect(row.getByText(/Acima da média|Abaixo da média|CPA/).first()).toBeVisible({ timeout: 10_000 })

  // Apagar sem diálogo de confirmação (padrão do card por cliente).
  await row.getByRole('button').filter({ has: page.locator('.lucide-trash-2') }).click()
  await expect(page.getByText(entryContent, { exact: true })).not.toBeVisible()
  await expect(page.getByRole('dialog', { name: /Apagar|Confirma/ })).not.toBeVisible()
})
