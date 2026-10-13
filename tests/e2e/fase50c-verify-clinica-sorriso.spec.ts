import { expect, test } from '@playwright/test'
import { getAuthenticatedClient, loginAs } from './fixtures.js'

let clientId: string

test.beforeAll(async () => {
  const supabase = await getAuthenticatedClient('admin')
  const { data } = await supabase.from('clients').select('id').eq('name', 'Clínica Sorriso (demo)').single()
  clientId = data!.id
})

test('Central de Informações mostra o cliente com os dados gerados', async ({ page }) => {
  await loginAs(page, 'gestor')
  await page.goto(`/clients/${clientId}`)
  await expect(page.getByText('Demonstração').first()).toBeVisible()
  await expect(page.getByText('Validação').first()).toBeVisible()
  // metas smart
  await expect(page.getByText('Gerar 120 leads no mês')).toBeVisible()
})

test('Catálogo mostra os criativos e o vínculo com o teste A/B vencedor', async ({ page }) => {
  await loginAs(page, 'gestor')
  await page.goto('/catalog')
  await expect(page.getByText('Avaliação grátis essa semana')).toBeVisible()
  await expect(page.getByText('Vídeo — "Sorriso novo em até 6 meses"')).toBeVisible()
  await expect(page.getByText('Avaliação Odontológica — Meta Ads — Teste A/B — Vídeo')).toBeVisible()
})

test('Projeto mostra o teste A/B vídeo x carrossel com o vídeo vencendo', async ({ page }) => {
  await loginAs(page, 'gestor')
  await page.goto(`/clients/${clientId}`)
  await page.getByText('Avaliação Odontológica — Meta Ads').click()
  await page.getByRole('tab', { name: 'Testes' }).click()
  await expect(page.getByText('Teste A/B — Vídeo')).toBeVisible()
  await expect(page.getByText('Teste A/B — Carrossel')).toBeVisible()
})

test('Análises do Gestor mostra 3 publicadas, uma por mês', async ({ page }) => {
  await loginAs(page, 'gestor')
  await page.goto(`/clients/${clientId}`)
  await page.getByRole('button', { name: 'Ver histórico' }).click()
  await expect(page.getByText('Melhor mês até aqui').first()).toBeVisible()
  await expect(page.getByText('Primeiro mês cheio de veiculação').first()).toBeVisible()
  await expect(page.getByText('Mês de lançamento').first()).toBeVisible()
})
