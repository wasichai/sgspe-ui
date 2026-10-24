import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

// CA-1.1.3 (hallazgo U-34, decisión DD-08): la superficie titulada de una página es Seccion (componentes/Seccion.tsx), que
// pone el borde, el relleno y el peso del título iguales en todas y no repite la caja dentro de otra. ninguna fuente de
// src/portal (no las pruebas) vuelve a escribir esa caja a mano, salvo lo que no es una sección: una tarjeta clicable, un
// elemento de lista, una lista de datos sin título o un panel desplegable. escanea cada cadena de clases, sin comentarios
const PORTAL = import.meta.dirname

// las clases de la caja, en cualquier orden y con cualquier otra clase al lado
const CAJA = ['rounded-sg-lg', 'border', 'border-sg-border', 'bg-sg-surface', 'p-4']

// las fuentes que pueden llevarla, cuántas veces y por qué no son una Seccion
const EXCEPCIONES: Record<string, { veces: number; porque: string }> = {
  'componentes/Seccion.tsx': { veces: 1, porque: 'el componente que la dibuja' },
  'pages/InicioPage.tsx': { veces: 1, porque: 'cada acceso del inicio es un enlace con forma de tarjeta, no una región' },
  'proyectos/EquipoYParametrosPage.tsx': { veces: 1, porque: 'cada campaña es un elemento de su lista (<li>)' },
  'territorio/FichaLocalidadPage.tsx': {
    veces: 2,
    porque: 'cada cifra del perfil es un elemento de su lista (<li>) y los campos del perfil, una lista de datos (<dl>) sin título'
  },
  'tableros/RevisionEjecutivaPage.tsx': {
    veces: 1,
    porque: 'el panel desplegable de filtros y proyectos, sin título, es el destino de aria-controls de su botón'
  }
}

function fuentes(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) return fuentes(ruta)
    return /\.tsx?$/.test(nombre) && !/\.test\.tsx?$/.test(nombre) ? [ruta] : []
  })
}

const ruta = (archivo: string) => relative(PORTAL, archivo).split(sep).join('/')

// la línea sin su comentario: un comentario puede nombrar la caja para explicar por qué no se escribe a mano
const sinComentario = (linea: string) => {
  if (/^\s*(\/\/|\/\*|\*|\{\/\*)/.test(linea)) return ''
  return linea.replace(/('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)|\/\/.*$/g, (_m, cadena?: string) => cadena ?? '')
}

// una cadena de la línea que lleva todas las clases de la caja
const conCaja = (linea: string) =>
  [...linea.matchAll(/'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"|`((?:\\.|[^`\\])*)`/g)].some((m) => {
    const clases = new Set((m[1] ?? m[2] ?? m[3] ?? '').split(/\s+/))
    return CAJA.every((c) => clases.has(c))
  })

// cuántas veces aparece la caja en cada fuente
const apariciones = () =>
  Object.fromEntries(
    fuentes(PORTAL)
      .map((archivo) => [ruta(archivo), readFileSync(archivo, 'utf8').split('\n').map(sinComentario).filter(conCaja).length] as const)
      .filter(([, veces]) => veces > 0)
  )

describe('superficies del portal (CA-1.1.3)', () => {
  it('ve las fuentes del portal, y Seccion entre ellas', () => {
    expect(fuentes(PORTAL).map(ruta)).toEqual(expect.arrayContaining(['componentes/Seccion.tsx', 'atencion/FichaConsultaPage.tsx']))
  })

  it('la caja escrita a mano queda solo en las excepciones, que no son secciones: lo demás usa Seccion', () => {
    expect(apariciones()).toEqual(Object.fromEntries(Object.entries(EXCEPCIONES).map(([archivo, { veces }]) => [archivo, veces])))
  })

  it('cada excepción dice por qué no es una Seccion', () => {
    for (const { porque } of Object.values(EXCEPCIONES)) expect(porque.length).toBeGreaterThan(10)
  })

  it('el vigía reconoce la caja en cualquier orden y deja pasar lo demás', () => {
    for (const prohibido of [
      '<section aria-label={x} className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-4 text-sm">',
      "<div className='p-4 bg-sg-surface border-sg-border border rounded-sg-lg'>",
      'className={cn(`rounded-sg-lg border border-sg-border bg-sg-surface p-4`, clase)}'
    ])
      expect(conCaja(sinComentario(prohibido))).toBe(true)
    for (const permitido of [
      '<div className="rounded-sg-md border border-sg-border bg-sg-surface p-3 text-sm">',
      '<section className="space-y-3 rounded-sg-lg border border-dashed border-sg-ai-border bg-sg-ai-soft p-4">',
      '<div className="rounded-sg-lg border border-sg-border p-4">'
    ])
      expect(conCaja(sinComentario(permitido))).toBe(false)
    expect(sinComentario('// la caja «rounded-sg-lg border border-sg-border bg-sg-surface p-4» la pone Seccion')).toBe('')
  })
})
