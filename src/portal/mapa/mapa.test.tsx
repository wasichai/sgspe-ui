import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cargarMapas, Map as Falso } from '../../test/maplibre'
import { aUtm, zonaDe } from './utm'
import MapaImpl, { estiloBase } from './MapaImpl'
import type { Coleccion } from './api'

vi.mock('maplibre-gl', () => import('../../test/maplibre'))

beforeEach(() => {
  Falso.todos = []
  document.documentElement.style.setProperty('--sg-data-1', '#2b5f8f')
  document.documentElement.style.setProperty('--sg-data-2', '#c9772b')
  document.documentElement.style.setProperty('--sg-map-ground', '#e8ebe3')
})
afterEach(() => document.documentElement.removeAttribute('style'))

const localidades: Coleccion = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'l1:location',
      geometry: { type: 'Point', coordinates: [-78.1, -8.1] },
      properties: { __id: 'l1', __object: 'locality', name: 'Tunas' }
    },
    {
      type: 'Feature',
      id: 'l2:location',
      geometry: { type: 'Point', coordinates: [-78.3, -8.4] },
      properties: { __id: 'l2', __object: 'locality', name: 'Pampa' }
    }
  ]
}

describe('MapaImpl', () => {
  it('sin mapa base configurado, el fondo es el token apagado y no pide teselas externas', () => {
    expect(estiloBase()).toEqual({ version: 8, sources: {}, layers: [{ id: 'fondo', type: 'background', paint: { 'background-color': '#e8ebe3' } }] })
  })

  it('dibuja cada capa con su color de token, encuadra todo y la selección engrosa el borde', async () => {
    const elegir = vi.fn()
    const { rerender } = render(
      <MapaImpl etiqueta="Mapa" capas={[{ id: 'LYR-02', datos: localidades, color: '--sg-data-1', seleccionable: true }]} alSeleccionar={elegir} />
    )
    expect(screen.getByRole('region', { name: 'Mapa' })).toBeInTheDocument()
    await act(async () => cargarMapas())
    const [mapa] = Falso.todos
    expect(mapa.capas.map((c) => c.id)).toEqual(['LYR-02-relleno', 'LYR-02-linea', 'LYR-02-punto'])
    expect(mapa.capas[2].paint['circle-color']).toBe('#2b5f8f')
    expect(mapa.fitBounds).toHaveBeenCalledWith(
      [
        [-78.3, -8.4],
        [-78.1, -8.1]
      ],
      expect.anything()
    )
    mapa.emitir('click:LYR-02-punto', { features: [{ properties: { __id: 'l2', __object: 'locality' } }] })
    expect(elegir).toHaveBeenCalledWith('l2', 'LYR-02', 'locality')
    rerender(<MapaImpl etiqueta="Mapa" capas={[{ id: 'LYR-02', datos: localidades, color: '--sg-data-1', seleccionable: true }]} seleccion="l2" />)
    expect(mapa.setPaintProperty).toHaveBeenCalledWith('LYR-02-punto', 'circle-radius', [
      'case',
      ['any', ['==', ['get', '__id'], 'l2'], ['==', ['get', '__targetId'], 'l2']],
      8,
      5
    ])
  })

  // LYR-13 (api.md §4.2): además de las áreas aprobadas trae sus miembros, con __target y __targetId
  it('los miembros de un área tienen su propio dibujo y elegir uno lleva al lugar que dibuja', async () => {
    const areas: Coleccion = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 'a1:boundary',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [-78.4, -8.4],
                [-78, -8.4],
                [-78, -8],
                [-78.4, -8.4]
              ]
            ]
          },
          properties: { __id: 'a1', __object: 'area_of_influence', area_type: 'AIDS' }
        },
        {
          type: 'Feature',
          id: 'm1:location',
          geometry: { type: 'Point', coordinates: [-78.1, -8.1] },
          properties: { __id: 'm1', __object: 'area_of_influence_member', __target: 'locality', __targetId: 'l1', member_condition: 'INCLUIDO' }
        }
      ]
    }
    const elegir = vi.fn()
    render(
      <MapaImpl etiqueta="Mapa" capas={[{ id: 'LYR-13', datos: areas, color: '--sg-data-1', seleccionable: true, miembros: true }]} alSeleccionar={elegir} />
    )
    await act(async () => cargarMapas())
    const [mapa] = Falso.todos
    expect(mapa.capas.map((c) => c.id)).toEqual([
      'LYR-13-relleno',
      'LYR-13-linea',
      'LYR-13-punto',
      'LYR-13-miembro-relleno',
      'LYR-13-miembro-linea',
      'LYR-13-miembro-punto'
    ])
    expect(mapa.capas[4].paint['line-dasharray']).toEqual([2, 2])
    mapa.emitir('click:LYR-13-miembro-punto', { features: [{ properties: areas.features[1].properties }] })
    expect(elegir).toHaveBeenCalledWith('l1', 'LYR-13', 'locality')
    mapa.emitir('click:LYR-13-relleno', { features: [{ properties: areas.features[0].properties }] })
    expect(elegir).toHaveBeenLastCalledWith('a1', 'LYR-13', 'area_of_influence')
  })

  it('al cambiar de tema repinta con los tokens nuevos', async () => {
    render(<MapaImpl etiqueta="Mapa" capas={[{ id: 'LYR-07', datos: localidades, color: '--sg-data-2', seleccionable: false }]} />)
    await act(async () => cargarMapas())
    document.documentElement.style.setProperty('--sg-data-2', '#d9a35b')
    await act(async () => {
      document.documentElement.setAttribute('data-theme', 'dark')
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(Falso.todos[0].setPaintProperty).toHaveBeenCalledWith('LYR-07-punto', 'circle-color', '#d9a35b')
    document.documentElement.removeAttribute('data-theme')
  })

  it('informa el encuadre visible para pedir las capas por bbox', async () => {
    const mover = vi.fn()
    render(<MapaImpl etiqueta="Mapa" capas={[]} alMoverVista={mover} />)
    await act(async () => cargarMapas())
    expect(mover).toHaveBeenCalledWith([-78, -9, -77, -8])
  })
})

// la barra de coordenadas en el CRS de trabajo: comparado con las fórmulas de Snyder (1987), calculadas aparte
describe('aUtm', () => {
  it.each([
    [-77.0428, -12.0464, 18, 277617.453, 8667487.897],
    [-78.5, -7.9, 17, 775649.426, 9125930.327],
    [-70.0, -15.5, 19, 392741.716, 8286120.409],
    [-75, 0, 18, 500000, 10000000]
  ])('(%f, %f) en la zona %i es E %f N %f', (lon, lat, zona, este, norte) => {
    const utm = aUtm(lon, lat, zona)
    expect(utm.este).toBeCloseTo(este, 1)
    expect(utm.norte).toBeCloseTo(norte, 1)
  })

  it('lee la zona del CRS de trabajo del catálogo', () => {
    expect(zonaDe('EPSG 32718')).toBe(18)
    expect(zonaDe('EPSG 24878')).toBeNull()
    expect(zonaDe(null)).toBeNull()
  })
})
