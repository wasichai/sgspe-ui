import { describe, expect, it } from 'vitest'
import { registro } from '../../test/montar'
import { esGrave, esQcs, estaAbierta, plazoQueCorre, rutaDeQcs } from './atencion'
import { rutaDeFicha } from './fichas'

// lo que comparten las pantallas de F4: qué es una QCS, su ficha, el plazo que corre en cada estado (ASM-100) y cuándo sigue
// abierta; y la ficha de cada objeto de F4 bajo su proyecto
describe('las QCS en el portal', () => {
  it('las tres QCS son las de BC-07 y su ruta lleva el proyecto y el id codificados', () => {
    expect(['grievance', 'inquiry', 'stakeholder_request'].every(esQcs)).toBe(true)
    expect(esQcs('commitment')).toBe(false)
    expect(rutaDeQcs('p 1', 'stakeholder_request', 'r/1')).toBe('/projects/p%201/requests/r%2F1')
  })

  it.each([
    ['grievance', 'received', 'ack_due_date'],
    ['grievance', 'acknowledged', 'resolution_due_date'],
    ['grievance', 'in_investigation', 'resolution_due_date'],
    ['grievance', 'in_action', 'resolution_due_date'],
    ['inquiry', 'received', 'response_due_date']
  ] as const)('una %s en %s mide %s', (objeto, estado, campo) => {
    const qcs = registro('x', { ack_due_date: '2026-10-08', resolution_due_date: '2026-10-31', response_due_date: '2026-10-17' }, { state: estado })
    expect(plazoQueCorre(objeto, qcs)?.campo).toBe(campo)
    expect(plazoQueCorre(objeto, qcs)?.fecha).toMatch(/^2026-10-\d\d$/)
  })

  it('fuera de los estados con plazo, y en las solicitudes, no corre ninguno; sin fecha calculada todavía, el plazo es null', () => {
    expect(plazoQueCorre('grievance', registro('g', { ack_due_date: '2026-10-08' }, { state: 'resolved' }))).toBeNull()
    expect(plazoQueCorre('inquiry', registro('i', {}, { state: 'answered' }))).toBeNull()
    expect(plazoQueCorre('stakeholder_request', registro('r', {}, { state: 'received' }))).toBeNull()
    expect(plazoQueCorre('grievance', registro('g', {}, { state: 'received' }))).toEqual({ campo: 'ack_due_date', fecha: null })
  })

  it('una QCS cerrada, rechazada o desistida ya no está abierta; una resuelta o declinada sí', () => {
    expect(estaAbierta('grievance', registro('g', {}, { state: 'withdrawn' }))).toBe(false)
    expect(estaAbierta('grievance', registro('g', {}, { state: 'resolved' }))).toBe(true)
    expect(estaAbierta('stakeholder_request', registro('r', {}, { state: 'declined' }))).toBe(true)
    expect(estaAbierta('inquiry', registro('i', {}, { state: 'closed' }))).toBe(false)
  })

  it('una queja ALTA o CRITICA es grave; MEDIA no', () => {
    expect(esGrave(registro('g', { severity: 'CRITICA' }))).toBe(true)
    expect(esGrave(registro('g', { severity: 'MEDIA' }))).toBe(false)
  })

  it.each([
    ['grievance', '/projects/p1/grievances/r1'],
    ['inquiry', '/projects/p1/inquiries/r1'],
    ['stakeholder_request', '/projects/p1/requests/r1'],
    ['social_risk', '/projects/p1/risks/r1'],
    ['early_warning', '/projects/p1/risks/warnings/r1'],
    ['incident', '/projects/p1/incidents/r1'],
    ['media_mention', '/projects/p1/risks/mentions/r1'],
    ['early_warning_signal', '/projects/p1/risks/signals/r1'],
    ['potential_impact', '/projects/p1/risks/impacts'],
    ['early_warning_rule', '/projects/p1/risks/rules']
  ])('la ficha de %s vive bajo su proyecto', (objeto, ruta) => {
    expect(rutaDeFicha(objeto, registro('r1', { project: 'p1' }))).toBe(ruta)
  })

  it('una regla del tenant vive en la lista global; una medida o una revisión no tienen ruta propia', () => {
    expect(rutaDeFicha('early_warning_rule', registro('rg', {}))).toBe('/risks/rules')
    expect(rutaDeFicha('grievance', registro('g', {}))).toBeNull()
    expect(rutaDeFicha('mitigation_measure', registro('m', { social_risk: 'k1' }))).toBeNull()
  })
})
