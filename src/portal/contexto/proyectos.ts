import { useAuth } from '@wasichai/core'
import { atributo, useRegistro, useTodos, type Registro } from '../datos/registros'
import { ROL_DE_JEFATURA } from '../config'
import { hoyEnLima } from '../datos/fechas'

// las asignaciones de la persona (RF-PRJ-005, RQ-SEC-006), también las vencidas: el servidor se las deja leer (elección 3 de la
// spec 4.4). sirven para ordenar el selector y para la guarda de UI de la escritura; lo que se lee ya viene acotado por el
// servidor (alcance por proyecto, ADR-0029), así que el portal no filtra por proyecto lo que lee
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

// la acción declarada sobre project que exime del alcance de lectura por proyecto (ADR-0029, spec 4.4 §2.1 decisión 2): quien
// la tiene lee todos los proyectos del tenant. can de core da verdadero a ADMIN, así que ADMIN entra sin caso aparte. es el
// único lugar del portal que la nombra (boundaries.test.ts)
const LEE_TODOS_LOS_PROYECTOS = 'READ_ALL_PROJECTS'

export function useLeeTodosLosProyectos(): boolean {
  const { can } = useAuth()
  return can('project', LEE_TODOS_LOS_PROYECTOS)
}
