import { useMutation } from '@tanstack/react-query'
import { ACEPTAR_REPORTE, usePedir, nuevaClave } from '../datos/http'

// la importación geoespacial de api.md §4.2 (gis.md §4.2): la vista previa no deja estado en el servidor, así que la
// confirmación vuelve a mandar lo mismo que la vista previa (archivo, destino, proyecto, CRS de origen y columnas) con el
// SHA-256 de la vista previa y las decisiones fila por fila; el servidor repite la validación con ellos. como la
// confirmación concilia de nuevo, lo registrado puede haber cambiado entre las dos llamadas: sus conteos se comparan con
// los que preveía la vista previa
export type Destino = 'project_component' | 'land_parcel' | 'mining_concession'
export const DESTINOS: readonly Destino[] = ['project_component', 'land_parcel', 'mining_concession']

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
  Record<'code' | 'easting' | 'northing' | 'elevation' | 'azimuth' | 'dip' | 'depth' | 'drillType' | 'latitude' | 'longitude', string>
>

export interface Pedido {
  archivo: File
  destino: Destino
  proyecto: string
  crs: string
  columnas: Columnas
}

const formulario = ({ archivo, destino, proyecto, crs, columnas }: Pedido) => {
  const f = new FormData()
  f.append('file', archivo)
  f.append('target', destino)
  f.append('project', proyecto)
  f.append('sourceCrs', crs)
  f.append('columns', JSON.stringify(columnas))
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

export { nuevaClave }
