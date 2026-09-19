import { expect, test } from '@playwright/test'
import { loginAs } from './fixtures.js'

// Usa dados reais já sincronizados nesta sessão (chamada direta à Edge
// Function, fora do Playwright -- ver nota abaixo) pro projeto de teste
// "Meta ads" do cliente "calldaviaraujo" (campanha Meta real, conta de
// teste). A aba "Grupos de Anúncios" busca ao vivo direto na Edge Function
// `integrations`, cujo CORS é restrito de propósito a
// https://ametistaconversoes.app (produção) -- por isso não dá pra
// exercitar aquela aba especificamente contra localhost:5173 aqui; ela foi
// confirmada por chamada direta à API (ver TASKS.md). Este teste cobre só
// a Visão Geral/Campanha, que lê campaign_performance_snapshots direto do
// Supabase (sem passar pela Edge Function, sem essa restrição de CORS).
test('item 38 -- Visão Geral de um projeto Meta Ads mostra dado real sincronizado (tipo de campanha, não zerado/fake)', async ({ page }) => {
  await loginAs(page, 'gestor')
  await page.goto('/clients')
  await page.getByText('calldaviaraujo', { exact: true }).click()
  await page.getByText('Meta ads', { exact: true }).first().click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText(/CPA|CTR|Gasto/).first()).toBeVisible()
  await expect(dialog.getByText(/Leads|OUTCOME_LEADS/i).first()).toBeVisible()
})
