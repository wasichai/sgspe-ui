import { describe, expect, it } from 'vitest'
import { PERSONA_ID } from '../../test/f8'
import { deSugerencia, listaParaUsar, mencion, normalizarMarkdown, partirMenciones } from './menciones'

// las menciones de la narrativa (spec §2.2.9): tokens [[tipo:<id>]] con ids UUID, como Mentions.TOKEN del backend
describe('menciones', () => {
  it('parte un texto en trozos y menciones', () => {
    expect(partirMenciones(`Habló ${mencion('person', PERSONA_ID)} con el grupo.`)).toEqual([
      { tipo: 'texto', texto: 'Habló ' },
      { tipo: 'mencion', clase: 'person', id: PERSONA_ID },
      { tipo: 'texto', texto: ' con el grupo.' }
    ])
    expect(partirMenciones('[[person:no-es-un-uuid]]')).toEqual([{ tipo: 'texto', texto: '[[person:no-es-un-uuid]]' }])
  })

  it('convierte las personas identificadas y deja los demás marcadores', () => {
    expect(deSugerencia(`La directiva, con «[PERSONA:${PERSONA_ID}]», pidió una reunión.`)).toBe(
      `La directiva, con [[person:${PERSONA_ID}]], pidió una reunión.`
    )
    expect(deSugerencia(`[PERSONA:${PERSONA_ID}] y [PERSONA:${PERSONA_ID}]`)).toBe(`[[person:${PERSONA_ID}]] y [[person:${PERSONA_ID}]]`)
    const conReservados = deSugerencia('Habló [PERSONA], con teléfono [TELEFONO].')
    expect(conReservados).toBe('Habló [PERSONA], con teléfono [TELEFONO].')
    expect(listaParaUsar(conReservados)).toBe(false)
    expect(listaParaUsar(deSugerencia(`Con [PERSONA:${PERSONA_ID}].`))).toBe(true)
    expect(listaParaUsar('Con [PERSONA_1].')).toBe(false)
  })

  it('normaliza los finales de línea, los espacios al final y las líneas en blanco de más', () => {
    expect(normalizarMarkdown('Uno  \r\n\r\n\r\nDos\n')).toBe('Uno\n\nDos')
  })
})
