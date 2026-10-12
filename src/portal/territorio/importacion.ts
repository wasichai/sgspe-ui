import { useMutation } from '@tanstack/react-query'
import { ACEPTAR_REPORTE, ErrorDeSgspe, esCodigo, usePedir, nuevaClave } from '../datos/http'
import type { Formato } from './consultas'

// la importación geoespacial de api.md §4.2 (gis.md §4.2): la vista previa no deja estado en el servidor, así que la
// confirmación vuelve a mandar lo mismo que la vista previa (archivo, destino, proyecto, CRS de origen y columnas) con el
// SHA-256 de la vista previa y las decisiones fila por fila; el servidor repite la validación con ellos. como la
// confirmación concilia de nuevo, lo registrado puede haber cambiado entre las dos llamadas: sus conteos se comparan con
// los que preveía la vista previa
// F2: componentes, predios y concesiones; F6 suma el territorio comunal y los elementos ambientales (spec §3.4, ASM-123)
export type Destino = 'project_component' | 'land_parcel' | 'mining_concession' | 'community' | 'environmental_feature'
export const DESTINOS_DE_F2: readonly Destino[] = ['project_component', 'land_parcel', 'mining_concession']
export const DESTINOS: readonly Destino[] = [...DESTINOS_DE_F2, 'community', 'environmental_feature']
// los destinos que son polígonos (su archivo es vectorial, nunca una hoja de puntos): solo entran polígonos; un punto o una
// línea del archivo llega como fila inválida, no como error del pedido
export const DESTINOS_VECTORIALES: readonly Destino[] = ['community', 'environmental_feature']

// importar a un destino crea y actualiza (nuevas versiones y cambios): la pantalla lo ofrece con CREATE y UPDATE sobre él, y
// los enlaces a la importación piden lo mismo, para no llevar a «sin destinos»
export const importaA = (can: (objeto: string, accion: string) => boolean, destino: Destino): boolean => can(destino, 'CREATE') && can(destino, 'UPDATE')

// el caso de cada fila válida frente a lo registrado (gis.md §4.4): constantes de la API en inglés (api.md §3.2)
export type Caso = 'CREATE' | 'UNCHANGED' | 'NEW_VERSION' | 'UPDATE'

export interface Diferencia {
  row: number
  code: string
  outcome: Caso
  currentVersion?: number | null
  distanceM?: number | null
}

export interface FilaInvalida {
  row: number
  field?: string
  message: string
}

export interface FilaFueraDeZona {
  row: number
  code?: string
  message?: string
}

export interface VistaPrevia {
  importBatchId: string
  sha256: string
  target?: Destino
  sourceCrs?: string
  // desde F6: el formato leído, la capa elegida y el CRS que declara el archivo, siempre un valor del catálogo «CRS de origen»
  // o null si el archivo no declara uno del catálogo: una propuesta, nunca un valor por defecto (CON-024)
  format?: string
  layer?: string | null
  detectedCrs?: string | null
  rows: number
  valid: number
  invalid: FilaInvalida[]
  differences: Diferencia[]
  outOfZone: FilaFueraDeZona[]
}

export interface Decision {
  row: number
  action: 'APPLY' | 'DISCARD'
}

export interface Resultado {
  created: number
  newVersions: number
  updated: number
  unchanged: number
  rejected: number
  evidenceId: string | null
}

// las columnas del archivo: el nombre de la columna de cada dato (o de la propiedad del código en un GeoJSON)
export type Columnas = Partial<
  Record<'code' | 'name' | 'featureType' | 'easting' | 'northing' | 'elevation' | 'azimuth' | 'dip' | 'depth' | 'drillType' | 'latitude' | 'longitude', string>
>

export interface Pedido {
  archivo: File
  destino: Destino
  proyecto: string
  crs: string
  columnas: Columnas
  // la capa de un archivo de varias (GeoPackage, KML, FileGDB…): viaja como layer
  capa?: string
}

const formulario = ({ archivo, destino, proyecto, crs, columnas, capa }: Pedido) => {
  const f = new FormData()
  f.append('file', archivo)
  f.append('target', destino)
  f.append('project', proyecto)
  // sin CRS, un formato de GDAL solo se lee: el servidor responde 400 con sus capas y el CRS que declara cada una (6.2b)
  if (crs) f.append('sourceCrs', crs)
  f.append('columns', JSON.stringify(columnas))
  if (capa) f.append('layer', capa)
  return f
}

export function useVistaPrevia() {
  const pedir = usePedir()
  return useMutation({ mutationFn: (pedido: Pedido) => pedir<VistaPrevia>('/sgspe/territory/imports', { formulario: formulario(pedido) }) })
}

// el reporte de diferencias: la misma vista previa pedida con Accept de XLSX
export function useReporte() {
  const pedir = usePedir()
  return useMutation({
    mutationFn: (pedido: Pedido) => pedir.archivo('/sgspe/territory/imports', { formulario: formulario(pedido), aceptar: ACEPTAR_REPORTE })
  })
}

