import 'maplibre-gl/dist/maplibre-gl.css'
import {
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
  setWorkerUrl,
  type ExpressionSpecification,
  type GeoJSONSource,
  type MapLayerMouseEvent,
  type MapMouseEvent,
  type StyleSpecification
} from 'maplibre-gl'
import { WMS_TILE_SIZE, wmsTileUrl, type BasemapSpec } from '@wasichai/gis'
import { useEffect, useRef, useState } from 'react'
import { destinoDe, idDeElemento, MIEMBRO, type Coleccion } from './api'
import { alCambiarTema, colorDe } from './colores'
import type { CapaDibujada, MapaProps } from './Mapa'
import { SIN_MAPA_BASE } from './mapaBase'
import { trabajadorDelMapa } from './trabajador'

// el mapa MapLibre de MapaProps: una fuente GeoJSON por capa con tres dibujos (relleno, línea y punto), la selección con
// borde de 2.5 px (design-system.md §3.3), el encuadre a lo seleccionado o a todo, y el repintado al cambiar de tema. una
// capa con miembros de áreas de influencia (LYR-13) los dibuja aparte, con trazo discontinuo y punto hueco, y elegir uno
// lleva al lugar que dibuja (__targetId)
const POLIGONOS: ExpressionSpecification = ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]]
const LINEAS: ExpressionSpecification = ['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString', 'Polygon', 'MultiPolygon']]]
const PUNTOS: ExpressionSpecification = ['in', ['geometry-type'], ['literal', ['Point', 'MultiPoint']]]
const ES_MIEMBRO: ExpressionSpecification = ['==', ['get', '__object'], MIEMBRO]
const NO_ES_MIEMBRO: ExpressionSpecification = ['!=', ['get', '__object'], MIEMBRO]
const DE_MIEMBROS = ['miembro-relleno', 'miembro-linea', 'miembro-punto'] as const

// el estilo MapLibre del fondo (spec F6 §3.3): un estilo del proveedor tal cual; un ráster sobre el fondo apagado; sin mapa base,
// solo el fondo apagado del token --sg-map-ground, sin teselas externas (ASM-048)
export function estiloDe(basemap: BasemapSpec, fondo: string): StyleSpecification | string {
  if (basemap.type === 'style') return basemap.url
  const apagado = { id: 'fondo', type: 'background' as const, paint: { 'background-color': fondo } }
  if (basemap.type === 'none') return { version: 8, sources: {}, layers: [apagado] }
  return {
    version: 8,
    sources: {
      basemap: {
        type: 'raster',
        tiles: basemap.tiles,
        tileSize: basemap.tileSize ?? 256,
        ...(basemap.attribution ? { attribution: basemap.attribution } : {}),
        ...(basemap.maxzoom ? { maxzoom: basemap.maxzoom } : {})
      }
    },
    layers: [apagado, { id: 'basemap', type: 'raster', source: 'basemap' }]
  }
}

// lo elegido: el registro o el miembro que dibuja ese lugar
const elegido = (seleccion: string | null | undefined): ExpressionSpecification => [
  'any',
  ['==', ['get', '__id'], seleccion ?? ''],
  ['==', ['get', '__targetId'], seleccion ?? '']
]

// las fuentes y capas WMS llevan este prefijo: el error de una tesela se reconoce por su sourceId
const PREFIJO_WMS = 'wms:'
const CALOR = 'calor'

// la opacidad de cada dibujo de una capa: una invisible (decisión 7 del plan 6.3) deja ver solo el borde de lo elegido, sobre
// la tesela WMS que la dibuja
const soloLoElegido = (seleccion: string | null | undefined): ExpressionSpecification => ['case', elegido(seleccion), 1, 0]
function opacidadesDe(capa: CapaDibujada, seleccion: string | null | undefined) {
  const invisible = capa.invisible === true
  return {
    relleno: invisible ? 0 : (capa.relleno ?? 0.15),
    linea: invisible ? soloLoElegido(seleccion) : 1,
    punto: invisible ? 0 : 1,
    bordeDelPunto: invisible ? soloLoElegido(seleccion) : 1
  }
}

function pintarVisibilidad(instancia: MapLibreMap, capa: CapaDibujada, seleccion: string | null | undefined) {
  const o = opacidadesDe(capa, seleccion)
  instancia.setPaintProperty(`${capa.id}-relleno`, 'fill-opacity', o.relleno)
  instancia.setPaintProperty(`${capa.id}-linea`, 'line-opacity', o.linea)
  instancia.setPaintProperty(`${capa.id}-punto`, 'circle-opacity', o.punto)
  instancia.setPaintProperty(`${capa.id}-punto`, 'circle-stroke-opacity', o.bordeDelPunto)
}

