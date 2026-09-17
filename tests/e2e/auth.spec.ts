import { expect, test } from '@playwright/test'
import { loginAs } from './fixtures.js'

test('login, navega até uma página e faz logout', async ({ page }) => {
  await loginAs(page, 'gestor')

  await page.getByRole('link', { name: 'Clientes' }).click()
  await expect(page).toHaveURL(/\/clients$/)
  await expect(page.getByRole('heading', { name: 'Clientes' })).toBeVisible()

  await page.getByLabel('Menu do usuário').click()
  await page.getByRole('menuitem', { name: 'Sair' }).click()
  // "Sair" no menu só abre a confirmação ("Sair da sua conta?") — o
  // logout de verdade só acontece depois de confirmar no diálogo.
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page).toHaveURL(/\/login$/)
})
