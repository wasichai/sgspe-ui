// qué se fotografía de cada prototipo: claro en español siempre; oscuro, inglés y teléfono donde el patrón lo pide
const base = [
  ['P01', 'p01-inicio'],
  ['P01Agente', 'p01-inicio-agente'],
  ['P02', 'p02-listado'],
  ['P03', 'p03-proyecto-360'],
  ['P04', 'p04-formulario'],
  ['P05', 'p05-bandeja'],
  ['P06', 'p06-mapa'],
  ['P07', 'p07-tablero-ejecutivo'],
  ['P08', 'p08-administracion'],
  ['P09', 'p09-ficha'],
  ['PEstados', 'pe-estados']
]
const oscuro = ['P01', 'P02', 'P06', 'P07', 'P09']
const ingles = ['P01', 'P02', 'P04', 'P05']
const telefono = ['P01Agente', 'P02', 'P09']

export const VARIANTES = [
  ...base.map(([p, a]) => ({ p, tema: 'light', idioma: 'es', archivo: `${a}-claro-es` })),
  ...base.filter(([p]) => oscuro.includes(p)).map(([p, a]) => ({ p, tema: 'dark', idioma: 'es', archivo: `${a}-oscuro-es` })),
  ...base.filter(([p]) => ingles.includes(p)).map(([p, a]) => ({ p, tema: 'light', idioma: 'en', archivo: `${a}-claro-en` })),
  ...base
    .filter(([p]) => telefono.includes(p))
    .map(([p, a]) => ({ p, tema: 'light', idioma: 'es', archivo: `${a}-telefono`, ancho: 390, alto: 844, completa: false }))
]
