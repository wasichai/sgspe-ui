import { describe, expect, it } from 'vitest'
import { partirMarcadores, personasCitadas, quedanMarcadores, reidentificar } from './marcadores'

// los marcadores de ai-architecture.md §12.2: una persona registrada lleva su id; los demás son tipados y sin valor; los
// marcadores por llamada ([PERSONA_1]) se dicen como reservados (decisión 10 del plan)
describe('marcadores de la IA', () => {
  it('parte el texto en texto, personas y reservados', () => {
    expect(partirMarcadores('Pidió [PERSONA:pe1] al [TELEFONO].')).toEqual([
      { tipo: 'texto', texto: 'Pidió ' },
      { tipo: 'persona', id: 'pe1' },
      { tipo: 'texto', texto: ' al ' },
      { tipo: 'reservado', clase: 'TELEFONO' },
      { tipo: 'texto', texto: '.' }
    ])
    expect(partirMarcadores('[PERSONA] y [PERSONA_2]')).toEqual([
      { tipo: 'reservado', clase: 'PERSONA' },
      { tipo: 'texto', texto: ' y ' },
      { tipo: 'reservado', clase: 'PERSONA' }
    ])
  })

  it('reconoce los marcadores de los campos restringidos y sus formas numeradas', () => {
    expect(partirMarcadores('[CONTACTO] [DATO_SENSIBLE_2] [CITA_1]')).toEqual([
      { tipo: 'reservado', clase: 'CONTACTO' },
      { tipo: 'texto', texto: ' ' },
      { tipo: 'reservado', clase: 'DATO_SENSIBLE' },
      { tipo: 'texto', texto: ' ' },
      { tipo: 'reservado', clase: 'CITA' }
    ])
    for (const m of ['[CONTACTO]', '[DATO_SENSIBLE]', '[CITA]', '[CITA_3]']) expect(quedanMarcadores(`texto ${m}`)).toBe(true)
  })

  it('lo que no es un marcador queda como texto', () => {
    expect(partirMarcadores('[CARGO] [persona:1] [DOCUMENTO')).toEqual([{ tipo: 'texto', texto: '[CARGO] [persona:1] [DOCUMENTO' }])
    expect(partirMarcadores('')).toEqual([])
  })

  it('dice si quedan marcadores y qué personas se citan, sin repetir', () => {
    expect(quedanMarcadores('Entregar víveres a la junta')).toBe(false)
    expect(quedanMarcadores('Escribirle al [CORREO]')).toBe(true)
    expect(quedanMarcadores('Lo pidió [PERSONA:pe1]')).toBe(true)
    expect(personasCitadas('[PERSONA:a] y [PERSONA:b] con [PERSONA:a]')).toEqual(['a', 'b'])
  })

  it('re-identifica solo las personas con nombre y deja los demás marcadores', () => {
    expect(reidentificar('[PERSONA:pe1] y [PERSONA:pe2] con [DOCUMENTO]', new Map([['pe1', 'Ana Ejemplo']]))).toBe(
      'Ana Ejemplo y [PERSONA:pe2] con [DOCUMENTO]'
    )
  })
})
