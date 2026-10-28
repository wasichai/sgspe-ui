import type { AvailableTransition } from '@wasichai/workflow'

// la siguiente acción de una ficha (design-system.md §6.1, revisión de UX, etapa 4): de las transiciones que el rol tiene en el
// estado actual (GET …/transitions), la que avanza el registro por su camino, en el orden de cada workflow. nunca una que
// cancela, rechaza, retira, devuelve o reabre: esas no son «lo siguiente», son la excepción. sin ninguna del camino, null
export const CAMINO_DE: Readonly<Record<string, readonly string[]>> = {
  commitment: ['submit', 'approve', 'approve_senior', 'start', 'unblock', 'register_fulfillment', 'verify', 'close'],
  grievance: [
    'acknowledge',
    'assess',
    'start_action',
    'investigate',
    'start_action_after_investigation',
    'resolve',
    'resolve_high_severity',
    'verify',
    'close',
    'close_resolved'
  ],
  inquiry: ['answer', 'refer', 'close', 'close_referred'],
  stakeholder_request: ['start_evaluation', 'accept', 'close_accepted', 'close_declined'],
  engagement: ['schedule', 'register_held', 'register_held_unplanned', 'draft_minutes', 'submit_minutes', 'approve_minutes', 'close', 'reschedule'],
  stakeholder: ['profile', 'assess'],
  social_risk: ['assess', 'decide_mitigation', 'decide_monitoring', 'start_monitoring'],
  agreement: ['start_negotiation', 'activate', 'activate_from_draft', 'resume', 'conclude'],
  // aprobar sin revisión interna también avanza el aporte (P4 y P5 no la piden): sin ella, a quien solo la tiene el panel le decía
  // «Nada pendiente» en un aporte solicitado (tercera pasada de UX)
  social_contribution: ['approve', 'approve_direct', 'register_procurement', 'register_delivery', 'close'],
  social_program: ['submit', 'approve', 'start_execution', 'start_monitoring', 'start_evaluation', 'close', 'resume'],
  field_visit: ['start', 'complete'],
  // tercera pasada de UX (1.5): el incidente (WF-M) y la alerta (WF-J) con la anatomía común; descartar una alerta no es lo siguiente
  incident: ['start_review', 'start_response', 'close'],
  early_warning: ['start_triage', 'confirm', 'start_response', 'resolve', 'close'],
  area_of_influence: ['approve'],
  // suspender o cerrar un proyecto activo no es lo siguiente: es una decisión de excepción
  project: ['submit_for_review', 'approve', 'resume']
}

export function siguienteTransicion(objeto: string, transiciones: readonly AvailableTransition[]): AvailableTransition | null {
  const camino = CAMINO_DE[objeto] ?? []
  for (const nombre of camino) {
    const tr = transiciones.find((x) => x.name === nombre)
    if (tr) return tr
  }
  return null
}
