import { BUILT_IN_THEMES } from '@wasichai/core'
import { readFileSync } from 'node:fs'
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
function boot(stored: string | null, systemDark = false) {
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1]
  if (!script) throw new Error('index.html no tiene el script de arranque')
  const root = { dataset: {} as Record<string, string>, style: {} as Record<string, string> }
  const run = new Function('localStorage', 'matchMedia', 'document', script)
  run({ getItem: (key: string) => (key === 'sgspe.theme' ? stored : null) }, () => ({ matches: systemDark }), { documentElement: root })
  return { theme: root.dataset.theme, colorScheme: root.style.colorScheme }
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
    expect(boot(id)).toEqual({ theme: id, colorScheme })
  })

  it.each([null, 'system', 'portal-tributario', 'toString', '__proto__'])('arranca %s con el ajuste del sistema operativo', (stored) => {
    expect(boot(stored)).toEqual({ theme: 'light', colorScheme: 'light' })
    expect(boot(stored, true)).toEqual({ theme: 'dark', colorScheme: 'dark' })
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

// "Pino y piedra" (ASM-077, docs/ux/design-system.md §2 y §9): los tokens de SGSPE son una capa sobre los de wasichai
describe('Pino y piedra', () => {
  const claro = declaradas(bloque(tokens, ':root {'))
  const oscuro = declaradas(bloque(tokens, ':root[data-theme="dark"],'))
  const correspondencia = Object.fromEntries([...puente.matchAll(/(--[a-z-]+):\s*var\((--sg-[a-z-]+)\)/g)].map((m) => [m[1], m[2]]))

  it('index.css importa tailwind, el tema de wasichai, los tokens de SGSPE y el puente, en ese orden', () => {
    const importa = [...indexCss.matchAll(/@import '([^']+)'/g)].map((m) => m[1])
    expect(importa.slice(0, 4)).toEqual(['tailwindcss', '@wasichai/ui/theme.css', './theme/tokens.css', './theme/wasichai.css'])
  })

  it('cada token de color de @wasichai/ui sale de un token de SGSPE', () => {
    const deWasichai = [...declaradas(bloque(wasichaiTheme, ":root,\n[data-theme='light'] {"))].filter((v) => v !== '--overlay' && v !== '--map-selected')
    expect(Object.keys(correspondencia).sort()).toEqual(deWasichai.sort())
    expect(Object.values(correspondencia).filter((sg) => !claro.has(sg))).toEqual([])
    // todo lo que declara el bloque oscuro de wasichai lo cubre el puente (puede cubrir más: lo que solo declara el claro)
    const oscuroDeWasichai = [...declaradas(bloque(wasichaiTheme, "[data-theme='dark'] {"))].filter((v) => v !== '--overlay' && v !== '--map-selected')
    // sin esto, un bloque que no se encontrara declararía cero variables y la comprobación pasaría sin mirar nada
    expect(oscuroDeWasichai.length).toBeGreaterThan(0)
    expect(oscuroDeWasichai.filter((v) => !(v in correspondencia))).toEqual([])
  })

  it('el tema oscuro de SGSPE cambia todo lo que lee el puente, salvo el texto blanco sobre pino', () => {
    expect([...new Set(Object.values(correspondencia))].filter((sg) => !oscuro.has(sg))).toEqual(['--sg-on-primary'])
  })

  it('IBM Plex Sans y Plex Mono, servidas desde el mismo origen y nunca desde otro host (font-src self)', () => {
    const fuentes = [...indexCss.matchAll(/@import '@fontsource\/(ibm-plex-[a-z]+)\/latin-(\d+)\.css'/g)].map((m) => `${m[1]} ${m[2]}`)
    expect(fuentes).toEqual(['ibm-plex-sans 400', 'ibm-plex-sans 500', 'ibm-plex-sans 600', 'ibm-plex-mono 400', 'ibm-plex-mono 500'])
    expect(puente).toContain("--font-sans: 'IBM Plex Sans'")
    expect(puente).toContain("--font-mono: 'IBM Plex Mono'")
    for (const css of [indexCss, tokens, puente]) expect(css).not.toMatch(/url\(\s*['"]?(https?:)?\/\/|@import\s+(url\()?['"]?(https?:)?\/\//)
  })
})

// DD-15 (docs/ux/redesign/03-direccion-visual-y-design-system.md §2): el borde de los campos, la superficie de lo que flota y los
// tokens de datos como utilidades. vitest no calcula css: se lee la hoja; el contraste lo mide contraste.py de sgspe
describe('borde de control, superficie flotante y tokens de datos', () => {
  const temas = {
    claro: bloque(tokens, ':root {'),
    oscuro: bloque(tokens, ':root[data-theme="dark"],'),
    sistema: bloque(tokens, ':root:not([data-theme]) {')
  }
  const valor = (css: string, variable: string) => new RegExp(`${variable}:\\s*([^;]+);`).exec(css)?.[1]
  const tema = bloque(tokens, '@theme inline {')

  it('el oscuro es el de wasichai o el de SGSPE, y el del sistema solo aplica sin data-theme', () => {
    expect(tokens).toContain(':root[data-theme="dark"],\n:root[data-theme="sgspe-noche"] {')
    expect(tokens).toContain('@media (prefers-color-scheme: dark) {\n  :root:not([data-theme]) {')
    expect(tokens).not.toContain(':not([data-theme="light"])')
    expect([...declaradas(temas.sistema)].sort()).toEqual([...declaradas(temas.oscuro)].sort())
  })

  // DD-21: en oscuro, el borde fuerte da 2.81:1 sobre la superficie flotante; el de control tiene su propio valor (3.16:1)
  it.each([
    ['claro', 'var(--sg-border-strong)', '#ffffff'],
    ['oscuro', '#66726c', '#1d2420'],
    ['sistema', '#66726c', '#1d2420']
  ] as const)('en %s, el borde de control es %s y la superficie flotante es %s', (nombre, control, flotante) => {
    expect(valor(temas[nombre], '--sg-border-control')).toBe(control)
    expect(valor(temas[nombre], '--sg-surface-raised')).toBe(flotante)
  })

  it('cada color --sg-* es una utilidad de tailwind, también los de datos, postura, riesgo y suelo del mapa', () => {
    const colores = [...declaradas(temas.claro)].filter((v) => !v.startsWith('--sg-shadow-'))
    for (const v of ['--sg-border-control', '--sg-surface-raised', '--sg-data-1', '--sg-data-6', '--sg-stance-favor', '--sg-risk-critical', '--sg-map-ground'])
      expect(colores).toContain(v)
    expect(colores.filter((v) => valor(tema, `--color-${v.slice(2)}`) !== `var(${v})`)).toEqual([])
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
