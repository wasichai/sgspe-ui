import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// roadmap F2, «Starters y capacidades»: @wasichai/gis con maplibre-gl 6.10.0 y @wasichai/workflow; React Hook Form y Zod;
// ECharts 6 en los tableros de módulo; Playwright desde F2 (ASM-066). toda versión va fijada, sin rangos, como en F1
const leer = (ruta: string) => JSON.parse(readFileSync(ruta, 'utf8')) as Record<string, Record<string, string>>
const paquete = leer('package.json')

describe('dependencias de F2', () => {
  it.each([
    ['@wasichai/gis', '0.5.1'],
    ['@wasichai/workflow', '0.5.1'],
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
    expect([...versiones]).toEqual(['0.5.1'])
  })
})
