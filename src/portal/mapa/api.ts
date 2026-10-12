import { useQueries, useQuery } from '@tanstack/react-query'
import { useRef } from 'react'
import { ApiError } from '@wasichai/core'
import { usePedir } from '../datos/http'
import { consulta } from '../datos/registros'

// una capa LYR-NN como GeoJSON EPSG:4326 (api.md §4.2): cada elemento lleva en properties el id de su registro (__id), su
// objeto (__object) y los atributos que la cuenta puede leer (la forma de wasichai-gis). sin permiso, la capa llega como
// 403 y el control la muestra con candado y su razón. la capa tiene un tope de elementos: truncated es true si había más,
// y el control pide acercar el mapa. el servidor recorta el bbox a [-180, 180] y [-90, 90], así que el cliente lo manda tal
// como lo informa el mapa
export interface Elemento {
  type: 'Feature'
  id?: string | number
  geometry: { type: string; coordinates: unknown } | null
  properties: Record<string, unknown>
}

export interface Coleccion {
  type: 'FeatureCollection'
  features: Elemento[]
  truncated?: boolean
  // las capas de gestión (LYR-17 a LYR-24, plan 6.2c; H1 bis del plan 6.3): available es false si quien pide no lee parte de la
  // capa (missingFields dice qué), periodNotApplied nombra los objetos de la capa que el periodo no filtra y confidentialHidden
  // (LYR-20) dice que a quien pide se le ocultan QCS confidenciales
  available?: boolean
  missingFields?: string[]
  periodNotApplied?: string[]
  confidentialHidden?: boolean
}

export type Encuadre = [number, number, number, number]

export interface EstadoDeCapa {
  id: string
  datos: Coleccion | null
  bloqueada: boolean
  // la capa llegó recortada al tope de elementos
  truncada: boolean
  cargando: boolean
  error: unknown
}

export const idDeElemento = (e: Elemento): string => String(e.properties.__id ?? String(e.id ?? '').split(':')[0])

// LYR-13 trae, además de cada área aprobada, sus miembros: __object area_of_influence_member, con __target (locality o
// community) y __targetId, el lugar cuya geometría se dibuja (api.md §4.2). elegir un miembro lleva a ese lugar
export const MIEMBRO = 'area_of_influence_member'
export const esMiembro = (propiedades: Record<string, unknown> | null | undefined): boolean => propiedades?.__object === MIEMBRO

// a qué registro lleva elegir un elemento: el suyo o, si es un miembro de un área, el lugar que dibuja
export function destinoDe(propiedades: Record<string, unknown> | null | undefined): { id: string; objeto: string | null } | null {
  if (!propiedades) return null
  const miembro = esMiembro(propiedades)
  const id = miembro ? propiedades.__targetId : propiedades.__id
  const objeto = miembro ? propiedades.__target : propiedades.__object
  return typeof id === 'string' ? { id, objeto: typeof objeto === 'string' ? objeto : null } : null
}

// el encuadre se redondea hacia afuera (mínimos hacia abajo, máximos hacia arriba, a milésimas de grado) para que mover un
// poco el mapa no pida la capa de nuevo y la vista nunca quede recortada en el borde
const redondear = (b: Encuadre | null) => (b ? b.map((v, i) => ((i < 2 ? Math.floor(v * 1000) : Math.ceil(v * 1000)) / 1000).toFixed(3)).join(',') : undefined)

// el Perú entero (con su mar territorial cercano): la vista con la que abre un mapa que acota sus capas por la vista cuando la
// pantalla no conoce un encuadre propio, y la que se usa si el mapa no se puede mostrar (sin WebGL)
export const PERU: Encuadre = [-81.4, -18.4, -68.6, 0.1]

// la vista abarca todo el encuadre: con el Perú entero a la vista, un mapa vacío no lo está por la vista
export const abarca = (vista: Encuadre, encuadre: Encuadre): boolean =>
  vista[0] <= encuadre[0] && vista[1] <= encuadre[1] && vista[2] >= encuadre[2] && vista[3] >= encuadre[3]

// el encuadre de unas geometrías (de un registro: la ubicación y el área de interés de un proyecto), o null si no hay ninguna
export function encuadreDeGeometrias(geometrias: readonly ({ coordinates: unknown } | null | undefined)[]): Encuadre | null {
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
  for (const g of geometrias) visitar(g?.coordinates)
  return Number.isFinite(oeste) ? [oeste, sur, este, norte] : null
}

