import type { AvailableTransition } from '@wasichai/workflow'
import { describe, expect, it } from 'vitest'
import { siguienteTransicion } from './siguienteAccion'

// la siguiente acción de una ficha: la transición del camino, nunca una de excepción (cancelar, rechazar, devolver)
const tr = (name: string, to: string, allowed = true): AvailableTransition =>
  ({ name, label: name, to, toLabel: to, allowed, reason: null }) as AvailableTransition

describe('siguienteTransicion', () => {
  it('elige la del camino del objeto aunque las de excepción vengan antes', () => {
    expect(siguienteTransicion('commitment', [tr('cancel_draft', 'cancelled'), tr('submit', 'pending_approval'), tr('approve_direct', 'approved')])?.name).toBe(
      'submit'
    )
    expect(
      siguienteTransicion('commitment', [tr('cancel_in_progress', 'cancelled'), tr('block', 'blocked'), tr('register_fulfillment', 'fulfilled')])?.name
    ).toBe('register_fulfillment')
  })

  it('devuelve la del camino aunque esté bloqueada: la ficha dice lo que falta', () => {
    expect(siguienteTransicion('commitment', [tr('submit', 'pending_approval', false)])).toMatchObject({ name: 'submit', allowed: false })
  })

  it('sin ninguna del camino (solo excepciones, o un objeto sin camino), null', () => {
    expect(siguienteTransicion('commitment', [tr('cancel_approved', 'cancelled'), tr('return_to_draft', 'draft')])).toBeNull()
    expect(siguienteTransicion('grievance', [tr('reject_received', 'rejected'), tr('withdraw_received', 'withdrawn')])).toBeNull()
    expect(siguienteTransicion('desconocido', [tr('submit', 'x')])).toBeNull()
  })

  it('cada objeto sigue su camino', () => {
    expect(siguienteTransicion('grievance', [tr('reject_received', 'rejected'), tr('acknowledge', 'acknowledged')])?.name).toBe('acknowledge')
    expect(siguienteTransicion('engagement', [tr('cancel_scheduled', 'cancelled'), tr('postpone', 'postponed'), tr('register_held', 'held')])?.name).toBe(
      'register_held'
    )
    expect(
      siguienteTransicion('social_risk', [tr('close_assessed', 'closed'), tr('decide_monitoring', 'monitoring'), tr('decide_mitigation', 'mitigating')])?.name
    ).toBe('decide_mitigation')
    // A13 de la segunda pasada, recuperado en la tercera: el proyecto también tiene camino; «Devolver» y «Anular» no son lo
    // siguiente, ni suspender o cerrar un proyecto activo
    expect(siguienteTransicion('project', [tr('return_to_draft', 'draft'), tr('approve', 'active'), tr('cancel_in_review', 'cancelled')])?.name).toBe('approve')
    expect(siguienteTransicion('project', [tr('suspend', 'suspended'), tr('close', 'closed')])).toBeNull()
    // un aporte solicitado avanza también aprobándolo sin revisión interna; rechazarlo no es lo siguiente
    expect(siguienteTransicion('social_contribution', [tr('reject', 'rejected'), tr('approve_direct', 'approved')])?.name).toBe('approve_direct')
    expect(siguienteTransicion('social_contribution', [tr('approve_direct', 'approved'), tr('approve', 'approved')])?.name).toBe('approve')
  })
})
