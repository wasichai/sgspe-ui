import { opcion, rotuloDeFila, rotuloDeOpcion } from './opciones'
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
})
