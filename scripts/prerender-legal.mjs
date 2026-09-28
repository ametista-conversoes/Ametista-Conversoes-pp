// Roda depois do `vite build` (ver "postbuild" no package.json). O
// build normal serve /privacy e /terms via SPA — o React só monta
// depois do JS carregar, então quem busca a página sem executar
// JavaScript (o crawler de verificação de marca do Google, entre
// outros) vê só `<div id="root"></div>` vazio. Esse script gera uma
// versão estática de cada uma (mesmo componente .tsx, única fonte do
// texto) e escreve como HTML pronto em dist/, que a Vercel serve
// direto (vercel.json já dá prioridade a arquivo real antes de cair
// no fallback de index.html da SPA). Usuário real continua vendo a
// mesma página, o React assume normalmente assim que o JS carrega.
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const ssrOutDir = path.join(root, 'scripts', '.ssr-out')

await build({
  root,
  configFile: false,
  logLevel: 'warn',
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(root, 'src') },
  },
  build: {
    ssr: path.resolve(root, 'scripts/ssr-legal-entry.tsx'),
    outDir: 'scripts/.ssr-out',
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      output: { format: 'es', entryFileNames: 'entry.mjs' },
    },
  },
})

const { renderLegalPage } = await import(pathToFileURL(path.join(ssrOutDir, 'entry.mjs')).href)

const template = await readFile(path.join(root, 'dist/index.html'), 'utf-8')

for (const route of ['/privacy', '/privacy/en', '/terms', '/terms/en']) {
  const appHtml = renderLegalPage(route)
  const finalHtml = template.replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`)
  const outDir = path.join(root, 'dist', route)
  await mkdir(outDir, { recursive: true })
  await writeFile(path.join(outDir, 'index.html'), finalHtml, 'utf-8')
  console.log(`Prerenderizado: dist${route}/index.html (${appHtml.length} caracteres de HTML)`)
}

await rm(ssrOutDir, { recursive: true, force: true })
