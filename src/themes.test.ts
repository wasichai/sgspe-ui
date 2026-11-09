import { BUILT_IN_THEMES } from '@wasichai/core'
import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import html from '../index.html?raw'

// vitest entrega vacío todo .css, también con ?raw: las hojas se leen del disco
const hoja = (ruta: string) => readFileSync(join(import.meta.dirname, ruta), 'utf8')
const indexCss = hoja('index.css')
const tokens = hoja('theme/tokens.css')
const puente = hoja('theme/wasichai.css')
const wasichaiTheme = readFileSync(createRequire(import.meta.url).resolve('@wasichai/ui/theme.css'), 'utf8')

// el script de arranque de index.html, corrido contra un tema guardado en sgspe.theme y el ajuste del sistema operativo,
// antes de que cargue el bundle
function boot(stored: string | null, systemDark = false, densidad: string | null = null) {
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1]
  if (!script) throw new Error('index.html no tiene el script de arranque')
  const root = { dataset: {} as Record<string, string>, style: {} as Record<string, string> }
  const run = new Function('localStorage', 'matchMedia', 'document', script)
  const guardado: Record<string, string | null> = { 'sgspe.theme': stored, 'sgspe.densidad': densidad }
  run({ getItem: (key: string) => guardado[key] ?? null }, () => ({ matches: systemDark }), { documentElement: root })
  return { theme: root.dataset.theme, colorScheme: root.style.colorScheme, density: root.dataset.density }
}

describe('temas', () => {
  // sgspe no registra temas propios (config.themes): claro y oscuro de core, y el script no puede importarlos
  it('core trae claro y oscuro, los mismos que conoce el script de arranque', () => {
    expect(BUILT_IN_THEMES.map(({ id, colorScheme }) => [id, colorScheme])).toEqual([
      ['light', 'light'],
      ['dark', 'dark']
    ])
  })

  it.each(BUILT_IN_THEMES)('arranca $id con su esquema de color, antes del bundle', ({ id, colorScheme }) => {
    expect(boot(id)).toEqual({ theme: id, colorScheme, density: undefined })
  })

  it.each([null, 'system', 'portal-tributario', 'toString', '__proto__'])('arranca %s con el ajuste del sistema operativo', (stored) => {
    expect(boot(stored)).toEqual({ theme: 'light', colorScheme: 'light', density: undefined })
    expect(boot(stored, true)).toEqual({ theme: 'dark', colorScheme: 'dark', density: undefined })
  })

  // la densidad compacta (ADR-0032, design-system.md §3.5) se escribe antes de pintar, como el tema, para que nada salte
  it.each([
    ['compacta', 'compact'],
    ['normal', undefined],
    [null, undefined],
    ['compact', undefined],
    ['toString', undefined]
  ])('arranca con la densidad guardada %s', (guardada, density) => {
    expect(boot('light', false, guardada).density).toBe(density)
  })
})

// el bloque de un selector: lo que va entre su llave y la llave que lo cierra
const bloque = (css: string, selector: string) => {
  const inicio = css.indexOf(selector)
  if (inicio < 0) throw new Error(`no está el bloque ${selector}`)
  return css.slice(css.indexOf('{', inicio) + 1, css.indexOf('}', inicio))
}
// las variables que declara un bloque
const declaradas = (css: string) => new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]))

