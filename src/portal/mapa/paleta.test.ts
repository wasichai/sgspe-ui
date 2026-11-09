import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ESTILOS_PROPIOS, RAMPA_DE_CALOR } from './estilos'
import { capa, dibujoDe } from './capas'
import { ESTILOS_SLD, estiloDeCapa } from './paleta'

// spec F6 §3.3: los colores de los SLD de GeoServer salen de model/styles/palette.json de sgspe y el portal pinta con la misma
// paleta, copiada byte a byte. la CI hace checkout de wasichai/sgspe en .sgspe (SGSPE_REPO) y exige el original
// (SGSPE_PALETA_OBLIGATORIA); en local se compara con ../sgspe si existe. la huella fija la copia: cambiarla sin sincronizar falla
const COPIA = resolve(import.meta.dirname, 'paleta.json')
const REPO = resolve(process.env.SGSPE_REPO ?? join(import.meta.dirname, '..', '..', '..', '..', 'sgspe'))
const ORIGINAL = join(REPO, 'model', 'styles', 'palette.json')
const HUELLA = 'c06a68c9ae7a628abbe1dad04b52fc8128488f84d7d6c1906b033acf2848660f'
const HEX = /^#[0-9a-f]{6}$/i
// un color de capa es un hex de la paleta compartida o un token del tema que colorDe resuelve
const esColor = (c: string) => HEX.test(c) || /^--sg-[a-z0-9-]+$/.test(c)
const TOKENS = readFileSync(resolve(import.meta.dirname, '..', '..', 'theme', 'tokens.css'), 'utf8')
const declaradas = (selector: string) => {
  const inicio = TOKENS.indexOf(selector)
  return new Set([...TOKENS.slice(inicio, TOKENS.indexOf('}', inicio)).matchAll(/(--sg-[a-z0-9-]+)\s*:\s*#/g)].map((m) => m[1]))
}
const TOKENS_CLARO = declaradas(':root {')
const TOKENS_OSCURO = declaradas(':root[data-theme="dark"] {')

describe('paleta compartida', () => {
  it('la copia conserva su huella: se cambia solo copiando de sgspe', () => {
    expect(createHash('sha256').update(readFileSync(COPIA)).digest('hex')).toBe(HUELLA)
  })

  it('es igual, byte a byte, a model/styles/palette.json de sgspe', () => {
    if (!existsSync(ORIGINAL)) {
      expect(process.env.SGSPE_PALETA_OBLIGATORIA, `falta ${ORIGINAL}`).not.toBe('true')
      return
    }
    expect(readFileSync(COPIA).equals(readFileSync(ORIGINAL))).toBe(true)
  })

  it('los nueve estilos de la copia tienen colores hex válidos', () => {
    expect(Object.keys(ESTILOS_SLD)).toHaveLength(9)
    for (const [nombre, estilo] of Object.entries(ESTILOS_SLD)) {
      expect(estilo.stroke, nombre).toMatch(HEX)
      if (estilo.fill) expect(estilo.fill, nombre).toMatch(HEX)
    }
  })

  it('cada capa de LYR-01 a LYR-24 tiene color en la paleta o en estilos.ts, y hay una rampa de calor', () => {
    for (let n = 1; n <= 24; n++) {
      const id = `LYR-${String(n).padStart(2, '0')}`
      expect(estiloDeCapa(id).color, id).toSatisfy(esColor)
      expect(estiloDeCapa(id).fillOpacity).toBeGreaterThanOrEqual(0)
      const enPaleta = Object.values(ESTILOS_SLD).some((e) => e.layer === id)
      expect(enPaleta || id in ESTILOS_PROPIOS, id).toBe(true)
    }
    expect(RAMPA_DE_CALOR.length).toBeGreaterThanOrEqual(2)
    expect(RAMPA_DE_CALOR.every(esColor)).toBe(true)
  })

  // design-system.md §3.3 (paleta cartográfica): las capas sin SLD y el calor siguen al tema con los tokens --sg-lyr-*,
  // --sg-map-*, las escalas de datos y --sg-heat-*, nunca con un hex fijo ni con un tono semántico
  it('las capas sin SLD y la rampa de calor son tokens del mapa o de datos, declarados en los dos temas', () => {
    const propios = [...Object.values(ESTILOS_PROPIOS).map((e) => e.color), ...RAMPA_DE_CALOR]
    expect(propios.filter((c) => !/^--sg-(lyr|map|data|stance|heat|risk)-/.test(c))).toEqual([])
    expect(propios.filter((c) => !TOKENS_CLARO.has(c) || !TOKENS_OSCURO.has(c))).toEqual([])
    expect(RAMPA_DE_CALOR).toEqual(['--sg-heat-1', '--sg-heat-2', '--sg-heat-3', '--sg-heat-4'])
  })

  it('el proyecto, sus accesos y las visitas ya no comparten color; el área de interés y las de influencia se distinguen por su forma', () => {
    const color = (id: string) => estiloDeCapa(id).color
    expect(new Set([color('LYR-09'), color('LYR-12'), color('LYR-18')]).size).toBe(3)
    expect(estiloDeCapa('LYR-09')).toEqual({ color: '--sg-lyr-project', fillOpacity: 0, trazo: [3, 3] })
    expect(estiloDeCapa('LYR-13')).toEqual({ color: '--sg-lyr-project', fillOpacity: 0.12 })
    expect(estiloDeCapa('LYR-12')).toEqual({ color: '--sg-lyr-access', fillOpacity: 0, trazo: [5, 4] })
    expect(color('LYR-08')).toBe('--sg-lyr-water')
    expect(color('LYR-19')).toBe('--sg-data-3')
  })

  it('elige el estilo de LYR-02 por la geometría y el de LYR-16 por la institución, con los tokens de la paleta cartográfica', () => {
    expect(estiloDeCapa('LYR-02', 'Point')).toEqual({ color: '--sg-lyr-place', fillOpacity: 1, hueco: true })
    expect(estiloDeCapa('LYR-02', 'MultiPolygon')).toEqual({ color: '--sg-lyr-place', fillOpacity: 0, trazo: [4, 3] })
    expect(estiloDeCapa('LYR-03', 'Point')).toEqual({ color: '--sg-lyr-place', fillOpacity: 1 })
    expect(estiloDeCapa('LYR-16', 'Point', 'health').color).toBe('--sg-text-secondary')
    expect(estiloDeCapa('LYR-16', 'Point').color).toBe('--sg-lyr-boundary')
    expect(estiloDeCapa('LYR-01')).toEqual({ color: '--sg-lyr-boundary', fillOpacity: 0, trazo: [10, 4, 2, 4] })
    expect(estiloDeCapa('LYR-04')).toEqual({ color: '--sg-map-road', fillOpacity: 0 })
    expect(estiloDeCapa('LYR-05')).toEqual({ color: '--sg-lyr-community', fillOpacity: 0.05 })
    expect(estiloDeCapa('LYR-07')).toEqual({ color: '--sg-lyr-concession', fillOpacity: 0, trazo: [9, 3, 2, 3] })
  })

  // design-system.md §3.3: cada color de la paleta compartida nombra su token, que vale ese hex en el tema claro (los informes son
  // claros) y existe también en el oscuro, en el que el portal lo resuelve; LYR-02 deja el rojo que se confundía con danger
  it('cada color de la paleta compartida es su token en claro y el token existe en los dos temas', () => {
    const claro = new Map(
      [...TOKENS.slice(TOKENS.indexOf(':root {'), TOKENS.indexOf('}', TOKENS.indexOf(':root {'))).matchAll(/--sg-([a-z0-9-]+)\s*:\s*(#[0-9a-f]{6})/gi)].map(
        (m) => [m[1], m[2].toLowerCase()]
      )
    )
    for (const [nombre, estilo] of Object.entries(ESTILOS_SLD)) {
      for (const clave of ['stroke', 'fill', 'label', 'halo'] as const) {
        const hex = estilo[clave]
        if (!hex) continue
        const token = estilo.tokens?.[clave]
        expect(claro.get(token ?? ''), `${nombre}.${clave}`).toBe(hex.toLowerCase())
        expect(TOKENS_OSCURO.has(`--sg-${token}`), `${nombre}.${clave}`).toBe(true)
        expect(token, `${nombre}.${clave}`).not.toMatch(/^(danger|critical|warning|success|info|progress|ai)/)
      }
    }
  })

  it('un punto hueco de la paleta (LYR-02) se dibuja con relleno surface y el color en el borde', () => {
    expect(dibujoDe('LYR-02').hueco).toBe(true)
    expect(dibujoDe('LYR-03').hueco).toBeUndefined()
    expect(capa('LYR-02')!.color).toBe('--sg-lyr-place')
  })
})
