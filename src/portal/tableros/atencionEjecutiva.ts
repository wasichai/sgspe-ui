import type { Indicador } from '../datos/indicadores'
import type { TableroEjecutivo } from './contratoF8'

// «Lo que necesita atención hoy» de S51, por regla fija (decisión 5 del plan): alertas activas, riesgos altos o críticos,
// compromisos vencidos y quejas abiertas, en ese orden; dentro de cada uno, de mayor a menor; hasta diez. con la tabla por
// proyecto, una entrada por proyecto; sin ella (byProjectOmitted), una por cifra de toda la cartera. una cifra no disponible
// o en cero no pide atención
export const ORDEN_DE_ATENCION = ['KPI-EXE-02', 'KPI-RSK-01', 'KPI-COM-03', 'KPI-GRV-02'] as const
export type CodigoDeAtencion = (typeof ORDEN_DE_ATENCION)[number]

export interface ItemDeAtencion {
  code: CodigoDeAtencion
  proyecto: string | null
  nombre: string | null
  valor: number
  ruta: string
}

export const MAXIMO_DE_ATENCION = 10

// la lista donde se atiende cada cifra: la del proyecto o, para toda la cartera, la global de la sección
const EN_EL_PROYECTO: Record<CodigoDeAtencion, string> = {
  'KPI-EXE-02': 'risks/warnings',
  'KPI-RSK-01': 'risks/register',
  'KPI-COM-03': 'commitments',
  'KPI-GRV-02': 'attention'
}
const EN_LA_CARTERA: Record<CodigoDeAtencion, string> = {
  'KPI-EXE-02': '/risks',
  'KPI-RSK-01': '/risks/register',
  'KPI-COM-03': '/commitments',
  'KPI-GRV-02': '/attention'
}

export const rutaDeAtencion = (code: CodigoDeAtencion, proyecto: string | null): string => {
  // la lista es una constante de este archivo; solo el proyecto viene de datos, y va codificado
  return proyecto ? `/projects/${encodeURIComponent(proyecto)}/` + EN_EL_PROYECTO[code] : EN_LA_CARTERA[code]
}

const cifra = (indicadores: Indicador[], code: string): number => {
  const indicador = indicadores.find((i) => i.code === code)
  return indicador?.available && typeof indicador.value === 'number' ? indicador.value : 0
}

export function itemsDeAtencion(tablero: TableroEjecutivo): ItemDeAtencion[] {
  const filas = tablero.byProject
  const items = ORDEN_DE_ATENCION.flatMap((code) =>
    (filas
      ? filas.map((f) => ({ code, proyecto: f.project, nombre: f.name ?? f.code, valor: cifra(f.indicators, code) }))
      : [{ code, proyecto: null, nombre: null, valor: cifra(tablero.indicators, code) }]
    )
      .filter((i) => i.valor > 0)
      .sort((a, b) => b.valor - a.valor)
  )
  return items.slice(0, MAXIMO_DE_ATENCION).map((i) => ({ ...i, ruta: rutaDeAtencion(i.code, i.proyecto) }))
}
