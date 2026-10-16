import { useComando } from '../datos/comandos'
import { codigoDelError, ErrorDeSgspe } from '../datos/http'
import type { Indicador, Tablero } from '../datos/indicadores'
import type { Registro } from '../datos/registros'

// el contrato de los tableros de F8 (api.md §4.11, Dashboards.kt y MonitoringTable.kt de sgspe): las formas propias del
// ejecutivo (byProject, byProjectOmitted) y del monitoreo (rows), la tendencia de KPI-EXE-03, el periodo de un mes y el cierre
// de periodo. una pantalla no pide /api/sgspe/indicators/** por su cuenta

export interface FilaPorProyecto {
  project: string
  code: string | null
  name: string | null
  // los 8 KPI con valor de las tiles, sin desgloses ni series
  indicators: Indicador[]
}

export interface TableroEjecutivo extends Tablero {
  // falta si los proyectos por defecto pasan el tope (byProjectOmitted: true)
  byProject?: FilaPorProyecto[]
  byProjectOmitted?: boolean
}

export interface CifraOficial {
  measurement: string
  closedAt: string | null
  value: number | null
}

export type OrigenDeMeta = 'PROJECT' | 'CATALOG' | 'DEFAULT' | 'NONE'

export interface FilaDeMonitoreo {
  number: number
  code: string
  label: string
  verificationMeans: string
  deliverable: string
  available: boolean
  value: number | null
  target: number | null
  targetSource: OrigenDeMeta
  official: CifraOficial | null
  // el id del registro indicator para cerrar el periodo; null si el catálogo no tiene el KPI o la cuenta no lee indicator
  indicatorId: string | null
}

export interface TableroDeMonitoreo extends Tablero {
  rows: FilaDeMonitoreo[]
}

// un mes de KPI-EXE-03 (ExecutiveKpis.trend): tres medidas, sin valor escalar
export interface MesDeTendencia {
  period: string
  engagements: number
  grievancesReceived: number
  grievancesClosed: number
  overdueCommitments: number
}

// las tiles de dashboards.md §5.1, en su orden (ExecutiveKpis.TILES sin la inversión ni la tendencia, que tienen su zona)
export const CODIGOS_DE_LAS_TILES = ['KPI-EXE-01', 'KPI-COM-02', 'KPI-COM-03', 'KPI-GRV-02', 'KPI-RSK-01', 'KPI-ENG-01', 'KPI-EXE-02'] as const

// sgspe.dashboards.executive.max-projects: pedir más es 400 TOO_MANY_RECORDS
export const TOPE_DE_PROYECTOS = 25

const numero = (valor: unknown): number => (typeof valor === 'number' && Number.isFinite(valor) ? valor : 0)

export function mesesDeTendencia(indicador: Indicador | undefined): MesDeTendencia[] {
  return ((indicador?.series ?? []) as unknown as Record<string, unknown>[]).map((m) => ({
    period: String(m.period ?? ''),
    engagements: numero(m.engagements),
    grievancesReceived: numero(m.grievancesReceived),
    grievancesClosed: numero(m.grievancesClosed),
    overdueCommitments: numero(m.overdueCommitments)
  }))
}

// el mes anterior a hoy en Lima (AAAA-MM): el que en la práctica ya se puede cerrar (api.md §4.11, NOT_PERIOD_BOUND)
export function mesAnterior(hoy: string): string {
  const [anio, mes] = hoy.split('-').map(Number)
  return mes === 1 ? `${anio - 1}-12` : `${anio}-${String(mes - 1).padStart(2, '0')}`
}

// el primer y el último día de un mes (AAAA-MM), en fechas de calendario
export function periodoDelMes(mes: string): { desde: string; hasta: string } {
  const [anio, numeroDeMes] = mes.split('-').map(Number)
  const ultimo = new Date(Date.UTC(anio, numeroDeMes, 0)).getUTCDate()
  return { desde: `${mes}-01`, hasta: `${mes}-${String(ultimo).padStart(2, '0')}` }
}

export interface CierreDePeriodo {
  // el id del registro indicator (no su código)
  indicador: string
  // null: todo el tenant (solo la administración)
  proyecto: string | null
  desde: string
  hasta: string
}

// POST /api/sgspe/indicators/{id}/measurements con Idempotency-Key: congela la cifra oficial del periodo
export function useCerrarPeriodo() {
  return useComando<Registro, CierreDePeriodo>(
    ({ indicador, proyecto, desde, hasta }) => ({
      ruta: `/sgspe/indicators/${encodeURIComponent(indicador)}/measurements`,
      json: { project: proyecto, attributes: { period_start_date: desde, period_end_date: hasta } }
    }),
    {
      invalidar: () => [
        ['dashboard', 'monitoring'],
        ['records', 'indicator_measurement']
      ]
    }
  )
}

export type RazonDeCierre = 'STANCE' | 'NO_SCALAR_VALUE' | 'UNAVAILABLE' | 'NOT_PERIOD_BOUND'
const RAZONES: readonly string[] = ['STANCE', 'NO_SCALAR_VALUE', 'UNAVAILABLE', 'NOT_PERIOD_BOUND']

// 409 INDICATOR_NOT_CLOSABLE trae su razón en el miembro reason del problem+json (IndicatorMeasurementsController)
export function razonDeCierre(error: unknown): RazonDeCierre | null {
  if (codigoDelError(error) !== 'INDICATOR_NOT_CLOSABLE' || !(error instanceof ErrorDeSgspe)) return null
  const razon = error.cuerpo?.reason
  return typeof razon === 'string' && RAZONES.includes(razon) ? (razon as RazonDeCierre) : null
}
