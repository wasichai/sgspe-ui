import { opcion, rotuloDeFila, rotuloDeOpcion, rotuloEnIdioma } from './opciones'
import { EN_OPCIONES } from './opcionesEnIngles'
import palabras from './option-words.json'
import type { Registro } from './registros'

// los mismos casos que ReportLabelsTest en sgspe: el portal y los entregables escriben igual una opción del modelo
describe('rotuloDeOpcion', () => {
  it('escribe una opción en forma de oración con tildes y deja las siglas', () => {
    expect(rotuloDeOpcion('EN SEPARACION')).toBe('En separación')
    expect(rotuloDeOpcion('PARA MONITOREO')).toBe('Para monitoreo')
    expect(rotuloDeOpcion('ONG')).toBe('ONG')
    expect(rotuloDeOpcion('COMUNIDAD CAMPESINA')).toBe('Comunidad campesina')
    expect(rotuloDeOpcion('A FAVOR')).toBe('A favor')
    expect(rotuloDeOpcion('ESTRATEGICO')).toBe('Estratégico')
    expect(rotuloDeOpcion('EXPLORACION INICIAL')).toBe('Exploración inicial')
    expect(rotuloDeOpcion('NEGO')).toBe('Negó')
    expect(rotuloDeOpcion('SEÑALES')).toBe('Señales')
    expect(rotuloDeOpcion('EPSG 32718')).toBe('EPSG 32718')
  })

  it('escribe las opciones que se ven en las listas y las situaciones derivadas', () => {
    expect(rotuloDeOpcion('RELACION ACTIVA')).toBe('Relación activa')
    expect(rotuloDeOpcion('AL DIA')).toBe('Al día')
    expect(rotuloDeOpcion('REVISION VENCIDA')).toBe('Revisión vencida')
    expect(rotuloDeOpcion('AGUA Y MEDIO AMBIENTE')).toBe('Agua y medio ambiente')
  })

  it('deja igual lo que ya escribió una persona, un código o un vacío', () => {
    expect(rotuloDeOpcion('Puesto de salud')).toBe('Puesto de salud')
    expect(rotuloDeOpcion('ESTRATEGICO y más')).toBe('ESTRATEGICO y más')
    expect(rotuloDeOpcion('DEMO-C-04')).toBe('DEMO-C-04')
    expect(rotuloDeOpcion('T5')).toBe('T5')
    expect(rotuloDeOpcion('')).toBe('')
  })

  it('escribe en minúsculas una palabra que no está en el diccionario', () => {
    expect(rotuloDeOpcion('ZZZZ DE SALUD')).toBe('Zzzz de salud')
  })

  it('lee el campo de un registro con su rótulo', () => {
    const registro = { id: 'r1', attributes: { stance: 'EN CONTRA', nada: null } } as unknown as Registro
    expect(opcion(registro, 'stance')).toBe('En contra')
    expect(opcion(registro, 'nada')).toBe('')
    expect(opcion(undefined, 'stance')).toBe('')
  })

  it('escribe la fila de un desglose con su rótulo o, sin él, con su clave', () => {
    expect(rotuloDeFila({ key: 'ESTRATEGICO' })).toBe('Estratégico')
    expect(rotuloDeFila({ key: 'x', label: 'A FAVOR' })).toBe('A favor')
    expect(rotuloDeFila({ key: 'p1', label: 'Proyecto Wayra Ejemplo' })).toBe('Proyecto Wayra Ejemplo')
  })

  it('en inglés usa el valor traducido si existe y, si no, el rótulo en español', () => {
    const catalogo = { 'RELACION ACTIVA': 'Active relationship' }
    expect(rotuloEnIdioma('RELACION ACTIVA', 'en', catalogo)).toBe('Active relationship')
    expect(rotuloEnIdioma('EN CONTRA', 'en', catalogo)).toBe('En contra')
    expect(rotuloEnIdioma('RELACION ACTIVA', 'es-PE', catalogo)).toBe('Relación activa')
  })
})

// option-words.json clasifica toda palabra de todo enum del modelo: una clave de EN_OPCIONES con una palabra que no está ahí
// no es un valor del modelo (una errata, un valor que ya no existe) y nunca se usaría
describe('EN_OPCIONES', () => {
  const conocidas = new Set([...palabras.acronyms, ...Object.keys(palabras.accents), ...palabras.plain])

  it('solo tiene valores del modelo, tal como se guardan, con su texto en inglés', () => {
    for (const [valor, enIngles] of Object.entries(EN_OPCIONES)) {
      expect(valor, valor).toBe(valor.toUpperCase())
      expect(
        valor.split(' ').filter((p) => !conocidas.has(p)),
        valor
      ).toEqual([])
      expect(enIngles.trim(), valor).not.toBe('')
      expect(enIngles, valor).not.toBe(valor)
    }
  })

  it('traduce las opciones que se ven en las listas', () => {
    expect(rotuloEnIdioma('RELACION ACTIVA', 'en', EN_OPCIONES)).toBe('Active relationship')
    expect(rotuloEnIdioma('EN CONTRA PERO ABIERTO A ESCUCHAR', 'en', EN_OPCIONES)).toBe('Opposed but open to dialogue')
    expect(rotuloEnIdioma('CRITICA', 'en', EN_OPCIONES)).toBe('Critical')
    expect(rotuloEnIdioma('AIDS', 'en', EN_OPCIONES)).toBe('Direct social area of influence')
    expect(rotuloEnIdioma('EPSG 32718', 'en', EN_OPCIONES)).toBe('EPSG 32718')
    expect(rotuloEnIdioma('RELACION ACTIVA', 'es-PE', EN_OPCIONES)).toBe('Relación activa')
  })
})
