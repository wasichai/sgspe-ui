import { describe, expect, it } from 'vitest'

// los textos de pantalla dicen qué puede hacer la persona, no cómo está hecho el sistema (hallazgos U-24 y U-36 de la
// auditoría de UX). quien registra una queja no sabe qué es un endpoint, un tenant o una transición, ni dónde queda «la
// barra superior» en el rediseño. escanea cada módulo de src/portal/textos, en español y en inglés, como
// textosSinCodigos.test.ts; aquel vigila los códigos, este la jerga de implementación

// es.ts y en.ts solo agregan los módulos: escanearlos repetiría cada hallazgo
const MODULOS = import.meta.glob<Record<string, unknown>>(['./textos/*.ts', '!./textos/es.ts', '!./textos/en.ts'], {
  eager: true
})

// la lista corta de jerga dirigida a la persona usuaria, con por qué cada una
const JERGA: [RegExp, string][] = [
  // el nombre técnico del flujo de estados: la persona ve «pasos» y «estados»
  [/\bworkflows?\b/i, 'workflow'],
  [/\btransici(ón|ones)\b|\btransitions?\b/i, 'transición'],
  // piezas de la implementación que la persona no ve ni maneja
  [/\bendpoints?\b/i, 'endpoint'],
  [/\btenants?\b/i, 'tenant'],
  [/\bmetadat(a|os?)\b/i, 'metadata'],
  [/\bbackend\b/i, 'backend'],
  // como palabra suelta: «GeoJSON» es un formato de archivo que la persona elige y queda permitido
  [/\bJSON\b/, 'JSON'],
  [/\bAPI\b/, 'API'],
  // quien hace algo es el sistema, no una máquina que la persona no ve
  [/\bservidor(es)?\b|\bservers?\b/i, 'servidor'],
  // «objeto» es el nombre del modelo de datos; la persona habla de registros, quejas, predios…
  [/\bobjetos?\b|\bobjects?\b/i, 'objeto'],
  [/\bmodelo de datos\b|\bdata model\b/i, 'modelo de datos'],
  [/\baprovision|\bprovision/i, 'aprovisionar'],
  // la ubicación de un control cambia con el diseño: se nombra el control, no su lugar
  [/\bbarra superior\b|\btop bar\b/i, 'barra superior'],
  // las fases y el alcance del producto son de la planificación, no de la pantalla
  [/\bMVP\b/, 'MVP'],
  [/\ben esta fase\b|\bin this phase\b/i, 'fase del producto']
]

// frases que casan con un patrón y aun así son texto legítimo. se mantiene corta: cada entrada dice por qué
const PERMITIDAS: RegExp[] = [
  // la validación de plantillas Word: «objetos incrustados» (OLE) es el nombre que Word le da y el que la persona ve allí
  /objetos incrustados|embedded objects/gi
]

// las cadenas de un objeto de textos, con su clave aplanada: "ficha.noDescarga"
function hojas(textos: unknown, prefijo: string): [string, string][] {
  if (typeof textos === 'string') return [[prefijo, textos]]
  if (textos === null || typeof textos !== 'object') return []
  return Object.entries(textos).flatMap(([clave, valor]) => hojas(valor, `${prefijo}.${clave}`))
}

// la interpolación ({{objeto}}) es el nombre de una variable, no texto que la persona lea
const jergaEn = (texto: string): string[] => {
  const limpio = PERMITIDAS.reduce((t, frase) => t.replace(frase, ''), texto.replace(/\{\{[^}]*\}\}/g, ''))
  return JERGA.filter(([patron]) => patron.test(limpio)).map(([, nombre]) => nombre)
}

describe('textos en lenguaje llano', () => {
  it('los patrones reconocen la jerga y dejan pasar lo legítimo', () => {
    expect(jergaEn('Su rol no puede dar este paso del workflow.')).toEqual(['workflow'])
    expect(jergaEn('Su rol no tiene una transición de aprobación aquí')).toEqual(['transición'])
    expect(jergaEn('El servidor no permite este paso ahora.')).toEqual(['servidor'])
    expect(jergaEn('las capas se muestran por la API')).toEqual(['API'])
    expect(jergaEn('Proyecto: {{proyecto}}, el de la barra superior.')).toEqual(['barra superior'])
    expect(jergaEn('Los objetos de la organización no se filtran')).toEqual(['objeto'])
    expect(jergaEn('Esa capa no existe en esta fase.')).toEqual(['fase del producto'])
    expect(jergaEn('Archivo (XLSX, CSV o GeoJSON)')).toEqual([])
    expect(jergaEn('Sin macros, objetos incrustados ni vínculos externos')).toEqual([])
    expect(jergaEn('Una servidumbre necesita al menos un predio.')).toEqual([])
    expect(jergaEn('Cambiar la fase de exploración exige un motivo.')).toEqual([])
    expect(jergaEn('Sobre el registro {{objeto}} {{id}}: ')).toEqual([])
  })

  it('ningún texto de src/portal/textos lleva jerga de implementación', () => {
    const hallazgos = Object.entries(MODULOS).flatMap(([archivo, modulo]) =>
      Object.entries(modulo).flatMap(([nombre, textos]) =>
        hojas(textos, `${archivo.replace('./textos/', '')}:${nombre}`).flatMap(([clave, texto]) => jergaEn(texto).map((j) => `${clave} → ${j}`))
      )
    )
    expect(hallazgos).toEqual([])
  })
})
