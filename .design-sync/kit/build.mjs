// arma la entrada de design-sync desde el código del portal: los tipos con tsc y el CSS del portal (tailwind con los tokens
// sg-*, el tema de @wasichai/ui y las fuentes IBM Plex) más las clases de las previews, que el portal no escanea
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const kit = dirname(fileURLToPath(import.meta.url))
const raiz = join(kit, '..', '..')
const salida = join(kit, 'dist')
const correr = (comando, args) => execFileSync(comando, args, { cwd: raiz, stdio: 'inherit' })

rmSync(salida, { recursive: true, force: true })
mkdirSync(salida, { recursive: true })

// src/index.css visto desde dist/: sus rutas relativas reescritas, sin la exclusión de .design-sync y con las previews
const indice = readFileSync(join(raiz, 'src', 'index.css'), 'utf8')
const exclusion = "@source not '../.design-sync';"
if (!indice.includes(exclusion)) throw new Error(`src/index.css ya no trae ${exclusion}`)
const estilos = indice
  .replace(exclusion, "@source '../../previews';")
  .replaceAll("'./", "'../../../src/")
  .replaceAll("'../node_modules/", "'../../../node_modules/")
writeFileSync(join(salida, 'estilos.css'), estilos)
correr('npx', ['vite', 'build', '--config', join(kit, 'vite.config.ts')])
correr('npx', ['tsc', '-p', join(kit, 'tsconfig.json')])

const activos = join(salida, 'css', 'assets')
const hoja = readdirSync(activos).find((f) => f.endsWith('.css'))
if (!hoja) throw new Error('vite no dejó el CSS del kit')
mkdirSync(join(salida, 'fonts'), { recursive: true })
for (const f of readdirSync(activos).filter((f) => /\.(woff2?|ttf)$/.test(f))) copyFileSync(join(activos, f), join(salida, 'fonts', f))
writeFileSync(join(salida, 'sgspe.css'), readFileSync(join(activos, hoja), 'utf8').replaceAll('url(/assets/', 'url(./fonts/'))
rmSync(join(salida, 'css'), { recursive: true, force: true })
console.log(`kit: ${hoja} -> dist/sgspe.css`)
