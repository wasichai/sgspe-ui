import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ESTILOS_PROPIOS, RAMPA_DE_CALOR } from './estilos'
import { ESTILOS_SLD, estiloDeCapa } from './paleta'

// spec F6 §3.3: los colores de los SLD de GeoServer salen de model/styles/palette.json de sgspe y el portal pinta con la misma
// paleta, copiada byte a byte. la CI hace checkout de wasichai/sgspe en .sgspe (SGSPE_REPO) y exige el original
// (SGSPE_PALETA_OBLIGATORIA); en local se compara con ../sgspe si existe. la huella fija la copia: cambiarla sin sincronizar falla
const COPIA = resolve(import.meta.dirname, 'paleta.json')
const REPO = resolve(process.env.SGSPE_REPO ?? join(import.meta.dirname, '..', '..', '..', '..', 'sgspe'))
const ORIGINAL = join(REPO, 'model', 'styles', 'palette.json')
const HUELLA = 'b4c0f59e0b6c20114e0930c516992541d3b3da8a2619f5847fa2f52462317333'
const HEX = /^#[0-9a-f]{6}$/i

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

  it('cada capa de LYR-01 a LYR-16 tiene color en la paleta o en estilos.ts, y hay una rampa de calor', () => {
    for (let n = 1; n <= 16; n++) {
      const id = `LYR-${String(n).padStart(2, '0')}`
      expect(estiloDeCapa(id).color, id).toMatch(HEX)
      expect(estiloDeCapa(id).fillOpacity).toBeGreaterThanOrEqual(0)
      const enPaleta = Object.values(ESTILOS_SLD).some((e) => e.layer === id)
      expect(enPaleta || id in ESTILOS_PROPIOS, id).toBe(true)
    }
    expect(RAMPA_DE_CALOR.length).toBeGreaterThanOrEqual(2)
    expect(RAMPA_DE_CALOR.every((c) => HEX.test(c))).toBe(true)
  })

  it('elige el estilo de LYR-02 por la geometría y el de LYR-16 por la institución', () => {
    expect(estiloDeCapa('LYR-02', 'Point')).toEqual({ color: '#b8452e', fillOpacity: 1 })
    expect(estiloDeCapa('LYR-02', 'MultiPolygon')).toEqual({ color: '#b8452e', fillOpacity: 0.08 })
    expect(estiloDeCapa('LYR-16', 'Point', 'health').color).toBe('#b0234a')
    expect(estiloDeCapa('LYR-16', 'Point').color).toBe('#2f5d9a')
    expect(estiloDeCapa('LYR-01')).toEqual({ color: '#5f5a6b', fillOpacity: 0, trazo: [6, 3] })
    expect(estiloDeCapa('LYR-07')).toMatchObject({ color: '#9a6a00', colorDeRelleno: '#d9a400', trazo: [4, 2] })
  })
})
