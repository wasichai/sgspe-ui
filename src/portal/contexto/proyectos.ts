import { useAuth } from '@wasichai/core'
import { atributo, useRegistro, useTodos, type Registro } from '../datos/registros'
import { ROL_DE_JEFATURA } from '../config'
import { hoyEnLima } from '../datos/fechas'

// los proyectos de la persona: los que tienen una asignación activa suya (RF-PRJ-005, RQ-SEC-006). es una comodidad
// para ordenar y filtrar, no un control de acceso: con la opción A se leen todos los del tenant (security.md §9)
export function useMisAsignaciones() {
  const { user } = useAuth()
  return useTodos('project_assignment', { member_user_id: user?.id, active: true }, Boolean(user))
}

export function useMisProyectos(): Set<string> {
  const asignaciones = useMisAsignaciones()
  return new Set((asignaciones.data ?? []).map((a) => String(atributo(a, 'project'))))
}

// todos los proyectos legibles, por nombre: el selector y la lista los muestran
export const useProyectos = () => useTodos('project', { sort: 'name', dir: 'asc' })

export const useProyecto = (id: string | undefined) => useRegistro('project', id)

// la jefatura del proyecto (ASM-080): sus asignaciones activas con el rol de jefatura del despliegue
export const esJefatura = (asignacion: Registro): boolean => atributo(asignacion, 'role_name') === ROL_DE_JEFATURA && atributo(asignacion, 'active') === true

export const nombreDeProyecto = (p: Registro | undefined): string => (p ? `${String(atributo(p, 'code') ?? '')} · ${String(atributo(p, 'name') ?? '')}` : '')

// la vigencia de una asignación (RQ-SEC-006): solo la vigente da acceso de escritura. una terminada (active en falso) o con
// end_date pasado no lo da, y una con start_date futuro todavía no. las fechas son las de Lima
export type Vigencia = 'vigente' | 'programada' | 'vencida' | 'terminada'
export function vigenciaDeAsignacion(asignacion: Registro, hoy: string = hoyEnLima()): Vigencia {
  if (atributo(asignacion, 'active') !== true) return 'terminada'
  const fin = atributo<string>(asignacion, 'end_date')
  const inicio = atributo<string>(asignacion, 'start_date')
  if (fin && fin < hoy) return 'vencida'
  if (inicio && inicio > hoy) return 'programada'
  return 'vigente'
}
