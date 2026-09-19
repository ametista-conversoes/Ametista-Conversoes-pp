import { expect, test } from '@playwright/test'
import { getAuthenticatedClient, loginAs } from './fixtures.js'

const RUN_ID = 1789821861
const CLIENT_NAME = `Teste AB ${RUN_ID}`
const P1_TITLE = `P1 Anuncio ${RUN_ID}`
const P2_TITLE = `P2 Segmentacao ${RUN_ID}`
const P3_TITLE = `P3 Sem Teste ${RUN_ID}`
const CLIENT_ID = '8b69a64d-02ff-465c-b372-ea8ea5022d98'

test.afterAll(async () => {
  const admin = await getAuthenticatedClient('admin')
  await admin.from('clients').delete().eq('id', CLIENT_ID)
})

test('item 18 -- gasto mínimo marca "Dados insuficientes", variante melhor que a média é destacada, tipo "Anúncio" mostra log manual', async ({ page }) => {
  await loginAs(page, 'gestor')
  await page.goto('/clients')
  await page.getByText(CLIENT_NAME, { exact: true }).first().click()
  await page.getByText(P1_TITLE, { exact: true }).first().click()

  const dialog = page.getByRole('dialog')
  await dialog.getByRole('tab', { name: 'Testes' }).click()

  function variantCard(name: string) {
    return dialog.getByText(name, { exact: true }).locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]')
  }
  const cardA = variantCard('Variante A')
  await expect(cardA.getByText('Dados insuficientes', { exact: true })).toBeVisible()

  const cardB = variantCard('Variante B')
  const cardC = variantCard('Variante C')
  await expect(cardB.getByText('Dados insuficientes')).not.toBeVisible()
  await expect(cardC.getByText('Dados insuficientes')).not.toBeVisible()
  // B tem CPA 10 e Taxa de Conversão 30% (média elegível de CPA = 20) -- deve
  // vir com destaque verde em pelo menos uma métrica; C (CPA 30, conversão 10%) não.
  await expect(cardB.locator('.text-emerald-400').first()).toBeVisible()
  await expect(cardC.locator('.text-emerald-400')).toHaveCount(0)

  // Tipo "Anúncio" -- log manual de troca de criativo.
  await expect(cardB.getByText('Log de troca de anúncio', { exact: true })).toBeVisible()
  await cardB.getByRole('button', { name: 'Registrar' }).click()
  await cardB.getByPlaceholder(/troquei pra anúncio/).fill('troquei pro criativo novo')
  await cardB.getByRole('button', { name: 'Salvar' }).click()
  await expect(cardB.getByText('troquei pro criativo novo', { exact: false })).toBeVisible()
  await cardB.getByRole('button').filter({ has: page.locator('.lucide-trash-2') }).first().click()
  await expect(cardB.getByText('Nenhuma troca registrada ainda.', { exact: true })).toBeVisible()

  await page.keyboard.press('Escape')
  await page.getByText(P2_TITLE, { exact: true }).click()
  await page.getByRole('dialog').getByRole('tab', { name: 'Testes' }).click()
  await expect(
    page.getByRole('dialog').getByText(/Vincule pelo menos 2 campanhas na aba Campanha pra comparar/),
  ).toBeVisible()
})

test('item 19 -- Catálogo: só projeto com Teste A/B configurado aparece no seletor de Grupo de Teste; vincular mostra resultado herdado; apagar sem confirmação', async ({ page }) => {
  const admin = await getAuthenticatedClient('admin')
  const entryContent = `Criativo teste grupo ${RUN_ID}`
  const { error } = await admin.from('catalog_entries').insert({
    client_id: CLIENT_ID,
    catalog_type: 'criativo',
    tipo: 'headline',
    conteudo: entryContent,
    origem: 'manual',
    status: 'rascunho',
    prioridade: 'media',
  })
  if (error) throw error

  await loginAs(page, 'gestor')
  await page.goto('/clients')
  await page.getByText(CLIENT_NAME, { exact: true }).first().click({ timeout: 60_000 })

  const row = page.locator('div.rounded-lg', { hasText: entryContent })
  await row.getByRole('combobox').click()
  await expect(page.getByRole('option', { name: new RegExp(P1_TITLE) }).first()).toBeVisible()
  await expect(page.getByRole('option', { name: new RegExp(P3_TITLE) })).not.toBeVisible()
  await page.getByRole('option', { name: `${P1_TITLE} — Variante B` }).click()

  await row.getByText('Rascunho', { exact: true }).click()
  await page.getByRole('menuitem', { name: 'Em Teste' }).click()
  await expect(row.getByText(/Acima da média|Abaixo da média|CPA/)).toBeVisible({ timeout: 10_000 })

  // Apagar sem diálogo de confirmação (padrão do card por cliente).
  await row.getByRole('button').filter({ has: page.locator('.lucide-trash-2') }).click()
  await expect(page.getByText(entryContent, { exact: true })).not.toBeVisible()
  await expect(page.getByRole('dialog', { name: /Apagar|Confirma/ })).not.toBeVisible()
})