export interface FiltrosDeCapa {
  project?: string
  bbox?: Encuadre | null
  // las capas siguen la vista del mapa (S09 y S12): sin vista todavía (bbox null) no se pide nada, ni una lectura sin bbox que a
  // volumen trae la capa casi entera (revisión final del plan 6.3, m1); las capas quedan cargando hasta que el mapa informa
  porVista?: boolean
  // el periodo de las capas de gestión (AAAA-MM-DD); las de F2 no tienen fecha y no lo reciben (Layers.kt)
  periodStart?: string
  periodEnd?: string
}

export function useCapas(ids: readonly string[], filtros: FiltrosDeCapa): EstadoDeCapa[] {
  const pedir = usePedir()
  const busqueda = consulta({
    project: filtros.project,
    periodStart: filtros.periodStart,
    periodEnd: filtros.periodEnd,
    bbox: redondear(filtros.bbox ?? null)
  })
  // las capas que respondieron 403 en este proyecto: no se piden de nuevo al mover el mapa (un 403 no depende del bbox)
  const sinPermiso = useRef({ project: filtros.project, ids: new Set<string>() })
  if (sinPermiso.current.project !== filtros.project) sinPermiso.current = { project: filtros.project, ids: new Set() }
  // lo último que respondió cada capa en este proyecto y periodo. useQueries crea un observador nuevo por cada clave (el encuadre
  // va en ella), así que placeholderData/keepPreviousData no conserva nada entre un encuadre y el siguiente: se conserva aquí. otro
  // periodo no conserva nada: lo dibujado sería de otras fechas
  const alcance = `${filtros.project ?? ''}|${filtros.periodStart ?? ''}|${filtros.periodEnd ?? ''}`
  const ultimos = useRef({ alcance, datos: new Map<string, Coleccion>() })
  if (ultimos.current.alcance !== alcance) ultimos.current = { alcance, datos: new Map() }
  const consultas = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['layer', id, filtros.project ?? null, busqueda],
      queryFn: () => pedir<Coleccion>(`/sgspe/territory/layers/${id}?${busqueda}`),
      staleTime: 60_000,
      retry: false,
      enabled: !sinPermiso.current.ids.has(id) && !(filtros.porVista && !filtros.bbox)
    }))
  })
  return ids.map((id, i) => {
    const c = consultas[i]
    if (c.error instanceof ApiError && c.error.status === 403) sinPermiso.current.ids.add(id)
    const bloqueada = sinPermiso.current.ids.has(id)
    // al mover el mapa se conserva lo dibujado (y el aviso de acercar) hasta que llega la capa del nuevo encuadre
    if (c.data) ultimos.current.datos.set(id, c.data)
    const datos = bloqueada ? null : (c.data ?? ultimos.current.datos.get(id) ?? null)
    return {
      id,
      datos,
      bloqueada,
      truncada: datos?.truncated === true,
      cargando: !bloqueada && !datos && c.isPending,
      error: bloqueada ? null : c.error
    }
  })
}

// el encuadre de la sonda: un punto en el golfo de Guinea (0, 0), lejos del Perú, así que la respuesta no trae elementos.
// INVALID_BBOX solo rechaza un mínimo mayor que el máximo (Layers.kt). no es gratis en la base: en 6.2c, LYR-17 y los aportes de
// LYR-23 agrupan la tabla entera antes de filtrar por el encuadre, por eso se sondea una capa de registros y no los agregados
const SIN_LUGARES = '0,0,0,0'

// las capas de gestión (LYR-17 a LYR-24) llegan juntas con un solo plan del backend (6.2c): hasta entonces layers/{layer}
// responde 404 LAYER_NOT_FOUND (H1 del plan 6.3) y ninguna se ofrece. se sondea una sola capa de registros (sonda) una vez por
// sesión; un 404 (con o sin código: el de un backend sin la ruta es igual de definitivo) oculta todas, y cualquier otra respuesta
// las deja ver todas, porque la lectura de cada una dirá su 403 (candado) o su error al encenderla. mientras la sonda no
// responde, ninguna se ofrece. la caché no pasa de una cuenta a otra: el cierre de sesión de core vacía el QueryClient
export function useCapasDisponibles(ids: readonly string[], sonda: string): { disponibles: readonly string[]; cargando: boolean } {
  const pedir = usePedir()
  const existe = useQuery({
    queryKey: ['layer-probe', sonda],
    queryFn: async () => {
      try {
        await pedir<Coleccion>(`/sgspe/territory/layers/${sonda}?${consulta({ bbox: SIN_LUGARES })}`)
        return true
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return false
        return true
      }
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false
  })
  return { disponibles: existe.data === true ? ids : [], cargando: existe.isPending }
}
