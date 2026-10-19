import { useAuth } from '@wasichai/core'
import { useResumenDeAvisos } from '../datos/avisos'
import { useRegistros } from '../datos/registros'

// las insignias del shell (revisión de UX, etapa 1; ux-architecture.md §7.1): lo que pide acción a la persona. Tareas, las suyas
// vencidas y por vencer (deadline_status, que JOB-01 solo calcula en las abiertas), contadas con size=1 y totalElements;
// Avisos, los ACTION sin leer del resumen de wasichai-notifications. lo que no se puede leer no cuenta: null
export function useInsignias(): { tareas: number | null; avisos: number | null } {
  const { user, can } = useAuth()
  const yo = user?.id
  const leeTareas = can('task', 'READ') && Boolean(yo)
  const vencidas = useRegistros('task', { assignee_user_id: yo, deadline_status: 'VENCIDO', size: 1 }, leeTareas)
  const porVencer = useRegistros('task', { assignee_user_id: yo, deadline_status: 'POR VENCER', size: 1 }, leeTareas)
  const resumen = useResumenDeAvisos(user !== null)
  const total = (a?: number | null, b?: number | null) => (a == null && b == null ? null : (a ?? 0) + (b ?? 0))
  return {
    tareas: leeTareas ? total(vencidas.data?.totalElements, porVencer.data?.totalElements) : null,
    avisos: resumen.data?.kinds?.ACTION?.unread ?? null
  }
}
