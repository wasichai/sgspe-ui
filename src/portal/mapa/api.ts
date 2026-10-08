import { useQueries } from '@tanstack/react-query'
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

export function useCapas(ids: readonly string[], filtros: { project?: string; bbox?: Encuadre | null }): EstadoDeCapa[] {
  const pedir = usePedir()
  const busqueda = consulta({ project: filtros.project, bbox: redondear(filtros.bbox ?? null) })
  // las capas que respondieron 403 en este proyecto: no se piden de nuevo al mover el mapa (un 403 no depende del bbox)
  const sinPermiso = useRef({ project: filtros.project, ids: new Set<string>() })
  if (sinPermiso.current.project !== filtros.project) sinPermiso.current = { project: filtros.project, ids: new Set() }
  // lo último que respondió cada capa en este proyecto. useQueries crea un observador nuevo por cada clave (el encuadre va en
  // ella), así que placeholderData/keepPreviousData no conserva nada entre un encuadre y el siguiente: se conserva aquí
  const ultimos = useRef({ project: filtros.project, datos: new Map<string, Coleccion>() })
  if (ultimos.current.project !== filtros.project) ultimos.current = { project: filtros.project, datos: new Map() }
  const consultas = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['layer', id, filtros.project ?? null, busqueda],
      queryFn: () => pedir<Coleccion>(`/sgspe/territory/layers/${id}?${busqueda}`),
      staleTime: 60_000,
      retry: false,
      enabled: !sinPermiso.current.ids.has(id)
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
