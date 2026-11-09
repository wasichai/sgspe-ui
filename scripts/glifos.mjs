// los glifos SDF del mapa (design-system.md §3.3, wasichai/sgspe-ui#120): MapLibre dibuja los rótulos con glifos PBF que pide
// por `glyphs` y la CSP solo admite el propio origen, así que se generan aquí desde la Public Sans de @fontsource (OFL 1.1) y
// se versionan en public/glifos/, que Vite copia tal cual al build. se vuelven a generar solo si cambian los pesos, los rangos
// o @fontsource/public-sans:
//
//   node scripts/glifos.mjs
//
// fontnik (mapbox/node-fontnik, dependencia de desarrollo) trae binarios N-API para macOS y Linux: no compila nada. cada fuente
// de @fontsource viene partida en los subconjuntos latin y latin-ext (WOFF); cada rango se arma con los glifos de los dos, uno
// tras otro en el mismo PBF, que MapLibre lee como una sola lista (un mensaje protobuf con dos `stacks`)
import { mkdirSync, readFileSync, rmSync, writeFileSync, copyFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const fontnik = require('fontnik')

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const fuentes = join(raiz, 'node_modules/@fontsource/public-sans')
const destino = join(raiz, 'public/glifos')

// el nombre de cada pila (el que nombra `text-font` en mapa/rotulos.ts) y su archivo de @fontsource
export const PILAS = {
  'public-sans-semibold': '600-normal',
  'public-sans-bold': '700-normal',
  'public-sans-extrabold': '800-normal',
  'public-sans-semibold-italic': '600-italic'
}

// latín básico y Latin-1 (á, é, ñ, ¿, ¡), latín extendido A y B, los modificadores (ʼ del quechua y el aimara), los diacríticos
// combinantes, el latín extendido adicional y la puntuación general (rayas, comillas tipográficas, «·»). un carácter fuera de
// estos rangos pide un PBF que no existe: MapLibre lo omite
export const RANGOS = [
  [0, 255],
  [256, 511],
  [512, 767],
  [768, 1023],
  [7680, 7935],
  [8192, 8447]
]

const rango = (font, start, end) =>
  new Promise((resolver, rechazar) => fontnik.range({ font, start, end }, (error, datos) => (error ? rechazar(error) : resolver(datos))))

rmSync(destino, { recursive: true, force: true })
for (const [pila, archivo] of Object.entries(PILAS)) {
  const subconjuntos = ['latin', 'latin-ext'].map((s) => readFileSync(join(fuentes, `files/public-sans-${s}-${archivo}.woff`)))
  mkdirSync(join(destino, pila), { recursive: true })
  for (const [inicio, fin] of RANGOS) {
    const partes = await Promise.all(subconjuntos.map((font) => rango(font, inicio, fin)))
    writeFileSync(join(destino, pila, `${inicio}-${fin}.pbf`), Buffer.concat(partes))
  }
}
// la licencia de la fuente viaja con los glifos
copyFileSync(join(fuentes, 'LICENSE'), join(destino, 'OFL.txt'))
console.log(`glifos en ${destino}`)
