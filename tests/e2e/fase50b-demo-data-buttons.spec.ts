import { expect, test } from '@playwright/test'
import { loginAs } from './fixtures.js'

// Sem afterAll de limpeza: antes ele apagava o cadastro da Clínica Sorriso
// (deixando o demo inutilizável pros outros testes e pros testes manuais).
// O teste agora termina com "Recriar", deixando os 2 clientes demo prontos.

test('botões "Recriar"/"Remover" dados de demonstração funcionam de ponta a ponta', async ({ page }) => {
  // Fase 50.D: /recreate agora popula os 2 clientes demo (Clínica
  // Sorriso + Loja Aurora, ~25s) — bem mais que os ~poucos segundos de
  // quando só a Clínica Sorriso existia.
  test.setTimeout(180_000)
  await loginAs(page, 'admin')
  await page.goto('/settings')

  await page.getByRole('tab', { name: 'Globais' }).click()
  await page.getByRole('button', { name: 'Recriar dados de demonstração' }).click()
  await expect(page.getByText('Dados de demonstração recriados.')).toBeVisible({ timeout: 45_000 })

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

  // Deixa os dados demo de volta no fim — os outros testes (fase50c/50d,
  // item18-19) e os testes manuais dependem deles.
  await page.goto('/settings')
  await page.getByRole('tab', { name: 'Globais' }).click()
  await page.getByRole('button', { name: 'Recriar dados de demonstração' }).click()
  await expect(page.getByText('Dados de demonstração recriados.')).toBeVisible({ timeout: 90_000 })
})
