import { describe, expect, it } from 'vitest'
import { CANDIDATO_IA, SUG_ACTOR, SUG_BORRADOR, SUG_CLASIFICACION, SUG_DUPLICADO, SUG_ILEGIBLE, SUG_RESUMEN } from '../../test/ia'
import { registro } from '../../test/montar'
import { enLaBandeja, filaDe, ordenarPropuestas, valorLegible } from './sugerencias'

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
    expect(filaDe(grupo)).toEqual({ fila: 'organizacion', nombre: 'Junta Ejemplo', tipo: 'JUNTA', localidad: '', tipoDeGrupo: 'ORGANIZACION COMUNAL' })
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
