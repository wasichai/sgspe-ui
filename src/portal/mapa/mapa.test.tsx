import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cargarMapas, Map as Falso } from '../../test/maplibre'
import { colorDe } from './colores'
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

  // una capa recortada al tope (truncated) trae siempre el mismo conteo: al acercar, los datos nuevos deben dibujarse
  it('cambia los datos de la fuente cuando llega otra colección con el mismo conteo', async () => {
    const igual = (x: number): Coleccion => ({
      type: 'FeatureCollection',
      truncated: true,
      features: [{ type: 'Feature', id: 'a:location', geometry: { type: 'Point', coordinates: [x, -8] }, properties: { __id: 'a', __object: 'locality' } }]
    })
    const primera = igual(-78)
    const segunda = igual(-77.5)
    const { rerender } = render(<MapaImpl etiqueta="Mapa" capas={[{ id: 'LYR-02', datos: primera, color: '--sg-data-1', seleccionable: false }]} />)
    await act(async () => cargarMapas())
    const [mapa] = Falso.todos
    expect(mapa.fuentes.get('LYR-02')?.data).toBe(primera)
    rerender(<MapaImpl etiqueta="Mapa" capas={[{ id: 'LYR-02', datos: segunda, color: '--sg-data-1', seleccionable: false }]} />)
    expect(mapa.fuentes.get('LYR-02')?.data).toBe(segunda)
  })

  it('encuadra sobre lo elegido una vez; mover el mapa y recibir otras capas no lo devuelve a la selección', async () => {
    const capa = (datos: Coleccion) => [{ id: 'LYR-02', datos, color: '--sg-data-1', seleccionable: true }]
    const { rerender } = render(<MapaImpl etiqueta="Mapa" capas={capa(localidades)} seleccion="l2" />)
    await act(async () => cargarMapas())
    const [mapa] = Falso.todos
    const alElegido = () => mapa.fitBounds.mock.calls.filter(([, o]) => (o as { duration: number }).duration === 300)
    expect(alElegido()).toHaveLength(1)
    expect(alElegido()[0][0]).toEqual([
      [-78.3, -8.4],
      [-78.3, -8.4]
    ])
    // el usuario se desplaza: llegan otros datos (otro conteo y otra colección) con la misma selección
    rerender(
      <MapaImpl
        etiqueta="Mapa"
        capas={capa({ ...localidades, features: [...localidades.features, { ...localidades.features[0], id: 'l3:location' }] })}
        seleccion="l2"
      />
    )
    rerender(<MapaImpl etiqueta="Mapa" capas={capa({ ...localidades })} seleccion="l2" />)
    expect(alElegido()).toHaveLength(1)
    // otra selección sí encuadra de nuevo, y volver a elegir la primera tras quitarla también
    rerender(<MapaImpl etiqueta="Mapa" capas={capa(localidades)} seleccion="l1" />)
    expect(alElegido()).toHaveLength(2)
    rerender(<MapaImpl etiqueta="Mapa" capas={capa(localidades)} seleccion={null} />)
    rerender(<MapaImpl etiqueta="Mapa" capas={capa(localidades)} seleccion="l1" />)
    expect(alElegido()).toHaveLength(3)
  })

  it('encuadra sobre lo elegido cuando su capa llega después de la selección', async () => {
    const capa = (datos: Coleccion) => [{ id: 'LYR-02', datos, color: '--sg-data-1', seleccionable: true }]
    const vacia: Coleccion = { type: 'FeatureCollection', features: [] }
    const { rerender } = render(<MapaImpl etiqueta="Mapa" capas={capa(vacia)} seleccion="l2" />)
    await act(async () => cargarMapas())
    const [mapa] = Falso.todos
    expect(mapa.fitBounds).not.toHaveBeenCalled()
    rerender(<MapaImpl etiqueta="Mapa" capas={capa(localidades)} seleccion="l2" />)
    expect(mapa.fitBounds).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ duration: 300 }))
  })

  it('al desmontar quita el mapa y deja de observar su tamaño', async () => {
    const desconectar = vi.spyOn(globalThis.ResizeObserver.prototype, 'disconnect')
    const { unmount } = render(<MapaImpl etiqueta="Mapa" capas={[]} />)
    await act(async () => cargarMapas())
    const [mapa] = Falso.todos
    unmount()
    expect(mapa.remove).toHaveBeenCalledTimes(1)
    expect(desconectar).toHaveBeenCalled()
    desconectar.mockRestore()
  })

  it('con el tema del sistema repinta el fondo propio y el trazo de los puntos', async () => {
    let avisar: (() => void) | null = null
    const original = window.matchMedia
    window.matchMedia = (() => ({
      addEventListener: (_: string, f: () => void) => (avisar = f),
      removeEventListener: () => (avisar = null)
    })) as unknown as typeof window.matchMedia
    try {
      render(<MapaImpl etiqueta="Mapa" capas={[{ id: 'LYR-07', datos: localidades, color: '--sg-data-2', seleccionable: false }]} />)
      await act(async () => cargarMapas())
      document.documentElement.style.setProperty('--sg-map-ground', '#1b211e')
      document.documentElement.style.setProperty('--sg-surface', '#171d1a')
      act(() => avisar?.())
      const pintura = Falso.todos[0].setPaintProperty
      expect(pintura).toHaveBeenCalledWith('fondo', 'background-color', '#1b211e')
      expect(pintura).toHaveBeenCalledWith('LYR-07-punto', 'circle-stroke-color', '#171d1a')
    } finally {
      window.matchMedia = original
    }
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

  it('lee la zona del CRS de trabajo del catálogo: solo 32717 a 32719', () => {
    expect(zonaDe('EPSG 32718')).toBe(18)
    expect(zonaDe('EPSG 32717')).toBe(17)
    expect(zonaDe('EPSG 32719')).toBe(19)
    for (const crs of ['EPSG 32716', 'EPSG 32720', 'EPSG 32700', 'EPSG 32761']) expect(zonaDe(crs)).toBeNull()
    expect(zonaDe('EPSG 24878')).toBeNull()
    expect(zonaDe(null)).toBeNull()
  })
})

describe('colorDe', () => {
  it('un token sin valor usa el token neutro de respaldo, no un literal', () => {
    document.documentElement.style.setProperty('--sg-data-6', '#838b85')
    expect(colorDe('--sg-no-existe')).toBe('#838b85')
    expect(colorDe('--sg-data-6')).toBe('#838b85')
  })
})
