import { describe, expect, it } from 'vitest'
import { CANDIDATO_IA, SUG_ACTOR, SUG_BORRADOR, SUG_CLASIFICACION, SUG_DUPLICADO, SUG_ILEGIBLE, SUG_RESUMEN } from '../../test/ia'
import { registro } from '../../test/montar'
import {
  campoDelFormulario,
  camposQueFaltan,
  cuerpoDeAceptacion,
  enLaBandeja,
  filaDe,
  ordenarPropuestas,
  textosLibres,
  valorLegible,
  valoresIniciales
} from './sugerencias'

// la lista cerrada de ai-architecture.md §4.2 en el portal: cada sugerencia cae en una fila o en ninguna, y la bandeja ordena por
// confianza y fecha (decisiones 11 y 12 del plan)
const con = (attributes: Record<string, unknown>) => registro('x', { project: 'p1', ...attributes }, { state: 'proposed' })

describe('sugerencias de la bandeja', () => {
  it('cada fila de la lista cerrada se reconoce', () => {
    expect(filaDe(SUG_CLASIFICACION)).toEqual({ fila: 'clasificacion', campo: 'category', valor: 'AGUA Y MEDIO AMBIENTE' })
    expect(filaDe(SUG_ACTOR)).toEqual({ fila: 'persona', nombre: '[PERSONA]', existente: null, localidad: 'l1', tipoDeGrupo: null })
    expect(filaDe(SUG_DUPLICADO)).toEqual({ fila: 'duplicado', otro: 'g2', razones: ['Mismo anexo y misma fecha'] })
    expect(filaDe(SUG_BORRADOR)).toEqual({ fila: 'borrador', texto: '## Acuerdos\n- [PERSONA:pe1] pidió el reservorio' })
    expect(filaDe(SUG_RESUMEN)?.fila).toBe('resumen')
    const lugar = con({ suggestion_kind: 'EXTRACCION', target_object: 'engagement', suggested_value: '{"item":"place","field":"community","value":"c1"}' })
    expect(filaDe(lugar)).toEqual({ fila: 'lugar', campo: 'community', valor: 'c1' })
    const fecha = con({
      suggestion_kind: 'EXTRACCION',
      target_object: 'agreement',
      suggested_value: '{"item":"date","field":"expiry_date","value":"2027-03-31"}'
    })
    expect(filaDe(fecha)).toEqual({ fila: 'fecha', campo: 'expiry_date', valor: '2027-03-31' })
    const grupo = con({
      suggestion_kind: 'EXTRACCION',
      target_object: 'organization',
      suggested_value:
        '{"item":"actor","kind":"organization","name":"Junta Ejemplo","organization_type":"JUNTA","stakeholder":{"stakeholder_type":"ORGANIZACION COMUNAL"}}'
    })
    expect(filaDe(grupo)).toEqual({
      fila: 'organizacion',
      nombre: 'Junta Ejemplo',
      tipo: 'JUNTA',
      localidad: '',
      tipoDeGrupo: 'ORGANIZACION COMUNAL',
      existente: null
    })
    const registrada = con({ ...grupo.attributes, target_record_id: 'o9' })
    expect(filaDe(registrada)).toMatchObject({ fila: 'organizacion', existente: 'o9' })
  })

  it('filaDe rechaza lo que la lista cerrada no permite', () => {
    expect(filaDe(SUG_ILEGIBLE)).toBeNull()
    expect(filaDe(con({ suggestion_kind: 'CLASIFICACION', target_object: 'stakeholder', suggested_value: '{"field":"stance","value":"A FAVOR"}' }))).toBeNull()
    expect(
      filaDe(con({ suggestion_kind: 'CLASIFICACION', target_object: 'grievance', suggested_value: '{"field":"workflow_state","value":"closed"}' }))
    ).toBeNull()
    expect(
      filaDe(con({ suggestion_kind: 'EXTRACCION', target_object: 'engagement', suggested_value: '{"item":"date","field":"held_at","value":"2026-10-01"}' }))
    ).toBeNull()
    expect(filaDe(con({ suggestion_kind: 'DUPLICADO', target_object: 'evidence', suggested_value: '{"other_record_id":"ev2"}' }))).toBeNull()
    expect(filaDe(con({ suggestion_kind: 'OTRO', target_object: 'grievance', suggested_value: '{}' }))).toBeNull()
  })

  it('dice si el valor se puede leer, y deja el resumen ejecutivo fuera de la bandeja', () => {
    expect(valorLegible(SUG_ILEGIBLE)).toBe(false)
    expect(valorLegible(SUG_BORRADOR)).toBe(true)
    expect(valorLegible(SUG_CLASIFICACION)).toBe(true)
    expect(enLaBandeja(SUG_RESUMEN)).toBe(false)
    expect(enLaBandeja(SUG_BORRADOR)).toBe(true)
  })

  it('ordena por confianza, sin confianza al final, y a igual confianza la más reciente primero', () => {
    const humano = registro('k2', { project: 'p1', proposed_text: 'y' }, { state: 'proposed', createdAt: '2026-10-12T15:00:00Z' })
    const gemela = registro('s9', { ...SUG_CLASIFICACION.attributes }, { state: 'proposed', createdAt: '2026-10-10T15:00:00Z' })
    const orden = ordenarPropuestas([
      { clase: 'candidato', registro: humano },
      { clase: 'sugerencia', registro: SUG_ACTOR },
      { clase: 'sugerencia', registro: SUG_CLASIFICACION },
      { clase: 'sugerencia', registro: gemela },
      { clase: 'candidato', registro: CANDIDATO_IA }
    ]).map((p) => p.registro.id)
    expect(orden).toEqual(['k1', 's9', 's1', 's2', 'k2'])
  })
})

