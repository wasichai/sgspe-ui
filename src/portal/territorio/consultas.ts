import { useMutation, useQuery } from '@tanstack/react-query'
import { usePedir } from '../datos/http'
import { consulta, type Geometria, type Pagina, type Parametros, type Registro } from '../datos/registros'

// las consultas de F6 que lee el portal (spec F6 §3.1 a §3.6, api.md §4): la forma de cada respuesta es la que dejaron 6.2a y
// 6.2b en sgspe (sgspe.territory), conciliada con las enmiendas del plan 6.3; si cambia, se cambia aquí y en src/test/sig.ts.
// ninguna escribe. un 403 de la consulta es «No disponible»; available: false con missingFields, una lista o una cifra que la
// cuenta no puede leer entera (RQ-DSH-032): se avisa, nunca se presenta como vacía o completa

export interface Lugar {
  id: string
  name: string | null
}

// la unidad administrativa de un lugar o de un punto, con su nivel (DISTRITO, PROVINCIA, DEPARTAMENTO)
export interface UnidadDelLugar extends Lugar {
  level: string | null
}

// una versión aprobada de un área de influencia que tiene el lugar como miembro. project es solo el id: la pantalla resuelve
// código y nombre con los proyectos que ya lee
export interface AreaDeLaFicha {
  id: string
  project: string | null
  areaType: string | null
  versionNumber: number | null
  // INCLUIDO o PROVISIONAL
  memberCondition: string | null
}

// la parte territorial de la ficha contextual de una localidad o una comunidad (…/card), con las listas siempre presentes.
// geometrias es una por campo (location y boundary de la localidad; territory de la comunidad), nunca una suelta. unavailable
// mezcla objetos que la cuenta no lee (community) y rutas objeto.campo (locality.boundary): su sección dice «No disponible»
export interface FichaTerritorial {
  registro: Registro
  geometrias: Record<string, Geometria | null>
  administrativeUnit: UnidadDelLugar | null
  communities: Lugar[]
  sectors: Lugar[]
  areasOfInfluence: AreaDeLaFicha[]
  unavailable: string[]
}

// la respuesta de las dos fichas: la localidad trae communities y geometry { location, boundary }; la comunidad, sectors y
// geometry { territory }
export interface RespuestaDeFicha {
  locality?: Registro
  community?: Registro
  geometry?: Partial<Record<'location' | 'boundary' | 'territory', Geometria | null>> | null
  administrativeUnit?: UnidadDelLugar | null
  communities?: Lugar[]
  sectors?: Lugar[]
  areasOfInfluence?: AreaDeLaFicha[]
  unavailable?: string[]
}

export function fichaDe(objeto: 'locality' | 'community', r: RespuestaDeFicha): FichaTerritorial {
  return {
    registro: (objeto === 'locality' ? r.locality : r.community) as Registro,
    geometrias: { ...(r.geometry ?? {}) },
    administrativeUnit: r.administrativeUnit ?? null,
    communities: r.communities ?? [],
    sectors: r.sectors ?? [],
    areasOfInfluence: r.areasOfInfluence ?? [],
    unavailable: r.unavailable ?? []
  }
}

export function useFichaTerritorial(objeto: 'locality' | 'community', id: string | null, proyecto?: string) {
  const pedir = usePedir()
  const busqueda = consulta({ project: proyecto })
  const ruta = objeto === 'locality' ? 'localities' : 'communities'
  return useQuery({
    queryKey: ['territory-card', objeto, id, busqueda],
    queryFn: async () =>
      fichaDe(objeto, await pedir<RespuestaDeFicha>(`/sgspe/territory/${ruta}/${encodeURIComponent(id ?? '')}/card${busqueda ? `?${busqueda}` : ''}`)),
    enabled: Boolean(id),
    retry: false
  })
}

export type ObjetoDeZona = 'locality' | 'community' | 'administrative_unit' | 'area_of_influence'

