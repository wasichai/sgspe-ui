import 'maplibre-gl/dist/maplibre-gl.css'
import {
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
  setWorkerUrl,
  type ExpressionSpecification,
  type GeoJSONSource,
  type MapLayerMouseEvent,
  type StyleSpecification
} from 'maplibre-gl'
import { useEffect, useRef, useState } from 'react'
import { ESTILO_DEL_MAPA_BASE } from '../config'
import { destinoDe, idDeElemento, MIEMBRO, type Coleccion } from './api'
import { alCambiarTema, colorDe } from './colores'
import type { MapaProps } from './Mapa'
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

// sin mapa base configurado: el fondo apagado del token --sg-map-ground, sin teselas externas (ASM-048, UPS-13)
export const estiloBase = (): StyleSpecification | string =>
  ESTILO_DEL_MAPA_BASE || { version: 8, sources: {}, layers: [{ id: 'fondo', type: 'background', paint: { 'background-color': colorDe('--sg-map-ground') } }] }

// lo elegido: el registro o el miembro que dibuja ese lugar
const elegido = (seleccion: string | null | undefined): ExpressionSpecification => [
  'any',
  ['==', ['get', '__id'], seleccion ?? ''],
  ['==', ['get', '__targetId'], seleccion ?? '']
]

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

export default function MapaImpl({ etiqueta, capas, seleccion, alSeleccionar, alMoverVista, alMoverCursor, alCapturar }: MapaProps) {
  const contenedor = useRef<HTMLDivElement>(null)
  const mapa = useRef<MapLibreMap | null>(null)
  const [listo, setListo] = useState(false)
  const ultimo = useRef({ alSeleccionar, alMoverVista, alMoverCursor })
  ultimo.current = { alSeleccionar, alMoverVista, alMoverCursor }
  const dibujadas = useRef(new Set<string>())
  // las capas que dibujan además los miembros de las áreas (LYR-13)
  const conMiembros = useRef(new Set<string>())
  // el clic se escucha una sola vez por capa, aunque la capa se apague y se vuelva a encender
  const conClic = useRef(new Set<string>())
  const encuadrado = useRef(false)

  useEffect(() => {
    if (!contenedor.current) return
    const trabajador = trabajadorDelMapa()
    if (trabajador) setWorkerUrl(trabajador)
    const instancia = new MapLibreMap({
      container: contenedor.current,
      style: estiloBase(),
      center: [-75.5, -9.5],
      zoom: 5,
      attributionControl: { compact: true },
      canvasContextAttributes: { preserveDrawingBuffer: true }
    })
    instancia.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    instancia.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left')
    instancia.on('load', () => {
      const informar = () => {
        const b = instancia.getBounds()
        ultimo.current.alMoverVista?.([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()])
      }
      instancia.on('moveend', informar)
      instancia.on('mousemove', (e) => ultimo.current.alMoverCursor?.([e.lngLat.lng, e.lngLat.lat]))
      instancia.on('mouseout', () => ultimo.current.alMoverCursor?.(null))
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
    }
    // un mapa por montaje: las funciones nuevas se leen de `ultimo`
  }, [])

  // las capas: se agregan las nuevas, se actualizan sus datos y se quitan las que se apagaron
  const clave = JSON.stringify(capas.map((c) => [c.id, c.datos.features.length]))
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
    }
    for (const capa of capas) {
      const color = colorDe(capa.color)
      if (dibujadas.current.has(capa.id)) {
        ;(instancia.getSource(capa.id) as GeoJSONSource).setData(capa.datos as never)
        continue
      }
      // con miembros, los dibujos de la capa son solo de sus registros y los miembros van en los suyos
      const propios = (filtro: ExpressionSpecification): ExpressionSpecification => (capa.miembros ? ['all', filtro, NO_ES_MIEMBRO] : filtro)
      instancia.addSource(capa.id, { type: 'geojson', data: capa.datos as never })
      instancia.addLayer({
        id: `${capa.id}-relleno`,
        type: 'fill',
        source: capa.id,
        filter: propios(POLIGONOS),
        paint: { 'fill-color': color, 'fill-opacity': 0.15 }
      })
      instancia.addLayer({
        id: `${capa.id}-linea`,
        type: 'line',
        source: capa.id,
        filter: propios(LINEAS),
        paint: { 'line-color': color, 'line-width': ['case', elegido(seleccion), 2.5, 1.2] }
      })
      instancia.addLayer({
        id: `${capa.id}-punto`,
        type: 'circle',
        source: capa.id,
        filter: propios(PUNTOS),
        paint: {
          'circle-color': color,
          'circle-radius': ['case', elegido(seleccion), 8, 5],
          'circle-stroke-color': colorDe('--sg-surface'),
          'circle-stroke-width': 1.5
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

  // la selección: borde de 2.5 px y el encuadre sobre ella
  useEffect(() => {
    const instancia = mapa.current
    if (!instancia || !listo) return
    for (const id of dibujadas.current) {
      for (const prefijo of ['', ...(conMiembros.current.has(id) ? ['miembro-'] : [])]) {
        instancia.setPaintProperty(`${id}-${prefijo}linea`, 'line-width', ['case', elegido(seleccion), 2.5, 1.2])
        instancia.setPaintProperty(`${id}-${prefijo}punto`, 'circle-radius', ['case', elegido(seleccion), 8, 5])
      }
    }
    const elemento = capas.flatMap((c) => c.datos.features).find((e) => idDeElemento(e) === seleccion || e.properties.__targetId === seleccion)
    const encuadre = elemento ? encuadreDe([{ type: 'FeatureCollection', features: [elemento] }]) : null
    if (encuadre) instancia.fitBounds(encuadre, { padding: 80, maxZoom: 16, duration: 300 })
  }, [listo, seleccion, clave])

  // otro tema repinta las mismas capas con sus tokens
  useEffect(() => {
    if (!listo) return
    return alCambiarTema(() => {
      const instancia = mapa.current
      if (!instancia) return
      for (const capa of capas) {
        if (!dibujadas.current.has(capa.id)) continue
        const color = colorDe(capa.color)
        instancia.setPaintProperty(`${capa.id}-relleno`, 'fill-color', color)
        instancia.setPaintProperty(`${capa.id}-linea`, 'line-color', color)
        instancia.setPaintProperty(`${capa.id}-punto`, 'circle-color', color)
        if (conMiembros.current.has(capa.id)) {
          instancia.setPaintProperty(`${capa.id}-miembro-relleno`, 'fill-color', color)
          instancia.setPaintProperty(`${capa.id}-miembro-linea`, 'line-color', color)
          instancia.setPaintProperty(`${capa.id}-miembro-punto`, 'circle-stroke-color', color)
          instancia.setPaintProperty(`${capa.id}-miembro-punto`, 'circle-color', colorDe('--sg-surface'))
        }
      }
    })
  }, [listo, clave])

  return <div ref={contenedor} role="region" aria-label={etiqueta} className="h-full w-full" data-testid="mapa" />
}
