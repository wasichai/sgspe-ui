import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

// CA-1.5.3 (hallazgo U-07, decisión DD-07): ninguna pantalla del portal dibuja un campo de fecha nativo. un <input type="date">
// o type="datetime-local" lo pinta el navegador con su configuración regional (mm/dd/yyyy, AM/PM); las fechas se escriben con
// CampoFecha (componentes/CampoFecha.tsx), que muestra y lee dd/mm/aaaa y la hora de 24 h en los dos idiomas. escanea las
// fuentes de src/portal (no las pruebas), sin sus comentarios
const PORTAL = import.meta.dirname

// type="date", type='date', type={'date'} o type: 'date', y lo mismo con datetime-local
const NATIVO = /\btype\s*(?:=|:)\s*\{?\s*['"`](?:date|datetime-local)['"`]/

// las fuentes que todavía pueden llevarlo. CampoFecha es el componente que lo reemplaza. las demás son temporales: otras tareas
// del área 4.5 las migran en paralelo (NuevaQcsPage, EvaluacionDrawer y los tableros); al integrarlas, esta lista se vacía
// hasta dejar solo CampoFecha
const EXCEPCIONES = [
  'componentes/CampoFecha.tsx',
  // temporales del área 4.5: se quitan al integrar sus migraciones
  'atencion/NuevaQcsPage.tsx',
  'grupos/EvaluacionDrawer.tsx',
  'tableros/'
]

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

describe('campos de fecha del portal (CA-1.5.3)', () => {
  it('ve las fuentes del portal, y CampoFecha entre ellas', () => {
    expect(fuentes(PORTAL).map(ruta)).toEqual(expect.arrayContaining(['componentes/CampoFecha.tsx', 'atencion/FichaConsultaPage.tsx']))
  })

  it('ninguna pantalla dibuja un campo de fecha nativo: usa CampoFecha', () => {
    expect(hallazgos()).toEqual([])
  })

  it('el vigía reconoce el campo nativo en sus formas y deja pasar lo demás', () => {
    for (const prohibido of [
      '<Input {...p} type="date" {...register(campo)} />',
      "<input type='datetime-local' value={v} />",
      "<Input type={'date'} />",
      "{ type: 'datetime-local', value }"
    ])
      expect(NATIVO.test(prohibido)).toBe(true)
    for (const permitido of ["['document_date', { type: 'DATE' }]", '<Input type="email" />', "{ item: 'date', field }", '<input type="checkbox" />'])
      expect(NATIVO.test(permitido)).toBe(false)
    expect(sinComentario('// un <input type="date"> lo dibuja el navegador')).toBe('')
  })
})
