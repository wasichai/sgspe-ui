import { useAuth } from '@wasichai/core'
import { atributo, useRegistro, useTodos, type Registro } from '../datos/registros'
import { ROL_DE_JEFATURA } from '../config'

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
