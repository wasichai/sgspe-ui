import { useQuery } from '@tanstack/react-query'
import { codigoDelError, usePedir } from './http'
import { consulta } from './registros'

// los indicadores y tableros de sgspe.dashboard (api.md §4.11, dashboards.md §7): se guardan en caché un minuto (§3.4).
// un indicador sin permiso llega con available: false y se muestra "no disponible", nunca cero (RQ-DSH-032)

export interface FilaDeDesglose {
  key: string
  label?: string
  value: number | null
  [extra: string]: unknown
}

export interface Desglose {
  by: string
  rows: FilaDeDesglose[]
}

export interface PuntoDeSerie {
  period: string
  value: number | null
  target?: number | null
}

// un indicador disponible trae siempre value (null si no hay cifra, como un porcentaje sin denominador); uno no disponible
// no lo trae y dice por qué. las demás claves nulas no viajan (api.md §4.11)
export interface Indicador {
  code: string
  label: string
  available: boolean
  value?: number | null
  numerator?: number | null
  denominator?: number | null
  unit?: string
  breakdowns?: Desglose[]
  series?: PuntoDeSerie[]
  // FIELD_NOT_READABLE, OBJECT_NOT_READABLE o SINGLE_PROJECT_REQUIRED (plan 2.2)
  unavailableReason?: string
  missingFields?: string[]
  warnings?: string[]
  // los filtros pedidos que el indicador acepta y no aplica (ruling P27): community en los KPI-STK, explorationCampaign en
  // F2. sin filtros ignorados la clave no viaja; con ellos la interfaz lo dice, para que no se lea como un cero filtrado
  ignoredFilters?: string[]
}

export interface Tablero {
  dashboard: string
  computedAt: string
  filters: Record<string, unknown>
  indicators: Indicador[]
}

export interface FiltrosDeIndicador {
  project?: readonly string[]
  periodStart?: string
  periodEnd?: string
  locality?: string
  community?: string
  administrativeUnit?: string
  areaOfInfluence?: string
  scope?: string
  breakdown?: string
}

// dashboard es stakeholders, engagement o null: KPI-STK-04, KPI-STK-05 y KPI-STK-07 no tienen zona en un tablero de F2 y se
// ven en el detalle del indicador (dashboards.md §11)
export interface EntradaDeCatalogo {
  code: string
  label: string
  dashboard: string | null
  available: boolean
}

const UN_MINUTO = 60_000

export function useIndicador(code: string, filtros: FiltrosDeIndicador, activo = true) {
  const pedir = usePedir()
  const busqueda = consulta({ ...filtros })
  return useQuery({
    queryKey: ['indicator', code, busqueda],
    queryFn: () => pedir<Indicador>(`/sgspe/dashboards/indicators/${code}?${busqueda}`),
    staleTime: UN_MINUTO,
    enabled: activo
  })
}

export function useTablero(tablero: string, filtros: FiltrosDeIndicador) {
  const pedir = usePedir()
  const busqueda = consulta({ ...filtros })
  return useQuery({
    queryKey: ['dashboard', tablero, busqueda],
    queryFn: () => pedir<Tablero>(`/sgspe/dashboards/${tablero}?${busqueda}`),
    staleTime: UN_MINUTO
  })
}

// el catálogo dice qué tableros se ofrecen: uno aparece si la cuenta puede leer al menos uno de sus indicadores
export function useCatalogoDeIndicadores() {
  const pedir = usePedir()
  return useQuery({
    queryKey: ['indicators'],
    queryFn: () => pedir<EntradaDeCatalogo[]>('/sgspe/dashboards/indicators'),
    staleTime: UN_MINUTO
  })
}

// la lectura de un tablero es acotada (dashboards.md §6.2): pasarse no recorta la cifra, el pedido entero responde 400
// TOO_MANY_RECORDS (field project) y hay que acotar los proyectos, el periodo o el territorio
export const sonDemasiadosRegistros = (error: unknown): boolean => codigoDelError(error) === 'TOO_MANY_RECORDS'

export const desglose = (indicador: Indicador | undefined, por: string): FilaDeDesglose[] => indicador?.breakdowns?.find((d) => d.by === por)?.rows ?? []
