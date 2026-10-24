import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

// CA-1.5.3 (hallazgo U-07, decisión DD-07): ninguna pantalla del portal dibuja un campo de fecha nativo. un <input type="date">
// o type="datetime-local" lo pinta el navegador con su configuración regional (mm/dd/yyyy, AM/PM); las fechas se escriben con
// CampoFecha (componentes/CampoFecha.tsx), que muestra y lee dd/mm/aaaa y la hora de 24 h en los dos idiomas. lo mismo con el
// mes (wasichai/sgspe#136): un type="month" lo dice el navegador («September 2026»); el mes se elige con CampoMes
// (componentes/CampoMes.tsx), con su nombre es-PE y el año en los dos idiomas. escanea las fuentes de src/portal (no las
// pruebas), sin sus comentarios
const PORTAL = import.meta.dirname

// type="date", type='date', type={'date'} o type: 'date', y lo mismo con datetime-local y month
const NATIVO = /\btype\s*(?:=|:)\s*\{?\s*['"`](?:date|datetime-local|month)['"`]/

// la única fuente que puede llevarlo: CampoFecha, el componente que lo reemplaza (CampoMes no lo necesita)
const EXCEPCIONES = ['componentes/CampoFecha.tsx']

function fuentes(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) return fuentes(ruta)
    return /\.tsx?$/.test(nombre) && !/\.test\.tsx?$/.test(nombre) ? [ruta] : []
  })
}

const ruta = (archivo: string) => relative(PORTAL, archivo).split(sep).join('/')
const exceptuada = (r: string) => EXCEPCIONES.some((e) => (e.endsWith('/') ? r.startsWith(e) : r === e))

// la línea sin su comentario: un comentario puede nombrar el campo nativo para explicar por qué no se usa
const sinComentario = (linea: string) => {
  if (/^\s*(\/\/|\/\*|\*|\{\/\*)/.test(linea)) return ''
  return linea.replace(/('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)|\/\/.*$/g, (_m, cadena?: string) => cadena ?? '')
}

const hallazgos = () =>
  fuentes(PORTAL)
    .filter((archivo) => !exceptuada(ruta(archivo)))
    .flatMap((archivo) =>
      readFileSync(archivo, 'utf8')
        .split('\n')
        .map(sinComentario)
        .flatMap((linea, i) => (NATIVO.test(linea) ? [`${ruta(archivo)}:${i + 1}: ${linea.trim()}`] : []))
    )

describe('campos de fecha y de mes del portal (CA-1.5.3)', () => {
  it('ve las fuentes del portal, y CampoFecha y CampoMes entre ellas', () => {
    expect(fuentes(PORTAL).map(ruta)).toEqual(
      expect.arrayContaining(['componentes/CampoFecha.tsx', 'componentes/CampoMes.tsx', 'atencion/FichaConsultaPage.tsx', 'tableros/MonitoreoPage.tsx'])
    )
  })

  it('ninguna pantalla dibuja un campo de fecha ni de mes nativo: usa CampoFecha o CampoMes', () => {
    expect(hallazgos()).toEqual([])
  })

  it('el vigía reconoce el campo nativo en sus formas y deja pasar lo demás', () => {
    for (const prohibido of [
      '<Input {...p} type="date" {...register(campo)} />',
      "<input type='datetime-local' value={v} />",
      "<Input type={'date'} />",
      "{ type: 'datetime-local', value }",
      '<input type="month" className={CONTROL} value={mes} />',
      "<Input type={'month'} />"
    ])
      expect(NATIVO.test(prohibido)).toBe(true)
    for (const permitido of [
      "['document_date', { type: 'DATE' }]",
      '<Input type="email" />',
      "{ item: 'date', field }",
      '<input type="checkbox" />',
      "{ month: 'long', year: 'numeric' }",
      "['month', mes]"
    ])
      expect(NATIVO.test(permitido)).toBe(false)
    expect(sinComentario('// un <input type="date"> lo dibuja el navegador')).toBe('')
    expect(sinComentario('// un <input type="month"> lo dibuja el navegador')).toBe('')
  })
})