// confirmar: el pedido completo de la vista previa otra vez, más el SHA-256, las decisiones y la clave de idempotencia.
// alConfirmar corre en la propia mutación: se dispara aunque la pantalla ya se haya desmontado cuando llega la respuesta
export function useConfirmacion(alConfirmar?: () => void) {
  const pedir = usePedir()
  return useMutation({
    onSuccess: alConfirmar,
    mutationFn: ({ vista, pedido, decisiones, clave }: { vista: VistaPrevia; pedido: Pedido; decisiones: Decision[]; clave: string }) => {
      const f = formulario(pedido)
      f.append('sha256', vista.sha256)
      f.append('decisions', JSON.stringify(decisiones))
      return pedir<Resultado>(`/sgspe/territory/imports/${vista.importBatchId}/confirm`, { formulario: f, clave })
    }
  })
}

export interface FilaConDecision {
  row: number
  code: string
  caso: Caso | 'OUT_OF_ZONE'
  distanceM?: number | null
  // el motivo que dio el servidor para una fila fuera de zona
  mensaje?: string
}

// las filas que piden decisión, una por fila: versión nueva, actualización y fuera de zona (gis.md §4.3 y §4.4). una fila
// fuera de zona solo entra con un APPLY explícito, así que manda sobre el caso de su diferencia. solo las filas válidas
// (las de differences[] y outOfZone[]) llevan decisión: una decisión sobre una fila inválida es un 400
export function filasConDecision(vista: VistaPrevia): FilaConDecision[] {
  const invalidas = new Set(vista.invalid.map((i) => i.row))
  const fuera = new Map(vista.outOfZone.filter((o) => !invalidas.has(o.row)).map((o) => [o.row, o]))
  const diferencias = vista.differences
    .filter((d) => !invalidas.has(d.row) && !fuera.has(d.row) && (d.outcome === 'NEW_VERSION' || d.outcome === 'UPDATE'))
    .map((d) => ({ row: d.row, code: d.code, caso: d.outcome, distanceM: d.distanceM }))
  const fueraDeZona = [...fuera.values()].map((o) => {
    const diferencia = vista.differences.find((d) => d.row === o.row)
    return { row: o.row, code: o.code ?? diferencia?.code ?? '', caso: 'OUT_OF_ZONE' as const, distanceM: diferencia?.distanceM, mensaje: o.message }
  })
  return [...diferencias, ...fueraDeZona].sort((a, b) => a.row - b.row)
}

// las decisiones que viajan: una por cada fila que la pide, también las que nadie tocó, con lo que muestra la tabla
// (APPLY por defecto). así una fila fuera de zona sin tocar entra con su APPLY explícito, como se ve en pantalla
export const decisionesDe = (filas: FilaConDecision[], elegidas: Record<number, Decision['action']>): Decision[] =>
  filas.map((f) => ({ row: f.row, action: elegidas[f.row] ?? 'APPLY' }))

// la columna del archivo que corresponde al campo que el servidor nombra en una fila inválida; los campos del modelo que
// no son una columna (una geometría, por ejemplo) no se nombran en pantalla
const COLUMNA_DE_CAMPO: Record<string, keyof Columnas> = {
  code: 'code',
  // los destinos de F6
  name: 'name',
  feature_type: 'featureType',
  source_easting: 'easting',
  source_northing: 'northing',
  // el servidor nombra easting y northing (sin source_) en las filas sin coordenadas o con los ejes cambiados
  easting: 'easting',
  northing: 'northing',
  source_elevation: 'elevation',
  elevation: 'elevation',
  azimuth: 'azimuth',
  dip: 'dip',
  depth: 'depth',
  drill_type: 'drillType',
  latitude: 'latitude',
  longitude: 'longitude'
}
export const columnaDeCampo = (campo: string | undefined): keyof Columnas | null => (campo ? (COLUMNA_DE_CAMPO[campo] ?? null) : null)

export type Conteos = Omit<Resultado, 'evidenceId'>

// lo que la confirmación debería escribir según la vista previa y las decisiones enviadas (api.md §4.2): rejected suma las
// filas inválidas y las descartadas; unchanged, las UNCHANGED que se aplicaron. si alguien registró un código del archivo
// entre las dos llamadas, una fila vista como CREATE se confirma como UPDATE o NEW_VERSION y los conteos no coinciden
export function conteosPrevistos(vista: VistaPrevia, decisiones: Decision[]): Conteos {
  const descartadas = new Set(decisiones.filter((d) => d.action === 'DISCARD').map((d) => d.row))
  const aplicadas = vista.differences.filter((d) => !descartadas.has(d.row))
  const de = (caso: Caso) => aplicadas.filter((d) => d.outcome === caso).length
  return {
    created: de('CREATE'),
    newVersions: de('NEW_VERSION'),
    updated: de('UPDATE'),
    unchanged: de('UNCHANGED'),
    rejected: new Set(vista.invalid.map((i) => i.row)).size + descartadas.size
  }
}

