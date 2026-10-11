import { describe, expect, it } from 'vitest'
import { esDerivado } from '../datos/derivados'
import { esDeComando, exigeMotivo } from './reglas'

// workflows.md, «Transiciones con motivo obligatorio» y «Transiciones de comando», con los objetos de F3
describe('reglas de transición de F3', () => {
  it.each([
    ['commitment', 'start'],
    ['commitment', 'approve'],
    ['agreement', 'activate_from_draft'],
    ['commitment_candidate', 'reject'],
    ['commitment_candidate', 'mark_duplicate'],
    ['task', 'cancel_open']
  ])('%s · %s exige motivo', (objeto, transicion) => {
    expect(exigeMotivo(objeto, transicion)).toBe(true)
  })

  it.each([
    ['task', 'start'],
    ['task', 'complete'],
    ['commitment_candidate', 'accept']
  ])('%s · %s no lo exige', (objeto, transicion) => {
    expect(exigeMotivo(objeto, transicion)).toBe(false)
  })

  it('aceptar un candidato y marcarlo duplicado se hacen por su endpoint, no como botones de transición', () => {
    expect(esDeComando('commitment_candidate', 'accept')).toBe(true)
    expect(esDeComando('commitment_candidate', 'mark_duplicate')).toBe(true)
    expect(esDeComando('commitment_candidate', 'reject')).toBe(false)
  })

  it('los derivados de F3 nunca se escriben desde el portal', () => {
    for (const campo of ['executed_amount', 'deadline_status', 'requires_senior_approval', 'fulfilled_date', 'closed_date', 'cancelled_date']) {
      expect(esDerivado('commitment', campo)).toBe(true)
    }
    expect(esDerivado('agreement', 'validity_status')).toBe(true)
    expect(esDerivado('task', 'deadline_status')).toBe(true)
    expect(esDerivado('commitment', 'due_date')).toBe(false)
  })
})

// F4: las tres QCS y el riesgo son requiresReason; descartar una alerta pide motivo; las reclasificaciones, la aceptación de una
// solicitud y su cierre por el compromiso, y la primera revisión de un riesgo son de comando (plan 4.1, «Los workflows»)
describe('reglas de transición de F4', () => {
  it.each([
    ['grievance', 'acknowledge'],
    ['grievance', 'resolve_high_severity'],
    ['inquiry', 'answer'],
    ['stakeholder_request', 'decline'],
    ['social_risk', 'decide_mitigation'],
    ['early_warning', 'dismiss']
  ])('%s · %s exige motivo', (objeto, transicion) => {
    expect(exigeMotivo(objeto, transicion)).toBe(true)
  })

  it.each([
    ['early_warning', 'confirm'],
    ['early_warning', 'start_triage'],
    ['incident', 'close']
  ])('%s · %s no lo exige', (objeto, transicion) => {
    expect(exigeMotivo(objeto, transicion)).toBe(false)
  })

  it.each([
    ['grievance', 'close_reclassified_received'],
    ['grievance', 'close_reclassified_acknowledged'],
    ['grievance', 'close_reclassified_in_assessment'],
    ['inquiry', 'close_reclassified'],
    ['stakeholder_request', 'accept'],
    ['stakeholder_request', 'close_accepted'],
    ['stakeholder_request', 'close_reclassified_under_evaluation'],
    ['social_risk', 'assess']
  ])('%s · %s es de comando: no es un botón de transición', (objeto, transicion) => {
    expect(esDeComando(objeto, transicion)).toBe(true)
  })

  it.each([
    ['grievance', 'resolve'],
    ['stakeholder_request', 'close_unfulfilled'],
    ['social_risk', 'decide_mitigation'],
    ['early_warning', 'confirm']
  ])('%s · %s es una transición de la API genérica', (objeto, transicion) => {
    expect(esDeComando(objeto, transicion)).toBe(false)
  })

  it('los plazos de las QCS, los valores del riesgo y la derivación de una pregunta nunca se escriben desde el portal', () => {
    for (const campo of ['ack_due_date', 'resolution_due_date', 'resolved_date', 'deadline_status', 'closed_date', 'response_due_date']) {
      expect(esDerivado('grievance', campo)).toBe(true)
    }
    for (const objeto of ['inquiry', 'stakeholder_request']) expect(esDerivado(objeto, 'response_due_date')).toBe(true)
    for (const campo of ['probability', 'impact', 'score', 'risk_level', 'residual_level', 'next_review_date', 'review_status']) {
      expect(esDerivado('social_risk', campo)).toBe(true)
    }
    expect(esDerivado('engagement_question', 'referred_at')).toBe(true)
    expect(esDerivado('grievance', 'responded_at')).toBe(false)
    expect(esDerivado('social_risk', 'review_every_days')).toBe(false)
  })
})
// F5: el aporte es requiresReason (WF-P); el programa pide motivo al devolver, suspender y cancelar (WF-G, TransitionReasonGuard)
describe('reglas de transición de F5', () => {
  it.each([
    ['social_contribution', 'approve'],
    ['social_contribution', 'approve_direct'],
    ['social_contribution', 'register_delivery'],
    ['social_program', 'return_to_draft'],
    ['social_program', 'suspend'],
    ['social_program', 'cancel_draft'],
    ['social_program', 'cancel_pending_approval'],
    ['social_program', 'cancel_planned'],
    ['social_program', 'cancel_suspended']
  ])('%s · %s exige motivo', (objeto, transicion) => {
    expect(exigeMotivo(objeto, transicion)).toBe(true)
  })

  it.each([
    ['social_program', 'submit'],
    ['social_program', 'approve'],
    ['social_program', 'start_execution'],
    ['social_program', 'close']
  ])('%s · %s no lo exige', (objeto, transicion) => {
    expect(exigeMotivo(objeto, transicion)).toBe(false)
  })

  it('WF-G y WF-P no tienen transiciones de comando: todas son botones', () => {
    expect(esDeComando('social_contribution', 'register_delivery')).toBe(false)
    expect(esDeComando('social_program', 'approve')).toBe(false)
  })
})
