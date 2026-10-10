import { describe, expect, it } from 'vitest'
import { codigosEn as codigosDe } from './componentes/codigosVisibles'

// los textos de pantalla nunca muestran un código interno: ni un ID de requisito o de decisión del diseño, ni el código de
// una acción, de un error o de un campo de la API. quien está en campo no sabe qué es UPS-23, (D11) o DOWNLOAD_RESTRICTED.
// escanea cada módulo de src/portal/textos, en español y en inglés, también los que es.ts o en.ts no agregaran todavía

// es.ts y en.ts solo agregan los módulos: escanearlos repetiría cada hallazgo
const MODULOS = import.meta.glob<Record<string, unknown>>(['./textos/*.ts', '!./textos/es.ts', '!./textos/en.ts'], {
  eager: true
})

// palabras que casan con un patrón y aun así son texto legítimo. se mantiene corta: cada entrada dice por qué. las
// etiquetas de enum del modelo en mayúsculas («CONFIDENCIAL», «DATOS PERSONALES», «ASAMBLEA», «VENCIDO») ya no casan,
// porque se escriben con espacios y no con '_'; no hace falta listarlas
const PERMITIDAS = new Set<string>([])

// las cadenas de un objeto de textos, con su clave aplanada: "ficha.noDescarga"
function hojas(textos: unknown, prefijo: string): [string, string][] {
  if (typeof textos === 'string') return [[prefijo, textos]]
  if (textos === null || typeof textos !== 'object') return []
  return Object.entries(textos).flatMap(([clave, valor]) => hojas(valor, `${prefijo}.${clave}`))
}

const codigosEn = (texto: string): string[] => codigosDe(texto).filter((c) => !PERMITIDAS.has(c.slice(c.indexOf(': ') + 2)))

describe('textos sin códigos internos', () => {
  it('hay módulos de textos en español y en inglés', () => {
    const exportados = Object.values(MODULOS).flatMap((m) => Object.keys(m))
    expect(exportados.filter((n) => n.startsWith('ES_')).length).toBeGreaterThan(20)
    expect(exportados.filter((n) => n.startsWith('EN_')).length).toBe(exportados.filter((n) => n.startsWith('ES_')).length)
  })

  it('los patrones reconocen los códigos y dejan pasar las etiquetas del modelo', () => {
    expect(codigosEn('hace falta DOWNLOAD_RESTRICTED')).toEqual(['código UPPER_SNAKE: DOWNLOAD_RESTRICTED'])
    expect(codigosEn('alguien más lo verifica (D11).')).toEqual(['ID de decisión: D11'])
    expect(codigosEn('no imprimen datos restringidos (ASM-090).')).toEqual(['ID de requisito: ASM-090'])
    expect(codigosEn('tiene la acción APPROVE')).toEqual(['acción de permiso: APPROVE'])
    expect(codigosEn('falta requiresReason')).toEqual(['nombre de la API: requiresReason'])
    expect(codigosEn('sin due_date')).toEqual(['nombre de la API: due_date'])
    expect(codigosEn('es CONFIDENCIAL o de DATOS PERSONALES, de tipo ASAMBLEA o VENCIDO')).toEqual([])
    expect(codigosEn('{{n}} de {{totalDeFilas}} por código GI-')).toEqual([])
    // humo F4 (D3): la transición y el campo en crudo, un estado HTTP, una decisión P54 y una propiedad de configuración
    expect(codigosEn('La transición decline exige response')).toEqual(['transición en crudo: transición decline exige'])
    expect(codigosEn('La transición reject_acknowledged exige response')).toContain('nombre de la API: reject_acknowledged')
    expect(codigosEn('de 1 a 365 (400 OUT_OF_RANGE)')).toEqual(['código UPPER_SNAKE: OUT_OF_RANGE', 'estado HTTP: 400'])
    expect(codigosEn('solo lo de su proyecto (P54)')).toEqual(['ID de decisión: P54'])
    expect(codigosEn('feriados de sgspe.calendar.holidays')).toEqual(['propiedad de configuración: sgspe.calendar.holidays'])
    expect(codigosEn('De 1 a 365; vacío = la frecuencia del proyecto. Llega en F7.')).toEqual([])
  })

  // errores.ts dice el texto de un código sin interpolar errors[].field: es el nombre de la API («engagement.project»), no una
  // etiqueta (humo F4, D3)
  it('ningún texto de un código de la API interpola el campo crudo', () => {
    const conCampo = Object.entries(MODULOS).flatMap(([archivo, modulo]) =>
      Object.entries(modulo).flatMap(([nombre, textos]) =>
        hojas((textos as { codigos?: unknown }).codigos, `${archivo.replace('./textos/', '')}:${nombre}.codigos`)
          .filter(([, texto]) => texto.includes('{{campo}}'))
          .map(([clave]) => clave)
      )
    )
    expect(conCampo).toEqual([])
  })

  it('ningún texto de src/portal/textos muestra un código', () => {
    const hallazgos = Object.entries(MODULOS).flatMap(([archivo, modulo]) =>
      Object.entries(modulo).flatMap(([nombre, textos]) =>
        hojas(textos, `${archivo.replace('./textos/', '')}:${nombre}`).flatMap(([clave, texto]) => codigosEn(texto).map((codigo) => `${clave} → ${codigo}`))
      )
    )
    expect(hallazgos).toEqual([])
  })
})