// los nueve objetos cuyos registros se piden por zona (of de ZoneCriterion): otro valor es 400 INVALID_OF
export const OBJETOS_DE_LA_ZONA = [
  'engagement',
  'commitment',
  'grievance',
  'inquiry',
  'stakeholder_request',
  'social_risk',
  'incident',
  'early_warning_signal',
  'stakeholder'
] as const
export type ObjetoConsultableDeZona = (typeof OBJETOS_DE_LA_ZONA)[number]

// los objetos de la zona sin fecha (ZoneTargets): con periodo, el servidor responde 400 PERIOD_NOT_APPLICABLE, así que no se manda
export const OBJETOS_SIN_PERIODO: readonly ObjetoConsultableDeZona[] = ['stakeholder', 'social_risk']

// la página de wasichai sin nextCursor, más available: false (con missingFields) si el filtro de la zona usa un campo que la
// cuenta no lee: la lista puede estar incompleta (un aviso, nunca «sin registros»)
export type RegistrosDeZona = Pagina & { available: boolean; missingFields?: string[] }

// los registros de un objeto asociados a una zona, por relación territorial o por geometría (spec §3.1, ZoneCriterion). el
// periodo: solo periodStart, hasta hoy en Lima; solo periodEnd, el año que termina ahí; más de 5 años, 400 OUT_OF_RANGE
export function useRegistrosDeLaZona(
  zona: ObjetoDeZona,
  id: string | null,
  of: ObjetoConsultableDeZona | null,
  filtros: { periodStart?: string; periodEnd?: string; page?: number } = {}
) {
  const pedir = usePedir()
  const conPeriodo = of !== null && !OBJETOS_SIN_PERIODO.includes(of)
  const busqueda = consulta({
    of,
    periodStart: conPeriodo ? filtros.periodStart : undefined,
    periodEnd: conPeriodo ? filtros.periodEnd : undefined,
    page: filtros.page,
    size: 25
  })
  return useQuery({
    queryKey: ['zone-records', zona, id, busqueda],
    queryFn: () => pedir<RegistrosDeZona>(`/sgspe/territory/zones/${zona}/${encodeURIComponent(id ?? '')}/records?${busqueda}`),
    enabled: Boolean(id && of),
    retry: false
  })
}

// el mapa de calor (spec §3.1): conteos por localidad o comunidad, nunca por punto
export const OBJETOS_DE_CALOR = ['grievance', 'inquiry', 'stakeholder_request', 'engagement', 'incident', 'early_warning_signal'] as const
export type ObjetoDeCalor = (typeof OBJETOS_DE_CALOR)[number]

export interface Celda {
  object: 'locality' | 'community'
  id: string
  name: string | null
  point: Geometria | null
  count: number
}

// el periodo que contó el servidor viaja siempre (sin pedirlo, los 12 meses que terminan hoy en Lima); truncated, más celdas
// que limit. confidentialHidden viaja con of en QCS cuando se ocultan confidenciales (plan 6.2c); un backend anterior no lo trae
export interface Concentracion {
  confidentialHidden?: boolean
  available: boolean
  missingFields?: string[]
  truncated: boolean
  of: string
  periodStart: string
  periodEnd: string
  cells: Celda[]
}

export function useConcentracion(of: ObjetoDeCalor | null, filtros: { project?: string | readonly string[]; periodStart?: string; periodEnd?: string }) {
  const pedir = usePedir()
  const busqueda = consulta({ of, project: filtros.project, periodStart: filtros.periodStart, periodEnd: filtros.periodEnd })
  return useQuery({
    queryKey: ['concentration', busqueda],
    queryFn: () => pedir<Concentracion>(`/sgspe/territory/concentration?${busqueda}`),
    enabled: Boolean(of),
    retry: false,
    staleTime: 60_000
  })
}

// el panel «Análisis» de S09: los casos 7, 10 a 14 de gis.md §5.3
export interface Componente {
  id: string
  code: string | null
  componentType: string | null
}

// un titular vigente de un predio (sin end_date o con fin desde hoy en Lima); name null si la cuenta no lee su nombre
export interface Titular {
  object: 'person' | 'organization'
  id: string
  name: string | null
}

