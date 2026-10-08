import { useQueries } from '@tanstack/react-query'
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

// el encuadre se redondea para que mover un poco el mapa no pida la capa de nuevo
const redondear = (b: Encuadre | null) => (b ? b.map((v) => v.toFixed(3)).join(',') : undefined)

export function useCapas(ids: readonly string[], filtros: { project?: string; bbox?: Encuadre | null }): EstadoDeCapa[] {
  const pedir = usePedir()
  const busqueda = consulta({ project: filtros.project, bbox: redondear(filtros.bbox ?? null) })
  const consultas = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['layer', id, busqueda],
      queryFn: () => pedir<Coleccion>(`/sgspe/territory/layers/${id}?${busqueda}`),
      staleTime: 60_000,
      retry: false
    }))
  })
  return ids.map((id, i) => {
    const c = consultas[i]
    const bloqueada = c.error instanceof ApiError && c.error.status === 403
    return { id, datos: c.data ?? null, bloqueada, truncada: c.data?.truncated === true, cargando: c.isPending, error: bloqueada ? null : c.error }
  })
}
