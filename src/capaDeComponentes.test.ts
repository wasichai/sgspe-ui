import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// la capa de componentes de Civic Modern sobre las primitivas de @wasichai/ui (design-system.md §5.3): Button, Alert, los
// campos y los encabezados de tabla se ven como los de E en el portal y en /admin, sin tocar sus fuentes. vitest entrega vacío
// todo .css: la hoja se lee del disco
const hoja = (ruta: string) => readFileSync(join(import.meta.dirname, ruta), 'utf8')
const indexCss = hoja('index.css')
const capa = hoja('theme/componentes.css')

// las reglas de un selector exacto (el primer bloque que lo abre)
const reglas = (selector: string) => {
  const inicio = capa.indexOf(`${selector} {`)
  if (inicio < 0) throw new Error(`no está el bloque ${selector}`)
  return capa.slice(capa.indexOf('{', inicio) + 1, capa.indexOf('}', inicio))
}

describe('capa de componentes de Civic Modern', () => {
  it('index.css la importa después del puente de wasichai', () => {
    const importa = [...indexCss.matchAll(/@import '([^']+)'/g)].map((m) => m[1])
    expect(importa.indexOf('./theme/componentes.css')).toBe(importa.indexOf('./theme/wasichai.css') + 1)
  })

  it('solo lee tokens: ningún color suelto', () => {
    const sinComentarios = capa.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(sinComentarios).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(|oklch\(/i)
    expect(sinComentarios).toMatch(/var\(--sg-/)
  })

  it('el botón mide --sg-control, lleva borde de 2 px, radio de 4 y 700; la primaria, su canto inferior', () => {
    const boton = reglas("[data-slot='button']")
    expect(boton).toContain('border-width: 2px')
    expect(boton).toContain('border-radius: 4px')
    expect(boton).toContain('font-weight: 700')
    expect(capa).toMatch(/\[data-slot='button'\]\[data-size='md'\][^{]*\{[^}]*height: var\(--sg-control\)/)
    expect(reglas("[data-slot='button'][data-variant='primary']")).toContain('box-shadow: 0 2px 0 var(--sg-primary-hover)')
    // la secundaria es de contorno primario y la sutil, un enlace subrayado
    expect(reglas("[data-slot='button'][data-variant='secondary']")).toContain('--border: var(--sg-primary)')
    expect(capa).toMatch(/data-variant='ghost'\][^{]*\{[^}]*text-decoration-line: underline/)
  })

  it('la primaria con el foco vuelve al anillo de E (su canto no tapa el foco)', () => {
    expect(capa).toMatch(/data-variant='primary'\]:focus-visible[^{]*\{[^}]*box-shadow: 0 0 0 5px var\(--sg-focus\)/)
  })

  it('el aviso lleva borde de 2 px, fondo suave e ícono del tono; el de advertencia, --sg-warning-border', () => {
    expect(reglas("[data-slot='alert']")).toContain('border: 2px solid')
    for (const tono of ['danger', 'warning', 'success', 'notice']) expect(capa).toContain(`[data-slot='alert'][data-tone='${tono}']`)
    expect(reglas("[data-slot='alert'][data-tone='warning']")).toContain('border-color: var(--sg-warning-border)')
    expect(reglas("[data-slot='alert']::before")).toContain('mask')
  })

  it('los campos miden --sg-field con borde de 2 px; con error, 3 px de peligro', () => {
    expect(capa).toMatch(/\[data-slot='input'\][^{]*\{[^}]*height: var\(--sg-field\)/)
    expect(capa).toMatch(/\[aria-invalid='true'\][^{]*\{[^}]*border-width: 3px[^}]*border-color: var\(--sg-danger\)/)
  })

  it('el encabezado de tabla va en hundido, 13/700, sin versalitas y con borde inferior de 2 px', () => {
    const th = reglas("[data-slot='table-head']:not([scope='row'])")
    expect(th).toContain('text-transform: none')
    expect(th).toContain('border-bottom: 2px solid var(--sg-border-strong)')
    expect(th).toContain('background-color: var(--sg-surface-sunken)')
  })
})