function encuadreDe(colecciones: Coleccion[]): [[number, number], [number, number]] | null {
  let [oeste, sur, este, norte] = [Infinity, Infinity, -Infinity, -Infinity]
  const visitar = (valor: unknown): void => {
    if (!Array.isArray(valor)) return
    if (typeof valor[0] === 'number' && typeof valor[1] === 'number') {
      oeste = Math.min(oeste, valor[0])
      sur = Math.min(sur, valor[1])
      este = Math.max(este, valor[0])
      norte = Math.max(norte, valor[1])
      return
    }
    for (const v of valor) visitar(v)
  }
  for (const c of colecciones) for (const e of c.features) visitar(e.geometry?.coordinates)
  return Number.isFinite(oeste)
    ? [
        [oeste, sur],
        [este, norte]
      ]
    : null
}

// cada colección tiene un número propio: la clave de los efectos cambia cuando llega otra, aunque tenga los mismos
// elementos que la anterior (una capa recortada al tope trae siempre el mismo conteo)
const identidades = new WeakMap<object, number>()
let siguiente = 0
const identidad = (datos: Coleccion): number => {
  let numero = identidades.get(datos)
  if (numero === undefined) identidades.set(datos, (numero = ++siguiente))
  return numero
}

export default function MapaImpl({
  etiqueta,
  capas,
  seleccion,
  alSeleccionar,
  alMoverVista,
  alMoverCursor,
  alCapturar,
  basemap = SIN_MAPA_BASE,
  wms,
  alFallarWms,
  calor,
  alPulsar,
  firmar
}: MapaProps) {
  const contenedor = useRef<HTMLDivElement>(null)
  const mapa = useRef<MapLibreMap | null>(null)
  const [listo, setListo] = useState(false)
  // en reposo: MapLibre terminó de pedir y dibujar (idle) y no hay datos en camino. lo lee e2e/hilo.spec.ts para afirmar que no
  // se pidió nada externo sin esperar un plazo fijo
  const [reposo, setReposo] = useState(false)
  const ultimo = useRef({ alSeleccionar, alMoverVista, alMoverCursor, alFallarWms, alPulsar, firmar })
  ultimo.current = { alSeleccionar, alMoverVista, alMoverCursor, alFallarWms, alPulsar, firmar }
  // las capas WMS puestas (con la URL de su fuente) y las capas GeoJSON dibujadas invisibles
  const conWms = useRef(new globalThis.Map<string, string>())
  const invisibles = useRef(new Set<string>())
  const dibujadas = useRef(new Set<string>())
  // las capas que dibujan además los miembros de las áreas (LYR-13)
  const conMiembros = useRef(new Set<string>())
  // el clic se escucha una sola vez por capa, aunque la capa se apague y se vuelva a encender
  const conClic = useRef(new Set<string>())
  const encuadrado = useRef(false)
  // los datos que cada fuente tiene puestos y la selección sobre la que ya se encuadró
  const puestos = useRef(new globalThis.Map<string, Coleccion>())
  const encuadradoA = useRef<string | null>(null)

  useEffect(() => {
    if (!contenedor.current) return
    const trabajador = trabajadorDelMapa()
    if (trabajador) setWorkerUrl(trabajador)
    const instancia = new MapLibreMap({
      container: contenedor.current,
      style: estiloDe(basemap, colorDe('--sg-map-ground')),
      center: [-75.5, -9.5],
      zoom: 5,
      attributionControl: { compact: true },
      canvasContextAttributes: { preserveDrawingBuffer: true },
      // el token de wasichai solo a las teselas del proxy (firmaDeWms); lo demás sale tal cual
      transformRequest: (url: string) => ultimo.current.firmar?.(url) ?? { url }
    })
    instancia.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    instancia.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left')
    instancia.on('idle', () => setReposo(true))
    instancia.on('dataloading', () => setReposo(false))
    // una tesela WMS que falla (GeoServer caído, 503; sin permiso, 403; un parámetro rechazado, 400 o 422): la página decide si
    // apaga el WMS. el error de una tesela trae sourceId y el AJAXError con su status; el de un estilo, no. una tesela con 404
    // no llega aquí: MapLibre la calla
    instancia.on('error', (evento) => {
      const e = evento as unknown as { sourceId?: string; error?: { status?: unknown } }
      const fuente = e.sourceId
      if (!fuente?.startsWith(PREFIJO_WMS)) return
      const estado = typeof e.error?.status === 'number' ? e.error.status : null
      ultimo.current.alFallarWms?.(fuente.slice(PREFIJO_WMS.length), estado)
    })
    instancia.on('load', () => {
      if (mapa.current !== instancia) return
      const informar = () => {
        const b = instancia.getBounds()
        ultimo.current.alMoverVista?.([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()])
      }
      instancia.on('moveend', informar)
      instancia.on('mousemove', (e) => ultimo.current.alMoverCursor?.([e.lngLat.lng, e.lngLat.lat]))
      instancia.on('mouseout', () => ultimo.current.alMoverCursor?.(null))
      instancia.on('click', (e: MapMouseEvent) => ultimo.current.alPulsar?.([e.lngLat.lng, e.lngLat.lat]))
      informar()
      setListo(true)
    })
    const redimensionar = new ResizeObserver(() => instancia.resize())
    redimensionar.observe(contenedor.current)
    mapa.current = instancia
    alCapturar?.(() => {
      try {
        return instancia.getCanvas().toDataURL('image/png')
      } catch {
        return null
      }
    })
    return () => {
      redimensionar.disconnect()
      instancia.remove()
      mapa.current = null
      dibujadas.current.clear()
      conMiembros.current.clear()
      conClic.current.clear()
      puestos.current.clear()
      conWms.current.clear()
      invisibles.current.clear()
      encuadrado.current = false
      encuadradoA.current = null
      // StrictMode monta, desmonta y monta de nuevo: la instancia nueva vuelve a cargar y a dibujar sus capas
      setListo(false)
    }
    // un mapa por montaje: las funciones nuevas se leen de `ultimo`
  }, [])

  // las capas: se agregan las nuevas, se actualizan sus datos y se quitan las que se apagaron
  const clave = capas.map((c) => `${c.id}:${identidad(c.datos)}:${c.invisible ? 1 : 0}`).join('|')
  useEffect(() => {
    const instancia = mapa.current
    if (!instancia || !listo) return
    const ids = new Set(capas.map((c) => c.id))
    for (const id of [...dibujadas.current]) {
      if (ids.has(id)) continue
      for (const sufijo of ['relleno', 'linea', 'punto', ...(conMiembros.current.has(id) ? DE_MIEMBROS : [])]) instancia.removeLayer(`${id}-${sufijo}`)
      instancia.removeSource(id)
      dibujadas.current.delete(id)
      conMiembros.current.delete(id)
      puestos.current.delete(id)
      invisibles.current.delete(id)
    }
    for (const capa of capas) {
      const color = colorDe(capa.color)
      if (dibujadas.current.has(capa.id)) {
        // otra colección (otro encuadre o proyecto), aunque tenga el mismo conteo: se cambian los datos de la fuente
        if (puestos.current.get(capa.id) !== capa.datos) {
          ;(instancia.getSource(capa.id) as GeoJSONSource).setData(capa.datos as never)
          puestos.current.set(capa.id, capa.datos)
        }
        // se volvió invisible (llegó el WMS) o visible (el WMS se cayó): se repinta sin dibujarla de nuevo
        if (invisibles.current.has(capa.id) !== (capa.invisible === true)) {
          pintarVisibilidad(instancia, capa, seleccion)
          if (capa.invisible) invisibles.current.add(capa.id)
          else invisibles.current.delete(capa.id)
        }
        continue
      }
      const opacidad = opacidadesDe(capa, seleccion)
      puestos.current.set(capa.id, capa.datos)
      // con miembros, los dibujos de la capa son solo de sus registros y los miembros van en los suyos
      const propios = (filtro: ExpressionSpecification): ExpressionSpecification => (capa.miembros ? ['all', filtro, NO_ES_MIEMBRO] : filtro)
      instancia.addSource(capa.id, { type: 'geojson', data: capa.datos as never })
      instancia.addLayer({
        id: `${capa.id}-relleno`,
        type: 'fill',
        source: capa.id,
        filter: propios(POLIGONOS),
        paint: { 'fill-color': colorDe(capa.colorDeRelleno ?? capa.color), 'fill-opacity': opacidad.relleno }
      })
      instancia.addLayer({
        id: `${capa.id}-linea`,
        type: 'line',
        source: capa.id,
        filter: propios(LINEAS),
        paint: {
          'line-color': color,
          'line-width': ['case', elegido(seleccion), 2.5, 1.2],
          'line-opacity': opacidad.linea,
          ...(capa.trazo ? { 'line-dasharray': capa.trazo } : {})
        }
      })
      instancia.addLayer({
        id: `${capa.id}-punto`,
        type: 'circle',
        source: capa.id,
        filter: propios(PUNTOS),
        paint: {
          'circle-color': color,
          'circle-radius': ['case', elegido(seleccion), 8, 5],
          'circle-opacity': opacidad.punto,
          'circle-stroke-color': colorDe('--sg-surface'),
          'circle-stroke-width': 1.5,
          'circle-stroke-opacity': opacidad.bordeDelPunto
        }
      })
      if (capa.miembros) {
        instancia.addLayer({
          id: `${capa.id}-miembro-relleno`,
          type: 'fill',
          source: capa.id,
          filter: ['all', POLIGONOS, ES_MIEMBRO],
          paint: { 'fill-color': color, 'fill-opacity': 0.06 }
        })
        instancia.addLayer({
          id: `${capa.id}-miembro-linea`,
          type: 'line',
          source: capa.id,
          filter: ['all', LINEAS, ES_MIEMBRO],
          paint: { 'line-color': color, 'line-dasharray': [2, 2], 'line-width': ['case', elegido(seleccion), 2.5, 1.2] }
        })
        instancia.addLayer({
          id: `${capa.id}-miembro-punto`,
          type: 'circle',
          source: capa.id,
          filter: ['all', PUNTOS, ES_MIEMBRO],
          paint: {
            'circle-color': colorDe('--sg-surface'),
            'circle-radius': ['case', elegido(seleccion), 8, 5],
            'circle-stroke-color': color,
            'circle-stroke-width': 2
          }
        })
        conMiembros.current.add(capa.id)
      }
      if (capa.seleccionable && !conClic.current.has(capa.id)) {
        conClic.current.add(capa.id)
        for (const sufijo of ['relleno', 'punto', ...(capa.miembros ? ['miembro-relleno', 'miembro-punto'] : [])]) {
          instancia.on('click', `${capa.id}-${sufijo}`, (e: MapLayerMouseEvent) => {
            const destino = destinoDe(e.features?.[0]?.properties)
            if (destino) ultimo.current.alSeleccionar?.(destino.id, capa.id, destino.objeto)
          })
        }
      }
      if (capa.invisible) invisibles.current.add(capa.id)
      dibujadas.current.add(capa.id)
    }
    if (!encuadrado.current) {
      const encuadre = encuadreDe(capas.map((c) => c.datos))
      if (encuadre) {
        instancia.fitBounds(encuadre, { padding: 48, maxZoom: 15, duration: 0 })
        encuadrado.current = true
      }
    }
  }, [listo, clave])

  // la selección: borde de 2.5 px
  useEffect(() => {
    const instancia = mapa.current
    if (!instancia || !listo) return
    for (const id of dibujadas.current) {
      for (const prefijo of ['', ...(conMiembros.current.has(id) ? ['miembro-'] : [])]) {
        instancia.setPaintProperty(`${id}-${prefijo}linea`, 'line-width', ['case', elegido(seleccion), 2.5, 1.2])
        instancia.setPaintProperty(`${id}-${prefijo}punto`, 'circle-radius', ['case', elegido(seleccion), 8, 5])
      }
      // una capa invisible muestra solo el borde de lo elegido
      const capa = invisibles.current.has(id) ? capas.find((c) => c.id === id) : undefined
      if (capa) pintarVisibilidad(instancia, capa, seleccion)
    }
  }, [listo, seleccion, clave])

  // el encuadre sobre lo elegido: una vez por selección. mover el mapa cambia las capas, no la selección, y no debe
  // devolver a la persona al elemento; si el elemento aún no llegó (las capas se están pidiendo), se encuadra cuando llegue
  useEffect(() => {
    const instancia = mapa.current
    if (!instancia || !listo) return
    if (!seleccion) {
      encuadradoA.current = null
      return
    }
    if (encuadradoA.current === seleccion) return
    const elemento = capas.flatMap((c) => c.datos.features).find((e) => idDeElemento(e) === seleccion || e.properties.__targetId === seleccion)
    const encuadre = elemento ? encuadreDe([{ type: 'FeatureCollection', features: [elemento] }]) : null
    if (!encuadre) return
    encuadradoA.current = seleccion
    instancia.fitBounds(encuadre, { padding: 80, maxZoom: 16, duration: 300 })
  }, [listo, seleccion, clave])

  // la primera capa GeoJSON dibujada: el WMS y el calor van debajo de ella (MapLibre inserta antes de esa capa)
  const debajoDeLasCapas = (): string | undefined => {
    const primera = [...dibujadas.current][0]
    return primera ? `${primera}-relleno` : undefined
  }

  // las capas WMS: se agregan las nuevas y se quitan las apagadas (o todas, si el WMS se cayó)
  const claveWms = (wms ?? []).map((w) => `${w.id}:${w.url}:${w.opacidad ?? 1}`).join('|')
  useEffect(() => {
    const instancia = mapa.current
    if (!instancia || !listo) return
    const vigentes = new globalThis.Map((wms ?? []).map((w) => [w.id, w]))
    for (const id of [...conWms.current.keys()]) {
      if (vigentes.has(id)) continue
      instancia.removeLayer(`${PREFIJO_WMS}${id}`)
      instancia.removeSource(`${PREFIJO_WMS}${id}`)
      conWms.current.delete(id)
    }
    for (const w of vigentes.values()) {
      const id = `${PREFIJO_WMS}${w.id}`
      const puesta = conWms.current.get(w.id)
      // la misma URL: otra opacidad solo se repinta; otra URL (otras capas publicadas de la misma LYR) rehace la fuente
      if (puesta === w.url) {
        instancia.setPaintProperty(id, 'raster-opacity', w.opacidad ?? 1)
        continue
      }
      if (puesta !== undefined) {
        instancia.removeLayer(id)
        instancia.removeSource(id)
      }
      instancia.addSource(id, { type: 'raster', tiles: [wmsTileUrl(w.url, WMS_TILE_SIZE)], tileSize: WMS_TILE_SIZE })
      instancia.addLayer({ id, type: 'raster', source: id, paint: { 'raster-opacity': w.opacidad ?? 1 } }, debajoDeLasCapas())
      conWms.current.set(w.id, w.url)
    }
  }, [listo, claveWms, clave])

  // el calor: una capa heatmap pesada por el conteo de cada localidad, con la rampa de la paleta
  const claveCalor = calor ? `${identidad(calor.datos)}:${calor.maximo}:${calor.colores.join(',')}` : ''
  useEffect(() => {
    const instancia = mapa.current
    if (!instancia || !listo) return
    if (instancia.getSource(CALOR)) {
      instancia.removeLayer(CALOR)
      instancia.removeSource(CALOR)
    }
    if (!calor) return
    const pasos = calor.colores.flatMap((color, i) => [(i + 1) / calor.colores.length, color])
    instancia.addSource(CALOR, { type: 'geojson', data: calor.datos as never })
    instancia.addLayer(
      {
        id: CALOR,
        type: 'heatmap',
        source: CALOR,
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'count'], 0, 0, Math.max(1, calor.maximo), 1],
          'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)', ...pasos] as ExpressionSpecification,
          'heatmap-radius': 32,
          'heatmap-opacity': 0.8
        }
      },
      debajoDeLasCapas()
    )
  }, [listo, claveCalor])

  // otro tema repinta las mismas capas con sus tokens
  useEffect(() => {
    if (!listo) return
    return alCambiarTema(() => {
      const instancia = mapa.current
      if (!instancia) return
      // el fondo apagado (si el estilo no es del proveedor) y el trazo de los puntos también son tokens
      if (basemap.type !== 'style') instancia.setPaintProperty('fondo', 'background-color', colorDe('--sg-map-ground'))
      for (const capa of capas) {
        if (!dibujadas.current.has(capa.id)) continue
        const color = colorDe(capa.color)
        instancia.setPaintProperty(`${capa.id}-relleno`, 'fill-color', colorDe(capa.colorDeRelleno ?? capa.color))
        instancia.setPaintProperty(`${capa.id}-linea`, 'line-color', color)
        instancia.setPaintProperty(`${capa.id}-punto`, 'circle-color', color)
        instancia.setPaintProperty(`${capa.id}-punto`, 'circle-stroke-color', colorDe('--sg-surface'))
        if (conMiembros.current.has(capa.id)) {
          instancia.setPaintProperty(`${capa.id}-miembro-relleno`, 'fill-color', color)
          instancia.setPaintProperty(`${capa.id}-miembro-linea`, 'line-color', color)
          instancia.setPaintProperty(`${capa.id}-miembro-punto`, 'circle-stroke-color', color)
          instancia.setPaintProperty(`${capa.id}-miembro-punto`, 'circle-color', colorDe('--sg-surface'))
        }
      }
    })
  }, [listo, clave])

  return <div ref={contenedor} role="region" aria-label={etiqueta} className="h-full w-full" data-testid="mapa" data-reposo={reposo ? 'si' : 'no'} />
}