// "Civic Modern" (ASM-149, ADR-0032, docs/ux/design-system.md §3.9 y §9): los tokens de SGSPE son una capa sobre los de wasichai
describe('Civic Modern', () => {
  const claro = declaradas(bloque(tokens, ':root {'))
  const oscuro = declaradas(bloque(tokens, ':root[data-theme="dark"] {'))
  const correspondencia = Object.fromEntries([...puente.matchAll(/(--[a-z-]+):\s*var\((--sg-[a-z-]+)\)/g)].map((m) => [m[1], m[2]]))

  it('index.css importa tailwind, el tema de wasichai, los tokens de SGSPE y el puente, en ese orden', () => {
    const importa = [...indexCss.matchAll(/@import '([^']+)'/g)].map((m) => m[1])
    expect(importa.slice(0, 4)).toEqual(['tailwindcss', '@wasichai/ui/theme.css', './theme/tokens.css', './theme/wasichai.css'])
  })

  // todos menos --overlay, el velo de los diálogos, que tokens.css no tiene (sigue el de wasichai, oscuro en los dos temas)
  it('cada token de color de @wasichai/ui sale de un token de SGSPE', () => {
    const deWasichai = [...declaradas(bloque(wasichaiTheme, ":root,\n[data-theme='light'] {"))].filter((v) => v !== '--overlay')
    expect(Object.keys(correspondencia).sort()).toEqual(deWasichai.sort())
    expect(Object.values(correspondencia).filter((sg) => !claro.has(sg))).toEqual([])
    // todo lo que declara el bloque oscuro de wasichai lo cubre el puente (puede cubrir más: lo que solo declara el claro)
    const oscuroDeWasichai = [...declaradas(bloque(wasichaiTheme, "[data-theme='dark'] {"))].filter((v) => v !== '--overlay')
    // sin esto, un bloque que no se encontrara declararía cero variables y la comprobación pasaría sin mirar nada
    expect(oscuroDeWasichai.length).toBeGreaterThan(0)
    expect(oscuroDeWasichai.filter((v) => !(v in correspondencia))).toEqual([])
  })

  it('el tema oscuro de SGSPE declara todo lo que lee el puente', () => {
    expect([...new Set(Object.values(correspondencia))].filter((sg) => !oscuro.has(sg))).toEqual([])
  })

  // design-system.md §9: la barra de /admin es la cabecera institucional, el texto sobre el botón destructivo es el propio de
  // danger (en oscuro, danger es rosado y el blanco no se lee) y el foco de wasichai (*:focus-visible lee --brand) es el de E
  it('el puente lleva la cabecera, el texto sobre peligro, el foco y la selección del mapa a los tokens de E', () => {
    expect(correspondencia).toMatchObject({
      '--shell': '--sg-header',
      '--shell-ink': '--sg-header-text',
      '--shell-muted': '--sg-header-text',
      '--on-danger': '--sg-on-danger',
      '--brand': '--sg-primary',
      '--focus': '--sg-focus',
      '--map-selected': '--sg-focus'
    })
  })

  it('Public Sans e IBM Plex Mono, servidas desde el mismo origen y nunca desde otro host (font-src self)', () => {
    const fuentes = [...indexCss.matchAll(/@import '@fontsource\/([a-z-]+)\/(latin(?:-ext)?)-(\d+(?:-italic)?)\.css'/g)].map((m) => `${m[1]} ${m[3]}`)
    const pesos = [
      'public-sans 400',
      'public-sans 400-italic',
      'public-sans 500',
      'public-sans 600',
      'public-sans 700',
      'public-sans 800',
      'ibm-plex-mono 400',
      'ibm-plex-mono 500',
      'ibm-plex-mono 600'
    ]
    // cada peso en latín y en latín extendido (las tildes y la ñ del es-PE, y los nombres quechuas y aimaras)
    expect(fuentes).toEqual(pesos.flatMap((p) => [p, p]))
    const subconjuntos = [...indexCss.matchAll(/@import '@fontsource\/[a-z-]+\/(latin(?:-ext)?)-/g)].map((m) => m[1])
    expect(subconjuntos).toEqual(pesos.flatMap(() => ['latin', 'latin-ext']))
    expect(indexCss).not.toContain('ibm-plex-sans')
    expect(puente).toContain("--font-sans: 'Public Sans'")
    expect(puente).toContain("--font-mono: 'IBM Plex Mono'")
    for (const css of [indexCss, tokens, puente]) expect(css).not.toMatch(/url\(\s*['"]?(https?:)?\/\/|@import\s+(url\()?['"]?(https?:)?\/\//)
  })
})

// DD-15 (docs/ux/redesign/03-direccion-visual-y-design-system.md §2): el borde de los campos, la superficie de lo que flota y los
// tokens de datos como utilidades. vitest no calcula css: se lee la hoja; el contraste lo mide contraste.py de sgspe
describe('borde de control, superficie flotante y tokens de datos', () => {
  const temas = {
    claro: bloque(tokens, ':root {'),
    oscuro: bloque(tokens, ':root[data-theme="dark"] {'),
    sistema: bloque(tokens, ':root:not([data-theme]) {')
  }
  const valor = (css: string, variable: string) => new RegExp(`${variable}:\\s*([^;]+);`).exec(css)?.[1]
  const tema = bloque(tokens, '@theme inline {')

  it('el oscuro es el de wasichai, y el del sistema solo aplica sin data-theme', () => {
    expect(tokens).toContain(':root[data-theme="dark"] {')
    expect(tokens).not.toContain('sgspe-noche')
    expect(tokens).toContain('@media (prefers-color-scheme: dark) {\n  :root:not([data-theme]) {')
    expect(tokens).not.toContain(':not([data-theme="light"])')
    expect([...declaradas(temas.sistema)].sort()).toEqual([...declaradas(temas.oscuro)].sort())
  })

  // design-system.md §10: el borde de control tiene su propio valor en los dos temas, con 3:1 sobre la superficie y el fondo
  it.each([
    ['claro', '#5a6675', '#ffffff'],
    ['oscuro', '#7f8ea1', '#1b2533'],
    ['sistema', '#7f8ea1', '#1b2533']
  ] as const)('en %s, el borde de control es %s y la superficie flotante es %s', (nombre, control, flotante) => {
    expect(valor(temas[nombre], '--sg-border-control')).toBe(control)
    expect(valor(temas[nombre], '--sg-surface-raised')).toBe(flotante)
  })

  it('cada color --sg-* es una utilidad de tailwind, también los de datos, postura, riesgo y suelo del mapa', () => {
    // los colores, en hexadecimal (MapLibre y ECharts no resuelven var() ni oklch); las sombras y las medidas van aparte
    const colores = [...declaradas(temas.claro)].filter((v) => !v.startsWith('--sg-shadow-') && !/px$/.test(valor(temas.claro, v) ?? ''))
    expect(colores.filter((v) => !/^#[0-9a-f]{6}$/.test(valor(temas.claro, v) ?? ''))).toEqual([])
    for (const v of [
      '--sg-border-control',
      '--sg-surface-raised',
      '--sg-data-1',
      '--sg-data-6',
      '--sg-stance-favor',
      '--sg-risk-critical',
      '--sg-map-ground',
      '--sg-heat-4',
      '--sg-lyr-project',
      '--sg-on-danger'
    ])
      expect(colores).toContain(v)
    expect(colores.filter((v) => valor(tema, `--color-${v.slice(2)}`) !== `var(${v})`)).toEqual([])
  })

  // design-system.md §3.5: filas, encabezados, controles, campos, cabecera y navegación son utilidades (h-sg-row…) que la
  // densidad compacta reemplaza en <html data-density="compact">, sin tocar colores ni tipografía
  it('las medidas por densidad son utilidades y la compacta las reemplaza', () => {
    const compacta = bloque(tokens, ':root[data-density="compact"] {')
    for (const m of ['row', 'table-head', 'control', 'field', 'masthead', 'nav']) {
      expect(valor(tema, `--spacing-sg-${m}`)).toBe(`var(--sg-${m})`)
      expect(valor(compacta, `--sg-${m}`)).toBe(`var(--sg-${m}-compact)`)
    }
    expect([...declaradas(compacta)].every((v) => !/color|text|font/.test(v))).toBe(true)
  })

  // desde @wasichai/ui 1.1.0 (W-06 y W-07, wasichai/wasichai-ui#69) los campos, los menús y los diálogos leen sus tokens:
  // el puente los asigna y index.css ya no corrige nada por selector
  it('los campos, los menús y los diálogos de @wasichai/ui leen el borde de control, el ejemplo y la superficie flotante', () => {
    const puenteClaro = bloque(puente, ":root,\n[data-theme='light'],")
    expect(valor(puenteClaro, '--border-control')).toBe('var(--sg-border-control)')
    expect(valor(puenteClaro, '--placeholder')).toBe('var(--sg-text-muted)')
    expect(valor(puenteClaro, '--surface-raised')).toBe('var(--sg-surface-raised)')
    expect(indexCss).not.toContain("[data-slot='input']")
    expect(indexCss).not.toContain('--sg-border-control')
  })
})

// el anillo de foco de E (design-system.md §3.6): halo amarillo de 3 px y anillo marino por fuera, en la capa base de tokens.css,
// que se importa después del tema de wasichai y le gana a su *:focus-visible (misma capa y especificidad). ninguna pantalla
// pinta otro anillo encima con utilidades sueltas
describe('anillo de foco', () => {
  it('tokens.css lo declara para todo lo enfocable, con el halo y el foco del tema', () => {
    expect(tokens).toContain(':where(a, button, input, select, textarea, summary, [tabindex]):focus-visible {\n    outline: 3px solid var(--sg-halo);')
    expect(tokens).toContain('box-shadow: 0 0 0 5px var(--sg-focus);')
    expect(wasichaiTheme).toContain('*:focus-visible {')
  })

  it('ningún componente del portal lo reemplaza por un contorno propio', () => {
    const raiz = join(import.meta.dirname, 'portal')
    const fuentes = (readdirSync(raiz, { recursive: true }) as string[]).filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx'))
    expect(fuentes.length).toBeGreaterThan(50)
    const conContorno = fuentes.filter((f) => /focus-visible:outline-(?!none)|focus-visible:-?outline-offset/.test(readFileSync(join(raiz, f), 'utf8')))
    expect(conContorno).toEqual([])
  })
})
