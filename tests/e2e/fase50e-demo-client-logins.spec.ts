import { expect, test, type Page } from '@playwright/test'

// Fase 50.E — login do Portal do Cliente pros 2 clientes demo. Senha
// fixa + e-mails documentados fora do git (docs/interno/credenciais-demo.local.md)
// — a senha vem de DEMO_LOGIN_PASSWORD em .env.local (igual o secret da
// Edge Function, nunca um literal aqui no código versionado). Não
// reaproveita TEST_ACCOUNTS/loginAs de fixtures.ts (contas diferentes,
// propósito diferente: aqui é o login real de demonstração).
const DEMO_LOGIN_PASSWORD: string = (() => {
  const value = process.env.DEMO_LOGIN_PASSWORD
  if (!value) throw new Error('DEMO_LOGIN_PASSWORD não encontrado — confira o .env.local')
  return value
})()

async function loginDemoClient(page: Page, email: string) {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(DEMO_LOGIN_PASSWORD)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 10_000 })
}

test('login demo@clinicasorriso.com.br entra no Portal do Cliente certo', async ({ page }) => {
  await loginDemoClient(page, 'demo@clinicasorriso.com.br')
  await page.goto('/project')
  await expect(page.getByText('Avaliação Odontológica — Meta Ads')).toBeVisible()
})

test('login demo@lojaaurora.com entra no Portal do Cliente certo', async ({ page }) => {
  await loginDemoClient(page, 'demo@lojaaurora.com')
  await page.goto('/project')
  await expect(page.getByText('E-commerce — Meta + Google Ads')).toBeVisible()
})