// la aceptación (ai-architecture.md §4.2, decisión 15 del plan): la forma de suggested_value de su fila con los valores revisados
describe('aceptación de una sugerencia', () => {
  it('arma el cuerpo con la forma de su fila', () => {
    expect(cuerpoDeAceptacion({ fila: 'clasificacion', campo: 'category', valor: 'EMPLEO' })).toEqual({ field: 'category', value: 'EMPLEO' })
    expect(cuerpoDeAceptacion({ fila: 'lugar', campo: 'locality', valor: 'l1' })).toEqual({ item: 'place', field: 'locality', value: 'l1' })
    expect(cuerpoDeAceptacion({ fila: 'tema', valor: 't1' })).toEqual({ item: 'topic', topic: 't1' })
    expect(cuerpoDeAceptacion({ fila: 'fecha', campo: 'expiry_date', valor: '2027-03-31' })).toEqual({
      item: 'date',
      field: 'expiry_date',
      value: '2027-03-31'
    })
    expect(cuerpoDeAceptacion({ fila: 'clausula', numero: '5', texto: 'Contratar un vigía', creaCompromiso: true })).toEqual({
      item: 'clause',
      clause_number: '5',
      clause_text: 'Contratar un vigía',
      creates_commitment: true
    })
    expect(
      cuerpoDeAceptacion({
        fila: 'organizacion',
        existente: 'o9',
        nombre: 'Junta Ejemplo',
        tipo: 'JUNTA',
        localidad: 'l1',
        tipoDeGrupo: 'ORGANIZACION COMUNAL'
      })
    ).toEqual({ item: 'actor', kind: 'organization', stakeholder: { stakeholder_type: 'ORGANIZACION COMUNAL' } })
    expect(
      cuerpoDeAceptacion({ fila: 'organizacion', existente: null, nombre: 'Junta Ejemplo', tipo: 'JUNTA', localidad: '', tipoDeGrupo: 'ORGANIZACION COMUNAL' })
    ).toEqual({
      item: 'actor',
      kind: 'organization',
      name: 'Junta Ejemplo',
      organization_type: 'JUNTA',
      stakeholder: { stakeholder_type: 'ORGANIZACION COMUNAL' }
    })
    expect(
      cuerpoDeAceptacion({ fila: 'persona', existente: null, nombres: 'Rosa', apellidos: 'Ejemplo', sexo: '', localidad: 'l1', tipoDeGrupo: null })
    ).toEqual({
      item: 'actor',
      kind: 'person',
      given_names: 'Rosa',
      surnames: 'Ejemplo',
      residence_locality: 'l1'
    })
    expect(cuerpoDeAceptacion({ fila: 'persona', existente: 'pe1', nombres: '', apellidos: '', sexo: '', localidad: 'l1', tipoDeGrupo: null })).toEqual({
      item: 'actor',
      kind: 'person'
    })
    expect(cuerpoDeAceptacion({ fila: 'borrador', texto: '## Acta' })).toEqual({ minutes: '## Acta' })
    expect(cuerpoDeAceptacion({ fila: 'duplicado', otro: 'g2', respuesta: 'Se atiende en la Q-002' })).toEqual({
      other_record_id: 'g2',
      response: 'Se atiende en la Q-002'
    })
    expect(cuerpoDeAceptacion({ fila: 'duplicado', otro: 'o2', respuesta: null })).toEqual({ other_record_id: 'o2' })
  })

  it('prellena con los nombres legibles y deja los nombres de una persona nueva a quien acepta', () => {
    expect(valoresIniciales(filaDe(SUG_BORRADOR)!, new Map([['pe1', 'Ana Ejemplo']]))).toEqual({
      fila: 'borrador',
      texto: '## Acuerdos\n- Ana Ejemplo pidió el reservorio'
    })
    expect(valoresIniciales(filaDe(SUG_ACTOR)!, new Map())).toEqual({
      fila: 'persona',
      existente: null,
      nombres: '',
      apellidos: '',
      sexo: '',
      localidad: 'l1',
      tipoDeGrupo: null
    })
    expect(valoresIniciales(filaDe(SUG_RESUMEN)!, new Map())).toBeNull()
  })

  it('dice qué falta y qué textos no pueden llevar marcadores', () => {
    expect(camposQueFaltan({ fila: 'persona', existente: null, nombres: '', apellidos: 'Ejemplo', sexo: '', localidad: '', tipoDeGrupo: '' })).toEqual([
      'given_names',
      'stakeholder_type'
    ])
    expect(camposQueFaltan({ fila: 'persona', existente: 'pe1', nombres: '', apellidos: '', sexo: '', localidad: '', tipoDeGrupo: null })).toEqual([])
    expect(camposQueFaltan({ fila: 'clasificacion', campo: 'category', valor: '' })).toEqual(['value'])
    expect(camposQueFaltan({ fila: 'organizacion', existente: null, nombre: '', tipo: '', localidad: '', tipoDeGrupo: null })).toEqual([
      'name',
      'organization_type'
    ])
    expect(camposQueFaltan({ fila: 'organizacion', existente: 'o9', nombre: '', tipo: '', localidad: '', tipoDeGrupo: '' })).toEqual(['stakeholder_type'])
    expect(textosLibres({ fila: 'organizacion', existente: 'o9', nombre: '[PERSONA]', tipo: '', localidad: '', tipoDeGrupo: null })).toEqual([])
    expect(textosLibres({ fila: 'clausula', numero: '5', texto: 'a [PERSONA]', creaCompromiso: false })).toEqual(['5', 'a [PERSONA]'])
    expect(textosLibres({ fila: 'clausula', numero: '[CORREO]', texto: 'a', creaCompromiso: false })).toContain('[CORREO]')
    expect(textosLibres({ fila: 'persona', existente: null, nombres: 'Rosa', apellidos: '[PERSONA]', sexo: '', localidad: '', tipoDeGrupo: null })).toEqual([
      'Rosa',
      '[PERSONA]'
    ])
  })
})

// los rechazos del servidor van sobre attributes.<ruta> (api.md §4.14), también dentro de stakeholder: cada ruta cae en su control
describe('campos de un rechazo de la aceptación', () => {
  it('lleva cada ruta del servidor a su control', () => {
    expect(campoDelFormulario('attributes.value')).toBe('value')
    expect(campoDelFormulario('attributes.stakeholder.stakeholder_type')).toBe('stakeholder_type')
    expect(campoDelFormulario('attributes.stakeholder')).toBe('stakeholder_type')
    expect(campoDelFormulario('attributes.residence_locality')).toBe('locality')
    expect(campoDelFormulario('attributes.clause_number')).toBe('clause_number')
    expect(campoDelFormulario('reason')).toBe('reason')
    expect(campoDelFormulario('attributes.field')).toBe('field')
  })
})
