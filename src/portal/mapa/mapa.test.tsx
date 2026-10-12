import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cargarMapas, Map as Falso } from '../../test/maplibre'
import { colorDe } from './colores'
import { aUtm, zonaDe } from './utm'
import MapaImpl, { estiloDe } from './MapaImpl'
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
  it('sin mapa base el fondo es el token apagado; un ráster y un estilo se dibujan como los da el servidor', () => {
    expect(estiloDe({ type: 'none' }, '#e8ebe3')).toEqual({
      version: 8,
      sources: {},
      layers: [{ id: 'fondo', type: 'background', paint: { 'background-color': '#e8ebe3' } }]
    })
    expect(estiloDe({ type: 'style', url: 'https://mapas.example/estilo.json' }, '#e8ebe3')).toBe('https://mapas.example/estilo.json')
    expect(estiloDe({ type: 'raster', tiles: ['https://t.example/{z}/{x}/{y}.png'], attribution: '© Ejemplo' }, '#e8ebe3')).toEqual({
      version: 8,
      sources: { basemap: { type: 'raster', tiles: ['https://t.example/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© Ejemplo' } },
      layers: [
        { id: 'fondo', type: 'background', paint: { 'background-color': '#e8ebe3' } },
        { id: 'basemap', type: 'raster', source: 'basemap' }
      ]
    })
  })

  it('el mapa se crea con el estilo de su prop basemap', async () => {
    render(<MapaImpl etiqueta="Mapa" capas={[]} basemap={{ type: 'style', url: 'https://mapas.example/estilo.json' }} />)
    expect(Falso.todos[0].opciones.style).toBe('https://mapas.example/estilo.json')
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

  // revisión final del plan 6.3, m1: sin vista fijada no se informa nada (las capas no se piden sin bbox ni con la vista del Perú
  // que el encuadre va a cambiar), y un mapa que sigue la vista no se encuadra a sus datos, que dependen de ella
  it('un mapa que sigue la vista espera la de la pantalla, se encuadra a ella, la informa una vez y no salta a sus datos', async () => {
    const mover = vi.fn()
    const capa = (datos: Coleccion) => [{ id: 'LYR-02', datos, color: '--sg-data-1', seleccionable: true }]
    const { rerender } = render(<MapaImpl etiqueta="Mapa" capas={[]} alMoverVista={mover} vistaInicial="esperar" />)
    await act(async () => cargarMapas())
    const [mapa] = Falso.todos
    // mientras la pantalla no sabe la vista, moverse tampoco informa
    mapa.emitir('moveend')
    expect(mover).not.toHaveBeenCalled()
    expect(mapa.fitBounds).not.toHaveBeenCalled()
    rerender(<MapaImpl etiqueta="Mapa" capas={[]} alMoverVista={mover} vistaInicial={[-78.4, -8.5, -78, -8]} />)
    expect(mapa.fitBounds).toHaveBeenCalledTimes(1)
    expect(mapa.fitBounds).toHaveBeenCalledWith(
      [
        [-78.4, -8.5],
        [-78, -8]
      ],
      expect.objectContaining({ maxZoom: 12, duration: 0 })
    )
    expect(mover).toHaveBeenCalledTimes(1)
    expect(mover).toHaveBeenCalledWith([-78, -9, -77, -8])
    // llegan las capas de esa vista y otra vista inicial: ni se encuadra a los datos ni se vuelve a fijar
    rerender(<MapaImpl etiqueta="Mapa" capas={capa(localidades)} alMoverVista={mover} vistaInicial={[-70, -10, -69, -9]} />)
    expect(mapa.fitBounds).toHaveBeenCalledTimes(1)
    expect(mover).toHaveBeenCalledTimes(1)
    // después, cada movimiento informa su vista
    mapa.emitir('moveend')
    expect(mover).toHaveBeenCalledTimes(2)
  })

  it('sin encuadre de la pantalla, un mapa que sigue la vista abre sobre el Perú entero', async () => {
    const mover = vi.fn()
    render(<MapaImpl etiqueta="Mapa" capas={[]} alMoverVista={mover} vistaInicial={null} />)
    await act(async () => cargarMapas())
    expect(Falso.todos[0].fitBounds).toHaveBeenCalledWith(
      [
        [-81.4, -18.4],
        [-68.6, 0.1]
      ],
      expect.objectContaining({ duration: 0 })
    )
    expect(mover).toHaveBeenCalledTimes(1)
  })

  it('nace en la cámara del mapa anterior: no se encuadra a sus datos e informa esa misma vista', async () => {
    const mover = vi.fn()
    const camara = vi.fn()
    render(
      <MapaImpl
        etiqueta="Mapa"
        capas={[{ id: 'LYR-02', datos: localidades, color: '--sg-data-1', seleccionable: true }]}
        alMoverVista={mover}
        vistaInicial={[-78.4, -8.5, -78, -8]}
        camaraPrevia={() => ({ centro: [-77.5, -8.5], zoom: 9 })}
        alMoverCamara={camara}
      />
    )
    const [mapa] = Falso.todos
    expect(mapa.opciones).toMatchObject({ center: [-77.5, -8.5], zoom: 9 })
    await act(async () => cargarMapas())
    expect(mapa.fitBounds).not.toHaveBeenCalled()
    expect(mover).toHaveBeenCalledWith([-78, -9, -77, -8])
    mapa.emitir('moveend')
    expect(camara).toHaveBeenCalledWith({ centro: [-77.5, -8.5], zoom: 9 })
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

  it('un color hex de la paleta se pinta tal cual, con su relleno y su trazo discontinuo', async () => {
    render(<MapaImpl etiqueta="Mapa" capas={[{ id: 'LYR-01', datos: localidades, color: '#5f5a6b', relleno: 0, trazo: [6, 3], seleccionable: false }]} />)
    await act(async () => cargarMapas())
    const [mapa] = Falso.todos
    const relleno = mapa.capas.find((c) => c.id === 'LYR-01-relleno')!
    const linea = mapa.capas.find((c) => c.id === 'LYR-01-linea')!
    expect(relleno.paint['fill-color']).toBe('#5f5a6b')
    expect(relleno.paint['fill-opacity']).toBe(0)
    expect(linea.paint['line-dasharray']).toEqual([6, 3])
    expect(colorDe('#5f5a6b')).toBe('#5f5a6b')
  })

  const URL_WMS = 'https://sgspe.example/api/sgspe/territory/wms?service=WMS&version=1.1.1&request=GetMap&layers=t_c&styles=sgspe-lyr-05'

  it('una capa WMS es un ráster de wmsTileUrl debajo de las capas GeoJSON, y se quita al apagarla', async () => {
    const { rerender } = render(
      <MapaImpl etiqueta="Mapa" capas={[{ id: 'LYR-02', datos: localidades, color: '#2b5f8f', seleccionable: true }]} wms={[{ id: 'LYR-05', url: URL_WMS }]} />
    )
    await act(async () => cargarMapas())
    const [mapa] = Falso.todos
    const fuente = mapa.fuentes.get('wms:LYR-05')!
    expect(fuente.opciones.type).toBe('raster')
    expect(fuente.opciones.tileSize).toBe(256)
    const tesela = (fuente.opciones.tiles as string[])[0]
    expect(tesela).toContain('bbox={bbox-epsg-3857}')
    expect(tesela).toContain('layers=t_c')
    expect(tesela).toContain('styles=sgspe-lyr-05')
    expect(tesela).toContain('version=1.1.1')
    expect(mapa.capas.find((c) => c.id === 'wms:LYR-05')).toMatchObject({ type: 'raster', antes: 'LYR-02-relleno' })
    // otra opacidad se repinta; otra URL rehace la fuente, sin duplicar la capa
    const capas = [{ id: 'LYR-02', datos: localidades, color: '#2b5f8f', seleccionable: true }]
    rerender(<MapaImpl etiqueta="Mapa" capas={capas} wms={[{ id: 'LYR-05', url: URL_WMS, opacidad: 0.5 }]} />)
    expect(mapa.setPaintProperty).toHaveBeenCalledWith('wms:LYR-05', 'raster-opacity', 0.5)
    rerender(<MapaImpl etiqueta="Mapa" capas={capas} wms={[{ id: 'LYR-05', url: URL_WMS.replace('t_c', 't_d') }]} />)
    expect((mapa.fuentes.get('wms:LYR-05')!.opciones.tiles as string[])[0]).toContain('layers=t_d')
    expect(mapa.capas.filter((c) => c.id === 'wms:LYR-05')).toHaveLength(1)
    rerender(<MapaImpl etiqueta="Mapa" capas={[{ id: 'LYR-02', datos: localidades, color: '#2b5f8f', seleccionable: true }]} wms={[]} />)
    expect(mapa.fuentes.has('wms:LYR-05')).toBe(false)
    expect(mapa.capas.some((c) => c.id === 'wms:LYR-05')).toBe(false)
  })

  it('transformRequest firma con la función de la prop y una tesela WMS que falla avisa con su estado', async () => {
    const firmar = vi.fn((url: string) => ({ url, headers: { Authorization: 'Bearer t' } }))
    const fallo = vi.fn()
    render(<MapaImpl etiqueta="Mapa" capas={[]} wms={[{ id: 'LYR-05', url: URL_WMS }]} firmar={firmar} alFallarWms={fallo} />)
    await act(async () => cargarMapas())
    const [mapa] = Falso.todos
    const transformar = mapa.opciones.transformRequest as (url: string) => unknown
    expect(transformar(URL_WMS)).toEqual({ url: URL_WMS, headers: { Authorization: 'Bearer t' } })
    mapa.emitir('error', { sourceId: 'wms:LYR-05', error: { status: 503 } })
    expect(fallo).toHaveBeenCalledWith('LYR-05', 503)
    mapa.emitir('error', { sourceId: 'LYR-02', error: { status: 500 } })
    mapa.emitir('error', { error: new Error('estilo') })
    expect(fallo).toHaveBeenCalledTimes(1)
    // un corte de red no trae estado
    mapa.emitir('error', { sourceId: 'wms:LYR-05', error: new Error('red') })
    expect(fallo).toHaveBeenLastCalledWith('LYR-05', null)
  })

  it('sin firma, transformRequest deja la URL tal cual', () => {
    render(<MapaImpl etiqueta="Mapa" capas={[]} />)
    const transformar = Falso.todos[0].opciones.transformRequest as (url: string) => unknown
    expect(transformar('https://mapas.example/estilo.json')).toEqual({ url: 'https://mapas.example/estilo.json' })
  })

  it('una capa invisible no se ve pero se elige, y muestra el borde de lo elegido', async () => {
    const elegir = vi.fn()
    const { rerender } = render(
      <MapaImpl etiqueta="Mapa" capas={[{ id: 'LYR-02', datos: localidades, color: '#2b5f8f', seleccionable: true, invisible: true }]} alSeleccionar={elegir} />
    )
    await act(async () => cargarMapas())
    const [mapa] = Falso.todos
    expect(mapa.capas.find((c) => c.id === 'LYR-02-relleno')!.paint['fill-opacity']).toBe(0)
    expect(mapa.capas.find((c) => c.id === 'LYR-02-punto')!.paint['circle-opacity']).toBe(0)
    expect(mapa.capas.find((c) => c.id === 'LYR-02-linea')!.paint['line-opacity']).toEqual([
      'case',
      ['any', ['==', ['get', '__id'], ''], ['==', ['get', '__targetId'], '']],
      1,
      0
    ])
    mapa.emitir('click:LYR-02-punto', { features: [{ properties: { __id: 'l1', __object: 'locality' } }] })
    expect(elegir).toHaveBeenCalledWith('l1', 'LYR-02', 'locality')
    // la selección repinta el borde de lo elegido en la capa invisible
    rerender(
      <MapaImpl
        etiqueta="Mapa"
        capas={[{ id: 'LYR-02', datos: localidades, color: '#2b5f8f', seleccionable: true, invisible: true }]}
        seleccion="l1"
        alSeleccionar={elegir}
      />
    )
    expect(mapa.setPaintProperty).toHaveBeenCalledWith('LYR-02-punto', 'circle-stroke-opacity', [
      'case',
      ['any', ['==', ['get', '__id'], 'l1'], ['==', ['get', '__targetId'], 'l1']],
      1,
      0
    ])
    // si el WMS se cae, la misma capa vuelve a verse sin dibujarla de nuevo
    mapa.setPaintProperty.mockClear()
    rerender(
      <MapaImpl etiqueta="Mapa" capas={[{ id: 'LYR-02', datos: localidades, color: '#2b5f8f', seleccionable: true }]} seleccion="l1" alSeleccionar={elegir} />
    )
    expect(mapa.setPaintProperty).toHaveBeenCalledWith('LYR-02-relleno', 'fill-opacity', 0.15)
    expect(mapa.setPaintProperty).toHaveBeenCalledWith('LYR-02-linea', 'line-opacity', 1)
    expect(mapa.setPaintProperty).toHaveBeenCalledWith('LYR-02-punto', 'circle-opacity', 1)
    expect(mapa.capas.filter((c) => c.id === 'LYR-02-relleno')).toHaveLength(1)
  })

  it('el calor es una capa heatmap con la rampa de la paleta, pesada por el conteo, debajo de las capas, y se quita sin calor', async () => {
    const celdas: Coleccion = {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [-78.5, -7.9] }, properties: { __id: 'l1', count: 5 } }]
    }
    const calor = { datos: celdas, maximo: 5, colores: ['#f3eee2', '#a33a2a'] }
    const capas = [{ id: 'LYR-02', datos: localidades, color: '#2b5f8f', seleccionable: true }]
    const { rerender } = render(<MapaImpl etiqueta="Mapa" capas={capas} calor={calor} />)
    await act(async () => cargarMapas())
    const [mapa] = Falso.todos
    const capa = mapa.capas.find((c) => c.id === 'calor')!
    expect(capa.type).toBe('heatmap')
    expect(capa.antes).toBe('LYR-02-relleno')
    expect(capa.paint['heatmap-weight']).toEqual(['interpolate', ['linear'], ['get', 'count'], 0, 0, 5, 1])
    expect(capa.paint['heatmap-color']).toEqual(['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)', 0.5, '#f3eee2', 1, '#a33a2a'])
    expect(mapa.fuentes.get('calor')!.data).toBe(celdas)
    rerender(<MapaImpl etiqueta="Mapa" capas={capas} calor={null} />)
    expect(mapa.capas.some((c) => c.id === 'calor')).toBe(false)
    expect(mapa.fuentes.has('calor')).toBe(false)
  })

  it('un clic en el mapa entrega el punto pulsado', async () => {
    const pulsar = vi.fn()
    render(<MapaImpl etiqueta="Mapa" capas={[]} alPulsar={pulsar} />)
    await act(async () => cargarMapas())
    Falso.todos[0].emitir('click', { lngLat: { lng: -78.5, lat: -7.9 } })
    expect(pulsar).toHaveBeenCalledWith([-78.5, -7.9])
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
