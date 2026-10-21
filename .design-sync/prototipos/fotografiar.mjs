// fotografía los prototipos del rediseño desde los componentes reales del kit, en claro y oscuro y en español e inglés.
//   node .design-sync/kit/build.mjs && node .design-sync/prototipos/fotografiar.mjs <carpeta de salida> [ids…]
// necesita Chromium (DS_CHROMIUM_PATH, o el de playwright) y la instalación del portal
import { execFileSync } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { VARIANTES } from './variantes.mjs'

const aqui = fileURLToPath(new URL('.', import.meta.url))
const raiz = resolve(aqui, '..', '..')
const salida = resolve(process.argv[2] ?? join(raiz, '.design-sync', '.cache', 'fotos'))
const solo = process.argv.slice(3)
const dist = resolve(aqui, '..', '.cache', 'prototipos')

execFileSync('npx', ['vite', 'build', '--config', join(aqui, 'vite.config.ts')], { cwd: raiz, stdio: 'inherit' })
mkdirSync(salida, { recursive: true })

// el CSS del kit vive fuera de dist: se sirve desde .design-sync/kit/dist
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml' }
const servidor = createServer((pet, res) => {
  const ruta = decodeURIComponent(new URL(pet.url, 'http://x').pathname)
  const candidatos = [join(dist, ruta), join(raiz, '.design-sync', ruta.replace(/^\/kit\//, 'kit/'))]
  const archivo = candidatos.find((c) => existsSync(c) && statSync(c).isFile()) ?? join(dist, 'index.html')
  res.writeHead(200, { 'content-type': tipos[extname(archivo)] ?? 'application/octet-stream' })
  res.end(readFileSync(archivo))
})
await new Promise((r) => servidor.listen(0, '127.0.0.1', r))
const puerto = servidor.address().port

const navegador = await chromium.launch(process.env.DS_CHROMIUM_PATH ? { executablePath: process.env.DS_CHROMIUM_PATH } : {})
let errores = 0
for (const v of VARIANTES.filter((v) => !solo.length || solo.includes(v.p))) {
  const pagina = await navegador.newPage({ viewport: { width: v.ancho ?? 1440, height: v.alto ?? 900 }, locale: v.idioma === 'en' ? 'en-US' : 'es-PE' })
  pagina.on('pageerror', (e) => {
    errores++
    console.error(`! ${v.archivo}: ${String(e).split('\n')[0]}`)
  })
  // el index.html de dist pide ../kit/dist/sgspe.css: se sirve con la ruta /kit/dist/sgspe.css
  await pagina.goto(`http://127.0.0.1:${puerto}/index.html?p=${v.p}&tema=${v.tema}&idioma=${v.idioma}`)
  await pagina.waitForLoadState('networkidle')
  await pagina.waitForTimeout(400)
  await pagina.screenshot({ path: join(salida, `${v.archivo}.png`), fullPage: v.completa ?? true })
  console.log(`✓ ${v.archivo}`)
  await pagina.close()
}
await navegador.close()
servidor.close()
if (errores) process.exit(1)
