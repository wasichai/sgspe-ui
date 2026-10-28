import { describe, expect, it } from 'vitest'
import { conteosDe, filasDe, traspasoDe } from './traspaso'

describe('traspaso entre el asistente y el modo rápido', () => {
  it('cuenta los asistentes por sexo y ámbito y vuelve a hacerlos filas sin nombres', () => {
    const conteos = conteosDe([
      { sex: 'FEMENINO', participant_scope: 'AIDS', represented_people_count: 3, attended: true },
      { sex: 'FEMENINO', participant_scope: 'AIDS', represented_people_count: 2, attended: true },
      { sex: 'MASCULINO', participant_scope: 'AIDS', represented_people_count: 4, attended: false },
      { sex: '', participant_scope: 'AIDS', represented_people_count: 1, attended: true }
    ])
    expect(conteos).toEqual({ 'FEMENINO|AIDS': 5 })
    expect(filasDe({ ...conteos, 'MASCULINO|AIIS': 0 })).toEqual([
      { tipo: 'grupo', participant_name: '', represented_group: '', sex: 'FEMENINO', participant_scope: 'AIDS', represented_people_count: 5, attended: true }
    ])
  })

  it('lee el traspaso del estado del historial solo si tiene su forma', () => {
    expect(traspasoDe(null)).toBeNull()
    expect(traspasoDe({ hecho: 'x' })).toBeNull()
    expect(traspasoDe({ traspaso: { tipo: 'ASAMBLEA', grupos: ['s1', 3], punto: [1, 2] } })).toEqual({
      tipo: 'ASAMBLEA',
      grupos: ['s1'],
      conteos: {},
      punto: [1, 2]
    })
  })
})
