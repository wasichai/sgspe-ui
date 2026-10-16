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
  // F2, y explorationCampaign y owner en los KPI-COM que no los aplican. sin filtros ignorados la clave no viaja; con ellos la interfaz lo dice, para que no se lea como un cero filtrado
  ignoredFilters?: string[]
  // F4: el indicador no cuenta las QCS confidenciales que quien llama no lee (KPI-GRV y KPI-ENG-05; dashboards.md §8, ASM-095).
  // un booleano, nunca cuántas
  confidentialHidden?: boolean
}

export interface Tablero {
  dashboard: string
  computedAt: string
  filters: Record<string, unknown>
  indicators: Indicador[]
  // F4: el tablero attention excluye las QCS confidenciales que quien llama no lee
  confidentialHidden?: boolean
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
  // F3: la campaña de exploración y el responsable (owner_user_id) de los KPI-COM que los aplican (api.md §4.11); los demás los
  // devuelven en ignoredFilters
  explorationCampaign?: string
  owner?: string
  // F5: los filtros propios del tablero de inversión (spec F5 §3.9, plan 5.2b): un programa y un año presupuestal (la campaña es
  // explorationCampaign, el filtro común). solo los acepta el tablero investment; los KPI-INV que no los aplican los devuelven en
  // ignoredFilters
  program?: string
  year?: string
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

// T es la forma de un tablero con claves propias (F8: byProject del ejecutivo, rows del monitoreo; tableros/contratoF8.ts)
export function useTablero<T extends Tablero = Tablero>(tablero: string, filtros: FiltrosDeIndicador) {
  const pedir = usePedir()
  const busqueda = consulta({ ...filtros })
  return useQuery({
    queryKey: ['dashboard', tablero, busqueda],
    queryFn: () => pedir<T>(`/sgspe/dashboards/${tablero}?${busqueda}`),
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

// F6: KPI-TER-01 no tiene cifra propia; reúne las de la ficha contextual en su desglose components (dashboards.md §4.8,
// TerritorySummary). cada fila trae key (el código en las de un KPI, que además traen code, label y unit como el indicador
// suelto) y su propio available. programs y lastActivity no traen label: el título es del portal. lastActivity trae en value
// la fecha AAAA-MM-DD (o null), no un número
export interface ComponenteDeFicha {
  key: string
  code?: string
  label?: string
  available: boolean
  value?: number | string | null
  unit?: string
  breakdowns?: Desglose[]
  unavailableReason?: string
  missingFields?: string[]
  warnings?: string[]
  ignoredFilters?: string[]
  confidentialHidden?: boolean
}

// las filas de KPI-TER-01 vistas con su tipo, en el orden del servidor
export const componentesDeFicha = (indicador: Indicador | undefined): ComponenteDeFicha[] => desglose(indicador, 'components') as unknown as ComponenteDeFicha[]
