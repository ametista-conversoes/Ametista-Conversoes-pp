process.loadEnvFile('.env.local')

import { defineConfig, devices } from '@playwright/test'

// Porta do servidor dos testes. Padrão 5173 (a única liberada no CORS das
// Edge Functions). Se outro projeto já estiver ocupando a 5173, rode com
// `E2E_PORT=5180 npx playwright test` — com `reuseExistingServer`, sem isso
// os testes abriam a tela do OUTRO app (login falhando com 400).
const PORT = Number(process.env.E2E_PORT ?? 5173)

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 30_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
