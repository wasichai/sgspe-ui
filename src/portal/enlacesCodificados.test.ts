import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

// sgspe#14: toda ruta del portal que lleva un id, un proyecto o un valor de la URL lo codifica con encodeURIComponent. un id es hoy
// un UUID y no rompería nada, pero un valor con '/', '?' o '#' cambiaría la ruta o se comería la consulta; las pantallas de F3 ya
// codificaban y esta prueba lo vigila en todas. escanea las fuentes de src/portal (no las pruebas): en cada plantilla de una ruta
// del portal, cada ${…} es encodeURIComponent(…) o uno de los trozos de ruta fijos de PERMITIDOS
const PORTAL = import.meta.dirname

// los inicios de una ruta del portal, con un literal o con una interpolación delante (`${base}/engagements/…`) (ux-architecture.md §6.2): las fichas y listas que llevan un id o un proyecto
const RUTA = /`(?:\/|\$\{[^}`]*\}\/)(projects|actors|territory|documents|tasks|agreements|r|risks|attention|commitments|engagements|stakeholders)\b[^`]*`/g

// lo que puede ir sin codificar porque ya es un trozo de ruta, nunca un dato: la base ya codificada de una pantalla, un sufijo de
// consulta ya armado, una pestaña del proyecto, la sección de territorio o de QCS de un objeto, y un id o un resto de ruta que
// la misma función ya codificó (fichas.ts)
const PERMITIDOS = new Set([
  'base',
  'sufijo',
  'p',
  'idEnRuta',
  'resto',
  'segunda', // contexto/rutas.ts: solo llega tras compararla con 'matrix', 'calendar' o 'dashboard'
  'FICHA[objeto]',
  'FICHA[objetoElegido]',
  'RUTA_DE_QCS[objeto]',
  "i.state === 'held' ? '/minutes' : ''"
])

function fuentes(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) return fuentes(ruta)
    return /\.tsx?$/.test(nombre) && !/\.test\.tsx?$/.test(nombre) ? [ruta] : []
  })
}

// los ${…} de una plantilla, con sus paréntesis anidados (encodeURIComponent(texto(c, 'project')))
function interpolaciones(plantilla: string): string[] {
  const salida: string[] = []
  for (let i = plantilla.indexOf('${'); i >= 0; i = plantilla.indexOf('${', i + 2)) {
    let nivel = 1
    let j = i + 2
    for (; j < plantilla.length && nivel > 0; j++) {
      if (plantilla[j] === '{') nivel++
      else if (plantilla[j] === '}') nivel--
    }
    salida.push(plantilla.slice(i + 2, j - 1).trim())
  }
  return salida
}

export const sinCodificar = (codigo: string): string[] =>
  [...codigo.matchAll(RUTA)].flatMap(([plantilla]) =>
    interpolaciones(plantilla).filter((x) => !/^encodeURIComponent\(|^[\w.]+\.map\(encodeURIComponent\)\.join\(/.test(x) && !PERMITIDOS.has(x))
  )

describe('las rutas del portal codifican lo que llevan', () => {
  it('reconoce una interpolación sin codificar y deja pasar las codificadas', () => {
    expect(sinCodificar('<Link to={`/projects/${proyecto}/engagements/${e.id}`} />')).toEqual(['proyecto', 'e.id'])
    expect(sinCodificar("navegar(`/projects/${encodeURIComponent(texto(c, 'project'))}/commitments/${encodeURIComponent(c.id)}`)")).toEqual([])
    expect(sinCodificar('`/projects/${encodeURIComponent(p)}/stakeholders?territory=${encodeURIComponent(valor)}`')).toEqual([])
    expect(sinCodificar('to={`${base}/commitments/new`}')).toEqual([])
    expect(sinCodificar("`${base}/engagements/new?stakeholders=${elegidos.join(',')}`")).toEqual(["elegidos.join(',')"])
    expect(sinCodificar("`${base}/engagements/new?stakeholders=${elegidos.map(encodeURIComponent).join(',')}`")).toEqual([])
    expect(sinCodificar('`${raiz}/projects/${id}`')).toEqual(['raiz', 'id'])
  })

  it('ninguna fuente del portal arma una ruta con un dato sin codificar', () => {
    const hallazgos = fuentes(PORTAL).flatMap((archivo) =>
      sinCodificar(readFileSync(archivo, 'utf8')).map((x) => `${relative(PORTAL, archivo).split(sep).join('/')}: \${${x}}`)
    )
    expect(hallazgos).toEqual([])
  })
})
