import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// roadmap F2, «Starters y capacidades»: @wasichai/gis con maplibre-gl 6.10.0 y @wasichai/workflow; React Hook Form y Zod;
// ECharts 6 en los tableros de módulo; Playwright desde F2 (ASM-066). F3 suma @wasichai/documents y @wasichai/automation, los
// paquetes de interfaz de los starters de documentos y automatizaciones. toda versión va fijada, sin rangos, como en F1
const leer = (ruta: string) => JSON.parse(readFileSync(ruta, 'utf8')) as Record<string, Record<string, string>>
const paquete = leer('package.json')

describe('dependencias de F2 y F3', () => {
  it.each([
    ['@wasichai/gis', '1.0.0'],
    ['@wasichai/workflow', '1.0.0'],
    ['@wasichai/documents', '1.0.0'],
    ['@wasichai/automation', '1.0.0'],
    ['maplibre-gl', '6.10.0'],
    ['echarts', '6.1.0'],
    ['react-hook-form', '7.89.0'],
    ['zod', '4.6.5'],
    ['@hookform/resolvers', '5.9.1']
  ])('%s va fijada en %s', (nombre, version) => {
    expect(paquete.dependencies[nombre]).toBe(version)
  })

  it('Playwright va fijado en las de desarrollo', () => {
    expect(paquete.devDependencies['@playwright/test']).toBe('1.63.0')
  })

  it('ninguna dependencia usa un rango', () => {
    const rangos = Object.entries({ ...paquete.dependencies, ...paquete.devDependencies }).filter(([, version]) => !/^\d+\.\d+\.\d+$/.test(version))
    expect(rangos).toEqual([])
  })

  it('maplibre-gl es la misma versión que fija @wasichai/gis', () => {
    expect(leer('node_modules/@wasichai/gis/package.json').dependencies['maplibre-gl']).toBe(paquete.dependencies['maplibre-gl'])
    expect(leer('node_modules/maplibre-gl/package.json').version).toBe('6.10.0')
  })

  it('todos los @wasichai/* van en la misma versión', () => {
    const versiones = new Set(
      Object.entries({ ...paquete.dependencies, ...paquete.devDependencies })
        .filter(([nombre]) => nombre.startsWith('@wasichai/'))
        .map(([, v]) => v)
    )
    expect([...versiones]).toEqual(['1.0.0'])
  })
})

// F8 (plan 8.3, decisión 8): la extensión oficial de Markdown de tiptap y los paquetes que el editor importa, fijados en la
// misma versión que trae @wasichai/documents
describe('dependencias de F8', () => {
  it.each(['@tiptap/markdown', '@tiptap/core', '@tiptap/pm', '@tiptap/react', '@tiptap/starter-kit'])('%s va fijada en 3.31.3', (nombre) => {
    expect(paquete.dependencies[nombre]).toBe('3.31.3')
  })

  it('es la versión de tiptap que trae @wasichai/documents', () => {
    expect(leer('node_modules/@wasichai/documents/package.json').dependencies['@tiptap/core']).toBe('3.31.3')
  })
})
