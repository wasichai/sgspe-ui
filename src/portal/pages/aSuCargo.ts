import { useAuth } from '@wasichai/core'
import { estaAbierta, OBJETOS_DE_QCS } from '../datos/atencion'
import { texto, useTodos, type Registro } from '../datos/registros'

const TAREA_ABIERTA = ['open', 'in_progress', 'blocked']
const COMPROMISO_CERRADO = ['closed', 'cancelled', 'verified']
const vencidosPrimero = (a: Registro, b: Registro) => Number(texto(b, 'deadline_status') === 'VENCIDO') - Number(texto(a, 'deadline_status') === 'VENCIDO')

// lo que la persona tiene a su cargo, decidido por sus permisos y nunca por el nombre de su rol (RQ-SEC-005): sus tareas abiertas
// (assignee_user_id), los compromisos de los que es responsable y las QCS que atiende (owner_user_id), cada lectura solo si la
// cuenta lee su objeto; abierto y con los vencidos primero. lo leen «Lo que me toca hoy» y la bienvenida (mismas consultas, misma
// caché). lee: si la cuenta lee alguno de los objetos
export function useSuTrabajo() {
  const { user, can } = useAuth()
  const yo = user?.id ?? ''
  const leeTareas = can('task', 'READ')
  const leeCompromisos = can('commitment', 'READ')
  const tareas = useTodos('task', { assignee_user_id: yo, sort: 'due_date', dir: 'asc' }, leeTareas && Boolean(yo))
  const compromisos = useTodos('commitment', { owner_user_id: yo, sort: 'due_date', dir: 'asc' }, leeCompromisos && Boolean(yo))
  const quejas = useTodos('grievance', { owner_user_id: yo }, can('grievance', 'READ') && Boolean(yo))
  const consultas = useTodos('inquiry', { owner_user_id: yo }, can('inquiry', 'READ') && Boolean(yo))
  const solicitudes = useTodos('stakeholder_request', { owner_user_id: yo }, can('stakeholder_request', 'READ') && Boolean(yo))
  const deQcs = [quejas, consultas, solicitudes]
    .map((consulta, i) => ({ objeto: OBJETOS_DE_QCS[i], consulta, lee: can(OBJETOS_DE_QCS[i], 'READ') }))
    .filter((q) => q.lee)
  const lee = leeTareas || leeCompromisos || deQcs.length > 0
  const cargando = (leeTareas && tareas.isPending) || (leeCompromisos && compromisos.isPending) || deQcs.some((q) => q.consulta.isPending)
  const abiertas = (tareas.data ?? []).filter((x) => TAREA_ABIERTA.includes(x.state ?? '')).sort(vencidosPrimero)
  const aCargo = (compromisos.data ?? []).filter((c) => !COMPROMISO_CERRADO.includes(c.state ?? '')).sort(vencidosPrimero)
  const qcs = deQcs.flatMap((q) =>
    (q.consulta.data ?? []).filter((r) => estaAbierta(q.objeto, r)).map((registro) => ({ objeto: q.objeto as string, registro }))
  )
  qcs.sort((a, b) => vencidosPrimero(a.registro, b.registro))
  return { lee, cargando, abiertas, aCargo, qcs }
}
