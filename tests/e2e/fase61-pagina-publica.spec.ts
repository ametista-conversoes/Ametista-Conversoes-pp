import { expect, test, type Page } from '@playwright/test'

/** Rola a página inteira devagar: as seções só aparecem (animação) quando
 * entram na tela — sem isso o print de página inteira sai vazio. */
async function scrollThrough(page: Page) {
  const height = await page.evaluate<number>('document.documentElement.scrollHeight')
  for (let y = 0; y < height; y += 400) {
    await page.mouse.wheel(0, 400)
    await page.waitForTimeout(120)
  }
  await page.waitForTimeout(1500)
}

// Fase 61 — página pública "/" (vitrine do app para o cliente). O que a
// verificação OAuth do Google exige não pode sumir: descrição "só leitura",
// links de Privacidade/Termos e o bloco em inglês.
test('página pública mantém o exigido pelo Google e leva ao site e ao WhatsApp', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('acompanhar seu crescimento')
  await expect(page.getByText('O aplicativo nunca cria, edita ou exclui anúncios.')).toBeVisible()
  await expect(page.getByText('About (English)')).toBeVisible()
  for (const name of ['Política de Privacidade (PT)', 'Privacy Policy (EN)', 'Termos de Uso (PT)', 'Terms of Use (EN)']) {
    await expect(page.getByRole('link', { name })).toBeVisible()
  }
  await expect(page.getByRole('link', { name: 'Conhecer a Ametista' })).toHaveAttribute('href', 'https://www.ametistaconversoes.com')
  await expect(page.getByRole('link', { name: 'Conhecer os planos' })).toHaveAttribute('href', 'https://www.ametistaconversoes.com/#planos')
  await expect(page.getByRole('link', { name: 'Chamar no WhatsApp' })).toHaveAttribute('href', /^https:\/\/wa\.me\/559294607030/)
  await expect(page.getByRole('link', { name: 'Entrar' }).first()).toHaveAttribute('href', '/login')

  await scrollThrough(page)
  await page.screenshot({ path: 'test-results/fase61-landing-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await scrollThrough(page)
  // Sem rolagem horizontal no celular.
  expect(await page.evaluate<number>('document.documentElement.scrollWidth')).toBeLessThanOrEqual(390)
  await page.screenshot({ path: 'test-results/fase61-landing-mobile.png', fullPage: true })
})
