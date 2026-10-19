import { describe, expect, it } from 'vitest'
import { EN } from './textos/en'
import { ES } from './textos/es'

// las fases (F1 a F8) son del plan de trabajo, no de quien usa el portal: ningún texto de pantalla promete algo «en F3» ni
// dice en qué fase llega una sección. lo que no existe todavía se calla o se dice sin fase
const FASE = /\bF[1-9]\b|\{\{\s*fase\s*\}\}/

function hojas(textos: unknown, prefijo: string): [string, string][] {
  if (typeof textos === 'string') return [[prefijo, textos]]
  if (textos === null || typeof textos !== 'object') return []
  return Object.entries(textos).flatMap(([clave, valor]) => hojas(valor, `${prefijo}.${clave}`))
}

describe('textos sin fases', () => {
  it('el patrón reconoce una fase y deja pasar lo demás', () => {
    expect(FASE.test('Los compromisos llegan en F3.')).toBe(true)
    expect(FASE.test('Esta sección llega en {{fase}}')).toBe(true)
    expect(FASE.test('Fecha de la revisión')).toBe(false)
  })

  it.each([
    ['es', ES],
    ['en', EN]
  ])('ningún texto en %s menciona una fase', (idioma, textos) => {
    const conFase = hojas(textos, idioma).filter(([, texto]) => FASE.test(texto))
    expect(conFase).toEqual([])
  })
})
