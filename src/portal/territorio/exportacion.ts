import type { Formato } from './consultas'

// las exportaciones geográficas (spec F6 §3.5, ASM-124): solo los objetos de LYR-01 a LYR-16, con la divulgación por objeto de
// ExportDisclosure. la capa fija el objeto, la geometría y los filtros que la definen (gis.md §2.2); el servidor vuelve a juzgar
// todo (DISCLOSURE_NOT_ALLOWED). las capas de gestión (LYR-17 a 24) nunca se exportan
export type Nivel = 'INTERNO' | 'EXTERNO' | 'PUBLICO'

// filtros en la forma del cuerpo (filters.componentType y filters.tenureType, en camelCase; enmienda 12.1)
export interface CapaExportable {
  capa: string
  objetos: { objeto: string; geometrias: string[] }[]
  filtros?: { componentType?: string[]; tenureType?: string[] }
  niveles: Nivel[]
}

const TODOS: Nivel[] = ['INTERNO', 'EXTERNO', 'PUBLICO']
const INTERNAS: Nivel[] = ['INTERNO', 'EXTERNO']
const CONFIDENCIALES: Nivel[] = ['INTERNO']

// LYR-03 (ciudades) no está: la exportación de locality no filtra el tipo y entrega todas las localidades (hueco H4); LYR-02
// las ofrece una sola vez, con las ciudades
export const CAPAS_EXPORTABLES: readonly CapaExportable[] = [
  { capa: 'LYR-01', objetos: [{ objeto: 'administrative_unit', geometrias: ['boundary'] }], niveles: TODOS },
  { capa: 'LYR-02', objetos: [{ objeto: 'locality', geometrias: ['location', 'boundary'] }], niveles: TODOS },
  { capa: 'LYR-04', objetos: [{ objeto: 'road_access', geometrias: ['trace'] }], niveles: TODOS },
  { capa: 'LYR-05', objetos: [{ objeto: 'community', geometrias: ['territory'] }], niveles: TODOS },
  { capa: 'LYR-06', objetos: [{ objeto: 'community_sector', geometrias: ['boundary'] }], niveles: INTERNAS },
  { capa: 'LYR-07', objetos: [{ objeto: 'mining_concession', geometrias: ['boundary'] }], niveles: TODOS },
  { capa: 'LYR-08', objetos: [{ objeto: 'environmental_feature', geometrias: ['boundary', 'trace', 'location'] }], niveles: INTERNAS },
  { capa: 'LYR-09', objetos: [{ objeto: 'project', geometrias: ['location', 'interest_area'] }], niveles: INTERNAS },
  { capa: 'LYR-10', objetos: [{ objeto: 'project_component', geometrias: ['location'] }], filtros: { componentType: ['SONDAJE'] }, niveles: CONFIDENCIALES },
  {
    capa: 'LYR-11',
    objetos: [{ objeto: 'project_component', geometrias: ['footprint', 'location'] }],
    filtros: { componentType: ['PLATAFORMA', 'CAMPAMENTO', 'CAPTACION'] },
    niveles: CONFIDENCIALES
  },
  { capa: 'LYR-12', objetos: [{ objeto: 'project_component', geometrias: ['trace'] }], filtros: { componentType: ['ACCESO'] }, niveles: INTERNAS },
  { capa: 'LYR-13', objetos: [{ objeto: 'area_of_influence', geometrias: ['boundary'] }], niveles: INTERNAS },
  {
    capa: 'LYR-14',
    objetos: [{ objeto: 'land_parcel', geometrias: ['boundary'] }],
    filtros: { tenureType: ['PROPIEDAD', 'POSESION', 'COMUNAL'] },
    niveles: INTERNAS
  },
  {
    capa: 'LYR-15',
    objetos: [{ objeto: 'land_parcel', geometrias: ['boundary'] }],
    filtros: { tenureType: ['PROPIEDAD DE LA EMPRESA'] },
    niveles: CONFIDENCIALES
  },
  {
    capa: 'LYR-16',
    objetos: [
      { objeto: 'school', geometrias: ['location'] },
      { objeto: 'health_facility', geometrias: ['location'] }
    ],
    niveles: TODOS
  }
]

