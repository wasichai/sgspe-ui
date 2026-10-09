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
