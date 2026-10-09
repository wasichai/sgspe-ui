import { describe, expect, it } from 'vitest'

// los textos de pantalla nunca muestran un código interno: ni un ID de requisito o de decisión del diseño, ni el código de
// una acción, de un error o de un campo de la API. quien está en campo no sabe qué es UPS-23, (D11) o DOWNLOAD_RESTRICTED.
// escanea cada módulo de src/portal/textos, en español y en inglés, también los que es.ts o en.ts no agregaran todavía

// es.ts y en.ts solo agregan los módulos: escanearlos repetiría cada hallazgo
const MODULOS = import.meta.glob<Record<string, unknown>>(['./textos/*.ts', '!./textos/es.ts', '!./textos/en.ts'], {
  eager: true
})

// lo que delata un código en un texto visible
const PATRONES: [string, RegExp][] = [
  // un ID de requirements-analysis.md: RF-…, RNF-PRIV-004, ASM-090, UPS-23, CON-006
  ['ID de requisito', /\b(?:RF|RNF|RN|RQ|ASM|UPS|GAP|CON)-[A-Z0-9-]+/g],
  // una decisión del plan o del diseño: (D11), D10
  ['ID de decisión', /\bD\d+\b/g],
  // un código de acción, de error o de enum en UPPER_SNAKE: DOWNLOAD_RESTRICTED, APPROVE_OVER_CAP
  ['código UPPER_SNAKE', /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g],
  // una acción de permiso de wasichai en crudo: «la acción APPROVE», «el permiso EXPORT»
  ['acción de permiso', /\b(?:READ|CREATE|UPDATE|DELETE|EXPORT|IMPORT|APPROVE|DOWNLOAD)\b/g],
  // un nombre de la API en camelCase o snake_case: requiresReason, ignoredFilters, due_date
  ['nombre de la API', /\b[a-z]+[A-Z][A-Za-z0-9]*\b|\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g]
]

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

// los códigos que aparecen en un texto; las interpolaciones {{n}} de i18next no son texto visible
function codigosEn(texto: string): string[] {
  const visible = texto.replace(/\{\{[^}]*\}\}/g, '')
  return PATRONES.flatMap(([nombre, patron]) =>
    [...visible.matchAll(patron)]
      .map(([m]) => m)
      .filter((m) => !PERMITIDAS.has(m))
      .map((m) => `${nombre}: ${m}`)
  )
}

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
