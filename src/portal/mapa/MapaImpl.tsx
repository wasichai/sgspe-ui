import 'maplibre-gl/dist/maplibre-gl.css'
import {
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
  setWorkerUrl,
  type ExpressionSpecification,
  type GeoJSONSource,
  type LayerSpecification,
  type MapLayerMouseEvent,
  type MapMouseEvent,
  type StyleSpecification
} from 'maplibre-gl'
import { WMS_TILE_SIZE, wmsTileUrl, type BasemapSpec } from '@wasichai/gis'
import { useEffect, useRef, useState } from 'react'
import { destinoDe, encuadreDeGeometrias, idDeElemento, MIEMBRO, PERU, type Coleccion, type Encuadre } from './api'
import { PREFIJO_DEL_ANILLO } from './capas'
import { alCambiarTema, colorDe } from './colores'
import type { CapaDibujada, MapaImplProps, Rotulo } from './Mapa'
import { SIN_MAPA_BASE } from './mapaBase'
import { anilloDe, DENSIDAD, idDelCuadrado, idDelRombo, imagenesFijas, radioDe, SIN_NIVEL, type Imagen, type Simbolo } from './simbolos'
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

// los glifos de los rótulos (design-system.md §3.3): PBF de Public Sans generados por scripts/glifos.mjs y servidos desde el
// propio origen (public/glifos, CSP connect-src 'self'). MapLibre pide una URL absoluta con {fontstack} y {range} sin codificar
export const urlDeGlifos = (): string => `${window.location.origin}${import.meta.env.BASE_URL}glifos/{fontstack}/{range}.pbf`
const FUENTE = {
  semibold: 'public-sans-semibold',
  bold: 'public-sans-bold',
  cursiva: 'public-sans-semibold-italic',
  // el rótulo de lo elegido, en 14 px 800
  elegido: 'public-sans-extrabold'
} as const

