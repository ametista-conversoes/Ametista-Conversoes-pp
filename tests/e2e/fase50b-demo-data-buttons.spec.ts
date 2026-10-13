import { expect, test } from '@playwright/test'
import { getAuthenticatedClient, loginAs } from './fixtures.js'

test.afterAll(async () => {
  const supabase = await getAuthenticatedClient('admin')
  await supabase.from('clients').delete().eq('name', 'Clínica Sorriso (demo)')
})

test('botões "Recriar"/"Remover" dados de demonstração funcionam de ponta a ponta', async ({ page }) => {
  await loginAs(page, 'admin')
  await page.goto('/settings')

  await page.getByRole('tab', { name: 'Globais' }).click()
  await page.getByRole('button', { name: 'Recriar dados de demonstração' }).click()
  await expect(page.getByText('Dados de demonstração recriados.')).toBeVisible({ timeout: 15_000 })

  // confirma que o cliente-molde nasceu de verdade e aparece em /clients
  await page.goto('/clients')
  await expect(page.getByText('Clínica Sorriso (demo)')).toBeVisible()

  await page.goto('/settings')
  await page.getByRole('tab', { name: 'Globais' }).click()
  await page.getByRole('button', { name: 'Remover dados de demonstração' }).click()
  await expect(page.getByText('Dados de demonstração removidos.')).toBeVisible({ timeout: 15_000 })

  // "Remover" não apaga o cliente-molde, só o dado dele
  await page.goto('/clients')
  await expect(page.getByText('Clínica Sorriso (demo)')).toBeVisible()
})