// una capa del mapa que se exporta como otra: las ciudades salen con todas las localidades
const EXPORTADA_COMO: Readonly<Record<string, string>> = { 'LYR-03': 'LYR-02' }

// la capa que se exporta al pedir una capa del mapa, si la cuenta la exporta
export const capaExportable = (capas: CapaExportable[], pedida: string | undefined): CapaExportable | undefined =>
  pedida ? capas.find((c) => c.capa === (EXPORTADA_COMO[pedida] ?? pedida)) : undefined

export const FORMATOS_DE_EXPORTACION = ['geojson', 'kml', 'gpkg', 'shp', 'csv', 'xlsx'] as const
export type FormatoDeExportacion = (typeof FORMATOS_DE_EXPORTACION)[number]
// GeoJSON y KML se escriben siempre en EPSG 4326 (spec §3.5): UTM con ellos es INVALID_COORDINATES
export const SOLO_LATLON: ReadonlySet<string> = new Set(['geojson', 'kml'])
export type Coordenadas = 'UTM' | 'LATLON'

// los objetos que el servidor acota por filters.project (TerritoryExports.projectsFor). filters.project se valida en todos
// (NOT_ASSIGNED), así que a los demás solo se manda cuando hace falta: con UTM, por el CRS de trabajo (enmienda 12.2)
const ACOTADOS_POR_PROYECTO: ReadonlySet<string> = new Set(['project', 'project_component', 'area_of_influence', 'mining_concession'])

// los formatos que escribe GDAL (GdalWriter): sin endpoint propio, el available de imports/formats (mismos drivers) es la pista
// (hueco H3); el 422 FORMAT_UNAVAILABLE se maneja igual
const CON_GDAL: ReadonlySet<string> = new Set(['kml', 'gpkg', 'shp'])

type Puede = (objeto: string, accion: string) => boolean

// la capa se ofrece si alguno de sus objetos se lee y se exporta (READ y EXPORT, spec §3.5); de LYR-16 quedan los que se puedan
export function capasExportables(can: Puede): CapaExportable[] {
  return CAPAS_EXPORTABLES.flatMap((c) => {
    const objetos = c.objetos.filter((o) => can(o.objeto, 'READ') && can(o.objeto, 'EXPORT'))
    return objetos.length > 0 ? [{ ...c, objetos }] : []
  })
}

export function cuerpoDeExportacion({
  capa,
  objeto,
  geometria,
  formato,
  coordenadas,
  proyecto,
  nivel = 'INTERNO'
}: {
  capa: CapaExportable
  objeto: string
  geometria: string
  formato: string
  coordenadas: Coordenadas
  proyecto?: string
  nivel?: string
}) {
  const coordinates: Coordenadas = SOLO_LATLON.has(formato) ? 'LATLON' : coordenadas
  // en EXTERNO el servidor aplica el filtro fijo del objeto (solo accesos, solo las tres tenencias; enmienda 12.5): las capas
  // que se exportan en EXTERNO no mandan el suyo
  const filtrosDeCapa = nivel === 'EXTERNO' ? {} : (capa.filtros ?? {})
  const conProyecto = proyecto && (ACOTADOS_POR_PROYECTO.has(objeto) || coordinates === 'UTM')
  return {
    object: objeto,
    geometry: geometria,
    format: formato,
    coordinates,
    filters: { ...filtrosDeCapa, ...(conProyecto ? { project: [proyecto] } : {}) }
  }
}

// el Shapefile llega en un ZIP con su .cpg UTF-8
export const extensionDe = (formato: string): string => (formato === 'shp' ? 'zip' : formato)

// el nombre que pone el servidor en Content-Disposition (<objeto-con-guiones>-<nivel>.<ext>), por si no llega
export const nombrePorDefecto = (objeto: string, nivel: string, formato: string): string =>
  `${objeto.replaceAll('_', '-')}-${nivel.toLowerCase()}.${extensionDe(formato)}`

// sin la lista (un backend sin F6, una cuenta que no la lee) o sin el formato en ella, se ofrece y decide el servidor
export function formatoDisponible(formato: string, formatos: Formato[] | undefined): boolean {
  if (!CON_GDAL.has(formato)) return true
  return formatos?.find((f) => f.format === formato)?.available ?? true
}