// el estilo MapLibre del fondo (spec F6 §3.3): un estilo del proveedor tal cual; un ráster sobre el fondo apagado; sin mapa base,
// solo el fondo apagado del token --sg-map-ground, sin teselas externas (ASM-048). los dos últimos llevan los glifos propios;
// el del proveedor trae los suyos (sin ellos, MapaImpl pone los propios al cargar)
export function estiloDe(basemap: BasemapSpec, fondo: string, glifos: string): StyleSpecification | string {
  if (basemap.type === 'style') return basemap.url
  const apagado = { id: 'fondo', type: 'background' as const, paint: { 'background-color': fondo } }
  if (basemap.type === 'none') return { version: 8, glyphs: glifos, sources: {}, layers: [apagado] }
  return {
    version: 8,
    glyphs: glifos,
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

// el color del punto por un atributo (colorPor): cada valor con su token resuelto en el tema activo y, sin valor conocido, el de la capa
const colorDelPunto = (capa: CapaDibujada): string | ExpressionSpecification => {
  const color = colorDe(capa.color)
  if (!capa.colorPor) return color
  const pares = Object.entries(capa.colorPor.colores).flatMap(([valor, token]) => [valor, colorDe(token)])
  return ['match', ['to-string', ['get', capa.colorPor.campo]], ...pares, color] as ExpressionSpecification
}
// el punto: lleno del color de la capa con borde surface o, con anillo o hueco, relleno surface con el color en un borde de 4 px
// (anillo, LYR-17) o de 2 px (hueco, los centros poblados de LYR-02)
const pinturaDelPunto = (capa: CapaDibujada) => {
  const anillo = capa.colorPor?.anillo === true
  const hueco = anillo || capa.hueco === true
  return {
    'circle-color': hueco ? colorDe('--sg-surface') : colorDelPunto(capa),
    'circle-stroke-color': hueco ? colorDelPunto(capa) : colorDe('--sg-surface'),
    'circle-stroke-width': anillo ? 4 : hueco ? 2 : 1.5
  }
}

// con símbolo (las capas de gestión, simbolos.ts), el círculo no se ve: queda para elegir y para el anillo de 3 px en focus de
// la selección, por fuera del símbolo (design-system.md §3.3)
const pinturaDelPuntoDe = (capa: CapaDibujada) =>
  capa.simbolo ? { 'circle-color': colorDe('--sg-focus'), 'circle-stroke-color': colorDe('--sg-focus'), 'circle-stroke-width': 3 } : pinturaDelPunto(capa)
const radioDelPunto = (capa: CapaDibujada, seleccion: string | null | undefined): ExpressionSpecification => {
  const radio = capa.simbolo ? radioDe(capa.simbolo) : 5
  return ['case', elegido(seleccion), capa.simbolo ? radio + 3 : 8, radio]
}

// la imagen de cada elemento: el cuadrado de la capa, el rombo de su nivel o el anillo de sus conteos (__anillo, paraElMapa)
const imagenDelSimbolo = (capa: string, simbolo: Simbolo): ExpressionSpecification | string => {
  if (simbolo.forma === 'cuadrado') return idDelCuadrado(capa)
  if (simbolo.forma === 'anillo') return ['to-string', ['coalesce', ['get', '__anillo'], `${PREFIJO_DEL_ANILLO}0`]]
  const pares = Object.keys(simbolo.niveles).flatMap((nivel) => [nivel, idDelRombo(capa, nivel)])
  return ['match', ['to-string', ['get', simbolo.campo]], ...pares, idDelRombo(capa, SIN_NIVEL)] as ExpressionSpecification
}
const conteoDe = (simbolo: Simbolo): string | null => (simbolo.forma === 'rombo' ? null : simbolo.conteo)

// el halo de las etiquetas: map-ground de 4 px (§3.3); MapLibre lo recorta a un cuarto del tamaño del texto
const ANCHO_DEL_HALO = 4
const pinturaDelTexto = (color: string, halo = ANCHO_DEL_HALO) => ({
  'text-color': colorDe(color),
  'text-halo-color': colorDe('--sg-map-ground'),
  'text-halo-width': halo
})

function repintarTexto(instancia: MapLibreMap, capa: string, color: string) {
  instancia.setPaintProperty(capa, 'text-color', colorDe(color))
  instancia.setPaintProperty(capa, 'text-halo-color', colorDe('--sg-map-ground'))
}

// la letra y el tamaño de un rótulo: el de lo elegido, en 14 px 800
const fuenteDelRotulo = (rotulo: Rotulo, seleccion: string | null | undefined): ExpressionSpecification => [
  'case',
  elegido(seleccion),
  ['literal', [FUENTE.elegido]],
  ['literal', [rotulo.cursiva ? FUENTE.cursiva : FUENTE[rotulo.peso]]]
]
const tamanoDelRotulo = (rotulo: Rotulo, seleccion: string | null | undefined): ExpressionSpecification => ['case', elegido(seleccion), 14, rotulo.tamano]

// lo elegido: el registro o el miembro que dibuja ese lugar
const elegido = (seleccion: string | null | undefined): ExpressionSpecification => [
  'any',
  ['==', ['get', '__id'], seleccion ?? ''],
  ['==', ['get', '__targetId'], seleccion ?? '']
]

// las fuentes y capas WMS llevan este prefijo: el error de una tesela se reconoce por su sourceId
const PREFIJO_WMS = 'wms:'
const CALOR = 'calor'
// la rampa del calor con el tema activo: cada color (un token --sg-heat-* o un hex) en su tramo de la densidad
const rampaDeCalor = (colores: readonly string[]): ExpressionSpecification =>
  [
    'interpolate',
    ['linear'],
    ['heatmap-density'],
    0,
    'rgba(0,0,0,0)',
    ...colores.flatMap((color, i) => [(i + 1) / colores.length, colorDe(color)])
  ] as ExpressionSpecification

// la opacidad de cada dibujo de una capa: una invisible (decisión 7 del plan 6.3) deja ver solo el borde de lo elegido, sobre
// la tesela WMS que la dibuja
const soloLoElegido = (seleccion: string | null | undefined): ExpressionSpecification => ['case', elegido(seleccion), 1, 0]
// la de un símbolo, que dibuja sus puntos, deja ver del círculo solo la selección; una invisible tampoco dibuja su rótulo (lo trae
// la tesela)
function opacidadesDe(capa: CapaDibujada, seleccion: string | null | undefined) {
  const invisible = capa.invisible === true
  const sinCirculo = invisible || Boolean(capa.simbolo)
  return {
    relleno: invisible ? 0 : (capa.relleno ?? 0.15),
    linea: invisible ? soloLoElegido(seleccion) : 1,
    punto: sinCirculo ? 0 : 1,
    bordeDelPunto: sinCirculo ? soloLoElegido(seleccion) : 1,
    rotulo: invisible ? 0 : 1
  }
}

function pintarVisibilidad(instancia: MapLibreMap, capa: CapaDibujada, seleccion: string | null | undefined, conRotulo: boolean) {
  const o = opacidadesDe(capa, seleccion)
  instancia.setPaintProperty(`${capa.id}-relleno`, 'fill-opacity', o.relleno)
  instancia.setPaintProperty(`${capa.id}-linea`, 'line-opacity', o.linea)
  instancia.setPaintProperty(`${capa.id}-punto`, 'circle-opacity', o.punto)
  instancia.setPaintProperty(`${capa.id}-punto`, 'circle-stroke-opacity', o.bordeDelPunto)
  if (conRotulo) instancia.setPaintProperty(`${capa.id}-rotulo`, 'text-opacity', o.rotulo)
}

// el rótulo de una capa (§3.3): a la derecha de un punto, al centro de un polígono o a lo largo de una línea, con halo
function capaDeRotulo(capa: CapaDibujada, rotulo: Rotulo, filtro: ExpressionSpecification, seleccion: string | null | undefined): LayerSpecification {
  const enLinea = rotulo.colocacion === 'linea'
  const enPunto: ExpressionSpecification = ['==', ['geometry-type'], 'Point']
  return {
    id: `${capa.id}-rotulo`,
    type: 'symbol',
    source: capa.id,
    filter: filtro,
    layout: {
      'text-field': ['to-string', ['coalesce', ['get', rotulo.campo], '']],
      'text-font': fuenteDelRotulo(rotulo, seleccion),
      'text-size': tamanoDelRotulo(rotulo, seleccion),
      ...(rotulo.mayusculas ? { 'text-transform': 'uppercase', 'text-letter-spacing': 0.1 } : {}),
      ...(enLinea
        ? { 'symbol-placement': 'line', 'text-max-angle': 30, 'symbol-spacing': 320 }
        : { 'text-anchor': ['case', enPunto, 'left', 'center'], 'text-offset': ['case', enPunto, ['literal', [0.9, 0]], ['literal', [0, 0]]] })
    },
    paint: { ...pinturaDelTexto(rotulo.color), 'text-opacity': opacidadesDe(capa, seleccion).rotulo }
  } as LayerSpecification
}

const limites = ([oeste, sur, este, norte]: Encuadre): [[number, number], [number, number]] => [
  [oeste, sur],
  [este, norte]
]

function encuadreDe(colecciones: Coleccion[]): [[number, number], [number, number]] | null {
  const encuadre = encuadreDeGeometrias(colecciones.flatMap((c) => c.features.map((e) => e.geometry)))
  return encuadre ? limites(encuadre) : null
}

const vistaDe = (instancia: MapLibreMap): Encuadre => {
  const b = instancia.getBounds()
  return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]
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
  zoomAlElegir = 16,
  alPulsar,
  firmar,
  vistaInicial,
  camaraPrevia,
  alMoverCamara
}: MapaImplProps) {
  const contenedor = useRef<HTMLDivElement>(null)
  const mapa = useRef<MapLibreMap | null>(null)
  const [listo, setListo] = useState(false)
  // en reposo: MapLibre terminó de pedir y dibujar (idle) y no hay datos en camino. lo lee e2e/hilo.spec.ts para afirmar que no
  // se pidió nada externo sin esperar un plazo fijo
  const [reposo, setReposo] = useState(false)
  const ultimo = useRef({ alSeleccionar, alMoverVista, alMoverCursor, alFallarWms, alPulsar, firmar, alMoverCamara })
  ultimo.current = { alSeleccionar, alMoverVista, alMoverCursor, alFallarWms, alPulsar, firmar, alMoverCamara }
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
  // la vista ya se fijó (la inicial o la cámara del mapa anterior) y se informa al moverse; antes, ninguna vista se informa
  const fijada = useRef(false)
  // el mapa nació con la cámara del anterior («Sin fondo» o el mapa base que llega): no se vuelve a encuadrar
  const desdeCamara = useRef(false)
  // las capas de texto y símbolos de cada capa (rótulo y símbolo), que van encima de todos los dibujos
  const encima = useRef(new globalThis.Map<string, string[]>())
  // los íconos puestos y cómo volver a dibujarlos con el tema activo
  const imagenes = useRef(new globalThis.Map<string, () => Imagen | null>())
  // los colores del anillo de LYR-17, para dibujar el que MapLibre pida
  const coloresDelAnillo = useRef<readonly string[]>([])
  // hay glifos propios: sin ellos (un estilo del proveedor con los suyos) no se dibuja texto
  const conTexto = useRef(false)

  useEffect(() => {
    if (!contenedor.current) return
    const trabajador = trabajadorDelMapa()
    if (trabajador) setWorkerUrl(trabajador)
    // otro fondo vuelve a crear el mapa (Mapa.tsx): nace donde estaba el anterior, sin saltar al encuadre de los datos ni pedir
    // las capas de otra vista
    const previa = camaraPrevia?.() ?? null
    desdeCamara.current = previa !== null
    encuadrado.current = previa !== null
    const instancia = new MapLibreMap({
      container: contenedor.current,
      style: estiloDe(basemap, colorDe('--sg-map-ground'), urlDeGlifos()),
      center: previa?.centro ?? [-75.5, -9.5],
      zoom: previa?.zoom ?? 5,
      attributionControl: { compact: true },
      canvasContextAttributes: { preserveDrawingBuffer: true },
      // el token de wasichai solo a las teselas del proxy (firmaDeWms); lo demás sale tal cual
      transformRequest: (url: string) => ultimo.current.firmar?.(url) ?? { url }
    })
    // acercar y alejar en una columna de 36 px y, aparte, el norte, que devuelve el mapa al norte (design-system.md §5.3 «Mapa»);
    // su aspecto, con los tokens del tema, vive en index.css
    instancia.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    instancia.addControl(new NavigationControl({ showZoom: false, visualizePitch: false }), 'top-right')
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
    // el anillo de una localidad con otro reparto de posturas: se dibuja cuando MapLibre lo pide
    instancia.setMissingStyleImageResolver((id) => {
      const dibujar = () => anilloDe(id, coloresDelAnillo.current)
      const imagen = dibujar()
      if (!imagen || instancia.hasImage(id)) return
      instancia.addImage(id, imagen, { pixelRatio: DENSIDAD })
      imagenes.current.set(id, dibujar)
    })
    instancia.on('load', () => {
      if (mapa.current !== instancia) return
      // un estilo del proveedor sin glifos recibe los propios; con los suyos, los rótulos y los conteos no se dibujan
      if (!instancia.getGlyphs()) instancia.setGlyphs(urlDeGlifos())
      conTexto.current = instancia.getGlyphs() === urlDeGlifos()
      const informar = () => {
        const centro = instancia.getCenter()
        ultimo.current.alMoverCamara?.({ centro: [centro.lng, centro.lat], zoom: instancia.getZoom() })
        if (fijada.current) ultimo.current.alMoverVista?.(vistaDe(instancia))
      }
      instancia.on('moveend', informar)
      instancia.on('mousemove', (e) => ultimo.current.alMoverCursor?.([e.lngLat.lng, e.lngLat.lat]))
      instancia.on('mouseout', () => ultimo.current.alMoverCursor?.(null))
      instancia.on('click', (e: MapMouseEvent) => ultimo.current.alPulsar?.([e.lngLat.lng, e.lngLat.lat]))
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
      encima.current.clear()
      imagenes.current.clear()
      puestos.current.clear()
      conWms.current.clear()
      invisibles.current.clear()
      encuadrado.current = false
      encuadradoA.current = null
      fijada.current = false
      // StrictMode monta, desmonta y monta de nuevo: la instancia nueva vuelve a cargar y a dibujar sus capas
      setListo(false)
    }
    // un mapa por montaje: las funciones nuevas se leen de `ultimo`
  }, [])

  // la vista de un mapa que acota sus capas por la vista (alMoverVista): sus datos dependen de la vista, así que no se encuadra a
  // ellos. se fija una sola vez, cuando la pantalla la sabe: el encuadre que da (con su vista más cercana en zoom 12), el Perú
  // entero sin él o, si nació con la cámara del mapa anterior, esa misma. recién entonces se informa, y las capas se piden una vez
  // con la vista que el mapa muestra (revisión final del plan 6.3, m1)
  const claveDeLaVista = JSON.stringify(vistaInicial ?? null)
  useEffect(() => {
    const instancia = mapa.current
    if (!instancia || !listo || fijada.current || vistaInicial === 'esperar') return
    fijada.current = true
    if (!ultimo.current.alMoverVista) return
    encuadrado.current = true
    if (!desdeCamara.current) instancia.fitBounds(limites(vistaInicial ?? PERU), { padding: 24, maxZoom: 12, duration: 0 })
    ultimo.current.alMoverVista(vistaDe(instancia))
  }, [listo, claveDeLaVista])

  // la primera capa de texto o de símbolos: los dibujos de una capa nueva van debajo de ella
  const debajoDelTexto = (): string | undefined => [...encima.current.values()].flat()[0]
  const conRotulo = (id: string): boolean => (encima.current.get(id) ?? []).includes(`${id}-rotulo`)
  // los íconos fijos de un símbolo: se agregan o, si ya están (otra capa con el mismo símbolo), se redibujan
  const ponerImagenes = (instancia: MapLibreMap, capa: string, color: string, simbolo: Simbolo) => {
    if (simbolo.forma === 'anillo') coloresDelAnillo.current = simbolo.colores
    const dibujar = () => imagenesFijas(capa, color, simbolo)
    for (const [id, imagen] of Object.entries(dibujar())) {
      if (instancia.hasImage(id)) instancia.updateImage(id, imagen)
      else instancia.addImage(id, imagen, { pixelRatio: DENSIDAD })
      imagenes.current.set(id, () => dibujar()[id] ?? null)
    }
  }

  // las capas: se agregan las nuevas, se actualizan sus datos y se quitan las que se apagaron
  const clave = capas.map((c) => `${c.id}:${identidad(c.datos)}:${c.invisible ? 1 : 0}`).join('|')
  useEffect(() => {
    const instancia = mapa.current
    if (!instancia || !listo) return
    const ids = new Set(capas.map((c) => c.id))
    for (const id of [...dibujadas.current]) {
      if (ids.has(id)) continue
      for (const sufijo of ['relleno', 'linea', 'punto', ...(conMiembros.current.has(id) ? DE_MIEMBROS : [])]) instancia.removeLayer(`${id}-${sufijo}`)
      for (const arriba of encima.current.get(id) ?? []) instancia.removeLayer(arriba)
      instancia.removeSource(id)
      dibujadas.current.delete(id)
      encima.current.delete(id)
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
          pintarVisibilidad(instancia, capa, seleccion, conRotulo(capa.id))
          if (capa.invisible) invisibles.current.add(capa.id)
          else invisibles.current.delete(capa.id)
        }
        continue
      }
      const opacidad = opacidadesDe(capa, seleccion)
      // los dibujos van debajo de los rótulos y los símbolos de todas las capas
      const abajo = debajoDelTexto()
      puestos.current.set(capa.id, capa.datos)
      // con miembros, los dibujos de la capa son solo de sus registros y los miembros van en los suyos
      const propios = (filtro: ExpressionSpecification): ExpressionSpecification => (capa.miembros ? ['all', filtro, NO_ES_MIEMBRO] : filtro)
      instancia.addSource(capa.id, { type: 'geojson', data: capa.datos as never })
      instancia.addLayer(
        {
          id: `${capa.id}-relleno`,
          type: 'fill',
          source: capa.id,
          filter: propios(POLIGONOS),
          paint: { 'fill-color': colorDe(capa.colorDeRelleno ?? capa.color), 'fill-opacity': opacidad.relleno }
        },
        abajo
      )
      instancia.addLayer(
        {
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
        },
        abajo
      )
      instancia.addLayer(
        {
          id: `${capa.id}-punto`,
          type: 'circle',
          source: capa.id,
          filter: propios(PUNTOS),
          paint: {
            ...pinturaDelPuntoDe(capa),
            'circle-radius': radioDelPunto(capa, seleccion),
            'circle-opacity': opacidad.punto,
            'circle-stroke-opacity': opacidad.bordeDelPunto
          }
        },
        abajo
      )
      if (capa.miembros) {
        instancia.addLayer(
          {
            id: `${capa.id}-miembro-relleno`,
            type: 'fill',
            source: capa.id,
            filter: ['all', POLIGONOS, ES_MIEMBRO],
            paint: { 'fill-color': color, 'fill-opacity': 0.06 }
          },
          abajo
        )
        instancia.addLayer(
          {
            id: `${capa.id}-miembro-linea`,
            type: 'line',
            source: capa.id,
            filter: ['all', LINEAS, ES_MIEMBRO],
            paint: { 'line-color': color, 'line-dasharray': [2, 2], 'line-width': ['case', elegido(seleccion), 2.5, 1.2] }
          },
          abajo
        )
        instancia.addLayer(
          {
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
          },
          abajo
        )
        conMiembros.current.add(capa.id)
      }
      const arriba: string[] = []
      if (capa.simbolo) {
        ponerImagenes(instancia, capa.id, capa.color, capa.simbolo)
        const conteo = conTexto.current ? conteoDe(capa.simbolo) : null
        instancia.addLayer({
          id: `${capa.id}-simbolo`,
          type: 'symbol',
          source: capa.id,
          filter: propios(PUNTOS),
          layout: {
            'icon-image': imagenDelSimbolo(capa.id, capa.simbolo),
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            ...(conteo
              ? {
                  'text-field': ['to-string', ['coalesce', ['get', conteo], '']],
                  'text-font': [FUENTE.bold],
                  'text-size': 11,
                  'text-allow-overlap': true,
                  'text-ignore-placement': true
                }
              : {})
          },
          // el conteo con un halo fino: va dentro del símbolo
          paint: conteo ? pinturaDelTexto('--sg-text', 2) : {}
        } as LayerSpecification)
        arriba.push(`${capa.id}-simbolo`)
      }
      if (capa.rotulo && conTexto.current) {
        const filtro = capa.rotulo.colocacion === 'linea' ? LINEAS : (['any', PUNTOS, POLIGONOS] as ExpressionSpecification)
        instancia.addLayer(capaDeRotulo(capa, capa.rotulo, propios(filtro), seleccion))
        arriba.push(`${capa.id}-rotulo`)
      }
      if (arriba.length > 0) encima.current.set(capa.id, arriba)
      if (capa.seleccionable && !conClic.current.has(capa.id)) {
        conClic.current.add(capa.id)
        for (const sufijo of ['relleno', 'punto', ...(capa.simbolo ? ['simbolo'] : []), ...(capa.miembros ? ['miembro-relleno', 'miembro-punto'] : [])]) {
          instancia.on('click', `${capa.id}-${sufijo}`, (e: MapLayerMouseEvent) => {
            const destino = destinoDe(e.features?.[0]?.properties)
            if (destino) ultimo.current.alSeleccionar?.(destino.id, capa.id, destino.objeto)
          })
        }
      }
      if (capa.invisible) invisibles.current.add(capa.id)
      dibujadas.current.add(capa.id)
    }
    // un mapa sin vista propia se encuadra a sus datos la primera vez que llegan
    if (!encuadrado.current && !ultimo.current.alMoverVista) {
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
      const capa = capas.find((c) => c.id === id)
      for (const prefijo of ['', ...(conMiembros.current.has(id) ? ['miembro-'] : [])]) {
        instancia.setPaintProperty(`${id}-${prefijo}linea`, 'line-width', ['case', elegido(seleccion), 2.5, 1.2])
        const radio: ExpressionSpecification = capa && prefijo === '' ? radioDelPunto(capa, seleccion) : ['case', elegido(seleccion), 8, 5]
        instancia.setPaintProperty(`${id}-${prefijo}punto`, 'circle-radius', radio)
      }
      // una capa invisible o con símbolo muestra del círculo solo el anillo de lo elegido
      if (capa && (invisibles.current.has(id) || capa.simbolo)) pintarVisibilidad(instancia, capa, seleccion, conRotulo(id))
      // el rótulo de lo elegido, en 14 px 800
      if (capa?.rotulo && conRotulo(id)) {
        instancia.setLayoutProperty(`${id}-rotulo`, 'text-font', fuenteDelRotulo(capa.rotulo, seleccion))
        instancia.setLayoutProperty(`${id}-rotulo`, 'text-size', tamanoDelRotulo(capa.rotulo, seleccion))
      }
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
    instancia.fitBounds(encuadre, { padding: 80, maxZoom: zoomAlElegir, duration: 300 })
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
    instancia.addSource(CALOR, { type: 'geojson', data: calor.datos as never })
    instancia.addLayer(
      {
        id: CALOR,
        type: 'heatmap',
        source: CALOR,
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'count'], 0, 0, Math.max(1, calor.maximo), 1],
          'heatmap-color': rampaDeCalor(calor.colores),
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
      // los íconos de los símbolos se vuelven a dibujar con los tokens nuevos
      for (const [id, dibujar] of imagenes.current) {
        const imagen = dibujar()
        if (imagen && instancia.hasImage(id)) instancia.updateImage(id, imagen)
      }
      // la rampa del calor (--sg-heat-*) también cambia con el tema
      if (calor && instancia.getSource(CALOR)) instancia.setPaintProperty(CALOR, 'heatmap-color', rampaDeCalor(calor.colores))
      for (const capa of capas) {
        if (!dibujadas.current.has(capa.id)) continue
        const color = colorDe(capa.color)
        instancia.setPaintProperty(`${capa.id}-relleno`, 'fill-color', colorDe(capa.colorDeRelleno ?? capa.color))
        instancia.setPaintProperty(`${capa.id}-linea`, 'line-color', color)
        const punto = pinturaDelPuntoDe(capa)
        instancia.setPaintProperty(`${capa.id}-punto`, 'circle-color', punto['circle-color'])
        instancia.setPaintProperty(`${capa.id}-punto`, 'circle-stroke-color', punto['circle-stroke-color'])
        // los rótulos y los conteos con su color y su halo del tema
        const arriba = encima.current.get(capa.id) ?? []
        if (capa.rotulo && arriba.includes(`${capa.id}-rotulo`)) {
          repintarTexto(instancia, `${capa.id}-rotulo`, capa.rotulo.color)
        }
        if (capa.simbolo && conteoDe(capa.simbolo) && arriba.includes(`${capa.id}-simbolo`) && conTexto.current) {
          repintarTexto(instancia, `${capa.id}-simbolo`, '--sg-text')
        }
        if (conMiembros.current.has(capa.id)) {
          instancia.setPaintProperty(`${capa.id}-miembro-relleno`, 'fill-color', color)
          instancia.setPaintProperty(`${capa.id}-miembro-linea`, 'line-color', color)
          instancia.setPaintProperty(`${capa.id}-miembro-punto`, 'circle-stroke-color', color)
          instancia.setPaintProperty(`${capa.id}-miembro-punto`, 'circle-color', colorDe('--sg-surface'))
        }
      }
    })
  }, [listo, clave, claveCalor])

  return <div ref={contenedor} role="region" aria-label={etiqueta} className="sg-mapa h-full w-full" data-testid="mapa" data-reposo={reposo ? 'si' : 'no'} />
}