export interface PredioAfectado {
  component: Componente
  parcel: { id: string; code: string | null; tenureType: string | null }
  // null si la cuenta no lee los derechos (available: false con land_right.* en missingFields)
  holders: Titular[] | null
  lengthM: number | null
  areaHa: number | null
}

export interface TerritorioComunalAfectado {
  component: Componente
  community: Lugar
  areaHa: number | null
  lengthM: number | null
}

export interface DistanciaSensible {
  component: Componente
  feature: { id: string; name: string | null; featureType: string | null }
  distanceM: number | null
}

// sin distancia ni componente; más de max-rows es 400 TOO_MANY_RECORDS sobre bufferM (no se recorta)
export interface LocalidadEnBuffer {
  id: string
  name: string | null
  localityType: string | null
}

// plano: la concesión y el lugar que corta. areaHa null si el lugar es un punto
export interface TerritorioDeConcesion {
  concession: { id: string; code: string | null; name: string | null }
  object: 'community' | 'community_sector' | 'locality'
  id: string
  name: string | null
  localityType: string | null
  areaHa: number | null
}

// ordenados por distancia; la pantalla muestra km como distanceM / 1000
export interface ConflictoCercano {
  object: 'incident' | 'early_warning_signal' | 'local_conflict'
  id: string
  label: string | null
  distanceM: number | null
}

export type ConsultaDelProyecto =
  'component-parcels' | 'component-communal-land' | 'sensitive-distances' | 'buffer-localities' | 'concession-territories' | 'nearby-conflicts'

export interface Filas<T> {
  filas: T[]
  disponible: boolean
  camposFaltantes: string[]
  // el servidor recortó la lista en limit: la tabla avisa «se muestran las primeras N»
  recortada: boolean
}

// las respuestas traen rows, localities (buffer) o items (conflictos); available: false dice que falta un permiso secundario y
// truncated: true, que hay más filas que las que vinieron
export function filasDe<T>(r: { rows?: T[]; localities?: T[]; items?: T[]; available?: boolean; missingFields?: string[]; truncated?: boolean }): Filas<T> {
  return {
    filas: r.rows ?? r.localities ?? r.items ?? [],
    disponible: r.available !== false,
    camposFaltantes: r.missingFields ?? [],
    recortada: r.truncated === true
  }
}

export function useAnalisis<T>(proyecto: string, que: ConsultaDelProyecto, parametros: Parametros = {}, activo = true) {
  const pedir = usePedir()
  const busqueda = consulta(parametros)
  return useQuery({
    queryKey: ['territory-analysis', proyecto, que, busqueda],
    queryFn: async () => filasDe<T>(await pedir(`/sgspe/territory/projects/${encodeURIComponent(proyecto)}/${que}${busqueda ? `?${busqueda}` : ''}`)),
    enabled: activo && Boolean(proyecto),
    retry: false
  })
}

// S10: las sugerencias del cálculo y el resumen del área. las unidades sugeridas son solo distritos
export interface Sugerencia {
  object: 'locality' | 'community' | 'administrative_unit'
  recordId: string
  name: string | null
  // sin bufferM solo llega INTERSECTS
  relation: 'INTERSECTS' | 'WITHIN_BUFFER'
  // null: la cuenta no lee los miembros del área y no se sabe si ya lo es
  alreadyMember: boolean | null
}

export interface Sugerencias {
  available: boolean
  missingFields?: string[]
  suggestions: Sugerencia[]
}

export function useSugerencias(area: string, bufferM: number | null, activo: boolean) {
  const pedir = usePedir()
  const busqueda = consulta({ bufferM: bufferM ?? undefined })
  return useQuery({
    queryKey: ['member-suggestions', area, busqueda],
    queryFn: () => pedir<Sugerencias>(`/sgspe/areas-of-influence/${encodeURIComponent(area)}/member-suggestions${busqueda ? `?${busqueda}` : ''}`),
    enabled: activo,
    retry: false
  })
}

// cada cifra null es «No disponible», nunca 0. localitiesByType puede traer la clave SIN DATO
export interface ResumenDelArea {
  available: boolean
  missingFields?: string[]
  areaHa: number | null
  localitiesByType: { localityType: string; count: number }[] | null
  componentsOnCommunalLand: number | null
  componentsOnPrivateLand: number | null
}

