import type { Aviso, Comprobacion } from '../transiciones/api'

// «Antes de aprobar» de S44 (spec F5 §3.3 y §3.4, screens.md S44): la consulta en seco de la aprobación junta todos los hallazgos
// (api.md §4.1) y aquí se leen fila por fila: qué bloquea, qué advierte, qué cumple y qué no se evalúa porque su política está
// apagada o no aplica (sin campaña no hay tope; sin sinergia declarada no hay acuerdo que exigir). pura: se prueba sin pantalla
export const FILAS = ['items', 'tope', 'manoDeObra', 'donaciones', 'prioridad', 'sinergia', 'quienAprueba'] as const
export type FilaDeLineamiento = (typeof FILAS)[number]
export type Situacion = 'cumple' | 'bloquea' | 'advierte' | 'noAplica'

// los códigos de cada fila: P9 (ítems y tipo), P1 (tope), P2 y P3 (lineamientos), P6 (sinergia), P4, P5 y P7 (quién aprueba)
const CODIGOS: Record<FilaDeLineamiento, readonly string[]> = {
  items: ['ITEMS_REQUIRED', 'FIELD_REQUIRED'],
  tope: ['SUPPORT_CAP_EXCEEDED', 'CAP_DATA_INVALID', 'CAP_OTHER_CURRENCY'],
  manoDeObra: ['PAID_LABOR'],
  donaciones: ['MONETARY_DONATION'],
  prioridad: ['PRIORITY_NOT_MET', 'PRIORITIES_NOT_CONFIGURED'],
  sinergia: ['SYNERGY_AGREEMENT_REQUIRED'],
  quienAprueba: ['ACTION_REQUIRED', 'SEGREGATION_OF_DUTIES', 'INTERNAL_APPROVAL_REQUIRED', 'NOT_ASSIGNED']
}

// la política del proyecto que enciende cada fila (database-model.md, project): vacía vale activada (todas valen true por defecto)
const POLITICA: Partial<Record<FilaDeLineamiento, string>> = {
  manoDeObra: 'policy_no_paid_labor',
  donaciones: 'policy_non_monetary_donations',
  prioridad: 'policy_priority_warning',
  sinergia: 'policy_synergy_requires_agreement'
}

// los lineamientos que cubre la justificación (RN-INV-006, decisión 3): una sola los cubre todos. la sinergia (P6) y la prioridad sin
// temas configurados (siempre advertencia) no la piden
export const JUSTIFICABLES: readonly string[] = ['PAID_LABOR', 'MONETARY_DONATION', 'PRIORITY_NOT_MET']

// lo que la consulta dice de todo objeto requiresReason y no es una regla del aporte
const SIN_FILA: readonly string[] = ['REASON_REQUIRED']

export interface Contexto {
  // los atributos del proyecto: sus políticas
  politicas: Record<string, unknown>
  conCampana: boolean
  conSinergia: boolean
}

export interface Lineamiento {
  fila: FilaDeLineamiento
  situacion: Situacion
  avisos: Aviso[]
}

const aplica = (fila: FilaDeLineamiento, { politicas, conCampana, conSinergia }: Contexto): boolean => {
  const politica = POLITICA[fila]
  if (politica && politicas[politica] === false) return false
  if (fila === 'tope') return conCampana
  if (fila === 'sinergia') return conSinergia
  return true
}

export function leerLineamientos(comprobacion: Comprobacion, contexto: Contexto): { filas: Lineamiento[]; otros: Aviso[]; pideJustificacion: boolean } {
  const filas = FILAS.map((fila): Lineamiento => {
    const bloqueos = comprobacion.blocking.filter((a) => CODIGOS[fila].includes(a.code))
    const advertencias = comprobacion.warnings.filter((a) => CODIGOS[fila].includes(a.code))
    const situacion: Situacion = bloqueos.length > 0 ? 'bloquea' : advertencias.length > 0 ? 'advierte' : aplica(fila, contexto) ? 'cumple' : 'noAplica'
    return { fila, situacion, avisos: [...bloqueos, ...advertencias] }
  })
  const conFila = new Set<string>(FILAS.flatMap((f) => CODIGOS[f]))
  const todos = [...comprobacion.blocking, ...comprobacion.warnings]
  return {
    filas,
    otros: todos.filter((a) => !conFila.has(a.code) && !SIN_FILA.includes(a.code)),
    pideJustificacion: todos.some((a) => JUSTIFICABLES.includes(a.code))
  }
}