// los formatos (spec §3.4): por la extensión del archivo. un .zip es un Shapefile o una FileGDB, que el servidor distingue por
// su contenido; .json es GeoJSON
const EXTENSIONES: Record<string, string> = {
  xlsx: 'xlsx',
  csv: 'csv',
  geojson: 'geojson',
  json: 'geojson',
  zip: 'zip',
  kml: 'kml',
  kmz: 'kmz',
  gpkg: 'gpkg',
  gpx: 'gpx'
}
export const formatoDe = (nombre: string): string | null => EXTENSIONES[/\.([a-z0-9]+)$/i.exec(nombre)?.[1]?.toLowerCase() ?? ''] ?? null

// los formatos como se nombran en pantalla, en su orden (un .zip es Shapefile o FileGDB)
export const FORMATOS_EN_ORDEN: readonly string[] = ['xlsx', 'csv', 'geojson', 'zip', 'kml', 'kmz', 'gpkg', 'gpx']

// lo que F2 lee sin GDAL: un backend sin /imports/formats
export const FORMATOS_DE_F2: Formato[] = ['xlsx', 'csv', 'geojson'].map((format) => ({ format, available: true, multiLayer: false, crsFromFile: false }))

const delServidor = (formato: string, formatos: Formato[], cumple: (f: Formato) => boolean) => {
  const de = (clave: string) => formatos.some((x) => x.format === clave && cumple(x))
  return formato === 'zip' ? de('shp') || de('gdb') : de(formato)
}

// el servidor lee ese formato ahora (con un .zip, un Shapefile o una FileGDB)
export const disponible = (formato: string, formatos: Formato[]): boolean => delServidor(formato, formatos, (f) => f.available)

// el accept del selector de archivo: los formatos que el servidor nombra, también los que todavía no lee, para que quien elige
// uno de esos lea el motivo en la pantalla y no vea solo un archivo que el selector no deja elegir
export function aceptaDe(formatos: Formato[]): string {
  return Object.entries(EXTENSIONES)
    .filter(([, formato]) => delServidor(formato, formatos, () => true))
    .map(([extension]) => `.${extension}`)
    .join(',')
}

// un archivo con geometrías (no una hoja de coordenadas): sus columnas son solo el código y, en los destinos nuevos, el nombre
// y el tipo
export const esVectorial = (formato: string | null): boolean => formato !== null && formato !== 'xlsx' && formato !== 'csv'

// KML, KMZ y GPX son EPSG 4326 por definición (spec §3.4): otro sourceCrs con ellos es un 400
export const CRS_FIJO: Record<string, string> = { kml: 'EPSG 4326', kmz: 'EPSG 4326', gpx: 'EPSG 4326' }

// el CRS detectado como opción del catálogo «CRS de origen»: el servidor ya lo manda como un valor del catálogo («EPSG 32717»)
// o null, así que solo se compara el texto
export const opcionDeCrs = (detectado: string | null | undefined, opciones: readonly string[]): string | null =>
  detectado && opciones.includes(detectado) ? detectado : null

// los formatos que lee GDAL (spec §3.4): sus capas y su CRS se pueden leer del archivo antes de pedir la vista previa
export const LEE_GDAL: ReadonlySet<string> = new Set(['zip', 'kml', 'kmz', 'gpkg', 'gpx'])

// una capa del archivo como la describe el servidor (SourceLayer): siempre las cuatro claves; el tipo, los elementos y el CRS
// que declara (un valor del catálogo, una propuesta) pueden ser null
export interface CapaDelArchivo {
  name: string
  geometryType: string | null
  featureCount: number | null
  detectedCrs: string | null
}

// las capas que trae un 400 en su cuerpo Problem (decisión 17 del plan 6.3), sin mirar el código: la vista previa sin
// sourceCrs (un 400 de validación, sin código) y LAYER_REQUIRED las traen
export function capasDelError(error: unknown): CapaDelArchivo[] {
  if (!(error instanceof ErrorDeSgspe) || error.status !== 400) return []
  const capas = error.cuerpo?.layers
  if (!Array.isArray(capas)) return []
  return capas.flatMap((c: unknown) => {
    if (typeof c !== 'object' || c === null) return []
    const { name, geometryType, featureCount, detectedCrs } = c as Record<string, unknown>
    if (typeof name !== 'string') return []
    return [
      {
        name,
        geometryType: typeof geometryType === 'string' ? geometryType : null,
        featureCount: typeof featureCount === 'number' ? featureCount : null,
        detectedCrs: typeof detectedCrs === 'string' ? detectedCrs : null
      }
    ]
  })
}

// la elección que pide un 400 con capas, por el campo del error (no por su código: el del CRS no lo trae): la capa
// (LAYER_REQUIRED) o el CRS de origen de un formato de GDAL
export function eleccionPedida(error: unknown): 'layer' | 'sourceCrs' | null {
  if (capasDelError(error).length === 0) return null
  const campo = (error as ErrorDeSgspe).violations[0]?.field
  return campo === 'layer' || campo === 'sourceCrs' ? campo : null
}

// un destino de F6 en una organización que todavía no tiene su modelo: un 400 de validación sobre target, sin código
export const destinoSinModelo = (error: unknown): boolean =>
  error instanceof ErrorDeSgspe && error.status === 400 && error.violations[0]?.field === 'target' && !esCodigo(error.violations[0]?.message)

export { nuevaClave }
