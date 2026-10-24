import { ApiError } from '@wasichai/core'
import type { Parametros } from '../datos/registros'

// «Para tomar» de quien lee todos los proyectos (B-04, decisión (a) de wasichai/sgspe#162): la cola de sus proyectos con
// asignación vigente, no la de todo el tenant. el servidor la acota con assigned=true (api.md §3.4) en una sola lectura; a una
// cuenta que no lee todo el alcance ya la deja en sus proyectos, y no lo pide
export const soloAsignados = (leeTodos: boolean): Parametros => (leeTodos ? { assigned: 'true' } : {})

// un servidor anterior no conoce assigned y responde 422 a todo parámetro desconocido (ASM-054): la pantalla vuelve entonces a
// lo de antes del filtro
export const sinFiltroDeAsignados = (error: unknown): boolean => error instanceof ApiError && error.status === 422
