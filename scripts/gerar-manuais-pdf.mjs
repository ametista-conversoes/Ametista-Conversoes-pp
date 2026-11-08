// Gera os PDFs dos manuais (cliente e gestor) a partir do HTML, com o
// Chromium do Playwright. Uso: node scripts/gerar-manuais-pdf.mjs <pasta-html> <pasta-saida>
import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const [htmlDir, outDir] = process.argv.slice(2).map((p) => resolve(p))
const logo = `data:image/png;base64,${readFileSync(resolve('public/logo.png')).toString('base64')}`
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage()
for (const [file, out] of [
  ['manual-cliente.html', 'Manual do Cliente - App Ametista Conversões.pdf'],
  ['manual-gestor.html', 'Manual do Gestor - App Ametista Conversões.pdf'],
]) {
  const src = join(htmlDir, file)
  const tmp = join(htmlDir, `_${file}`)
  writeFileSync(tmp, readFileSync(src, 'utf-8').replaceAll('src="LOGO"', `src="${logo}"`))
  await page.goto(pathToFileURL(tmp).href)
  await page.pdf({
    path: join(outDir, out),
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate:
      '<div style="width:100%;font-size:8px;color:#9ca3af;text-align:center;font-family:Arial">Ametista Conversões · <span class="pageNumber"></span>/<span class="totalPages"></span></div>',
  })
  console.log('ok', out)
}
await browser.close()