export function useResumenDelArea(area: string) {
  const pedir = usePedir()
  return useQuery({
    queryKey: ['area-summary', area],
    queryFn: () => pedir<ResumenDelArea>(`/sgspe/areas-of-influence/${encodeURIComponent(area)}/summary`),
    enabled: Boolean(area),
    retry: false
  })
}

// punto en polígono (caso 16): lo que el punto propone; la persona confirma. la localidad sale solo por su límite (hueco H6).
// unavailable nombra los objetos que la cuenta no lee: su lugar sale null por eso, no porque no haya
export interface Ubicados {
  administrativeUnit: UnidadDelLugar | null
  locality: (Lugar & { localityType: string | null }) | null
  community: Lugar | null
  unavailable: string[]
}

export function useUbicar(punto: [number, number] | null) {
  const pedir = usePedir()
  const lon = punto ? punto[0].toFixed(6) : ''
  const lat = punto ? punto[1].toFixed(6) : ''
  return useQuery({
    queryKey: ['locate', lon, lat],
    queryFn: () => pedir<Ubicados>(`/sgspe/territory/locate?lon=${lon}&lat=${lat}`),
    enabled: punto !== null,
    retry: false
  })
}

// la validación previa de una geometría (spec §3.6): no escribe. typeMatches === (normalized !== null): normalized es la
// geometría en el tipo del campo (la misma, envuelta en Multi o desenvuelta); repaired ya viene en ese tipo cuando se puede.
// reason es una etiqueta en español sin coordenadas («autointersección»). las áreas son null sin zona de cálculo
export interface RevisionDeGeometria {
  valid: boolean
  reason: string | null
  typeMatches: boolean
  normalized: Geometria | null
  repaired: Geometria | null
  areaHaBefore: number | null
  areaHaAfter: number | null
  zone: { srid: number | null; outOfZone: boolean; outOfRegion: boolean }
}

export interface PedidoDeRevision {
  geometry: Geometria
  object: string
  field: string
  project?: string
}

export function useRevisarGeometria() {
  const pedir = usePedir()
  return useMutation({
    mutationFn: ({ geometry, object, field, project }: PedidoDeRevision) =>
      pedir<RevisionDeGeometria>('/sgspe/territory/geometry-checks', { json: { geometry, object, field, ...(project ? { project } : {}) } })
  })
}

// el listado de calidad (S63, gis.md §8)
export const REVISIONES = ['INVALID', 'OUT_OF_ZONE', 'STALE_AREA', 'NO_TERRITORY', 'NO_GEOMETRY'] as const
export type Revision = (typeof REVISIONES)[number]

// una fila por registro y campo (la clave de React es `${object}-${id}-${field}`); detail viene armado en español
export interface FilaDeCalidad {
  object: string
  id: string
  label: string | null
  field: string | null
  detail: string | null
}

// sin total de páginas: «Siguiente» se habilita con hasNext
export interface PaginaDeCalidad {
  check: Revision
  content: FilaDeCalidad[]
  page: number
  size: number
  hasNext: boolean
}

export function useCalidad(filtros: { check: Revision; object?: string; project?: string; page: number }) {
  const pedir = usePedir()
  const busqueda = consulta({ check: filtros.check, object: filtros.object, project: filtros.project, page: filtros.page, size: 50 })
  return useQuery({
    queryKey: ['data-quality', busqueda],
    queryFn: () => pedir<PaginaDeCalidad>(`/sgspe/territory/data-quality?${busqueda}`),
    retry: false
  })
}

// los formatos de importación que ofrece el servidor (GDAL instalado o no; spec §3.4)
export interface Formato {
  format: string
  available: boolean
  multiLayer: boolean
  crsFromFile: boolean
}

export function useFormatosDeImportacion() {
  const pedir = usePedir()
  return useQuery({
    queryKey: ['import-formats'],
    queryFn: () => pedir<{ formats: Formato[] }>('/sgspe/territory/imports/formats'),
    staleTime: 5 * 60_000,
    retry: false
  })
}
