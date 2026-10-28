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

// la lista donde se atiende cada cifra, con la vista o el filtro que cuenta lo mismo (tercera pasada de UX, 4.1): la del
// proyecto o, para toda la cartera, la global de la sección. las alertas no tienen lista global: la cartera va a su tablero
const EN_EL_PROYECTO: Record<CodigoDeAtencion, string> = {
  'KPI-EXE-02': 'risks/warnings?view=activas',
  'KPI-RSK-01': 'risks/register?level=alto',
  'KPI-COM-03': 'commitments?view=vencidos',
  'KPI-GRV-02': 'attention'
}
const EN_LA_CARTERA: Record<CodigoDeAtencion, string> = {
  'KPI-EXE-02': '/risks/dashboard',
  'KPI-RSK-01': '/risks/register?level=alto',
  'KPI-COM-03': '/commitments?view=vencidos',
  'KPI-GRV-02': '/attention'
}
// las demás tiles que tienen una lista que cuenta lo mismo; las interacciones realizadas no: la lista no filtra por periodo
// ni por realizadas, y los proyectos activos de un solo proyecto no tienen lista
const OTRAS_EN_EL_PROYECTO: Record<string, string> = { 'KPI-COM-02': 'commitments' }
const OTRAS_DE_LA_CARTERA: Record<string, string> = {
  'KPI-EXE-01': '/projects?view=active',
  'KPI-COM-02': '/commitments'
}

export const rutaDeAtencion = (code: CodigoDeAtencion, proyecto: string | null): string => {
  // la lista es una constante de este archivo; solo el proyecto viene de datos, y va codificado
  return proyecto ? `/projects/${encodeURIComponent(proyecto)}/` + EN_EL_PROYECTO[code] : EN_LA_CARTERA[code]
}

// la lista de una tile, si tiene una que cuente lo mismo: la del proyecto si las cifras son de uno solo, o la global
export const rutaDeCifra = (code: string, proyecto: string | null): string | undefined => {
  if ((ORDEN_DE_ATENCION as readonly string[]).includes(code)) return rutaDeAtencion(code as CodigoDeAtencion, proyecto)
  if (!proyecto) return OTRAS_DE_LA_CARTERA[code]
  const resto = OTRAS_EN_EL_PROYECTO[code]
  return resto ? `/projects/${encodeURIComponent(proyecto)}/${resto}` : undefined
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
