import { Fragment, type ReactNode } from 'react'
import { PATRON } from '../ia/marcadores'

// la vista previa del acta: Markdown sin HTML (database-model.md §3.4) dibujado como elementos de React, nunca con
// innerHTML. cubre lo que usa un acta: títulos, listas y párrafos. desde F7 dibuja también las salidas de la IA, con sus
// marcadores resueltos por línea (enLinea)
const MARCADOR = new RegExp(`^${PATRON}`)

// la primera aparición de la marca fuera de un marcador de la IA: el guion bajo de [PERSONA_1] no cierra una cursiva
function buscarCierre(linea: string, marca: string, desde: number): number {
  for (let i = desde; i < linea.length; i++) {
    if (linea[i] === '[') {
      const marcador = MARCADOR.exec(linea.slice(i))
      if (marcador) {
        i += marcador[0].length - 1
        continue
      }
    }
    if (linea.startsWith(marca, i)) return i
  }
  return -1
}
const ALFANUMERICO = /[\p{L}\p{N}]/u
const sinBordes = (t: string) => t.length > 0 && t === t.trim()

// énfasis en línea como elementos de React armados desde texto: **negrita**, *cursiva*, _cursiva_ y `código`. los marcadores
// sin pareja quedan literales, los enlaces y el HTML no se dibujan y un marcador de la IA ([PERSONA:id]) no se parte. el texto
// que no es énfasis (y el de dentro del énfasis) pasa por enLinea, para re-identificar los marcadores
function conEnfasis(linea: string, enLinea: (linea: string) => ReactNode): ReactNode[] {
  const nodos: ReactNode[] = []
  let suelto = ''
  const soltar = () => {
    if (suelto) nodos.push(<Fragment key={nodos.length}>{enLinea(suelto)}</Fragment>)
    suelto = ''
  }
  let i = 0
  while (i < linea.length) {
    const c = linea[i]
    if (c === '[') {
      const marcador = MARCADOR.exec(linea.slice(i))
      if (marcador) {
        suelto += marcador[0]
        i += marcador[0].length
        continue
      }
    }
    if (c === '*' || c === '_' || c === '`') {
      const doble = c === '*' && linea[i + 1] === '*'
      const marca = doble ? '**' : c
      const cierre = buscarCierre(linea, marca, i + marca.length)
      const dentro = cierre < 0 ? '' : linea.slice(i + marca.length, cierre)
      const antes = i > 0 ? linea[i - 1] : ''
      const despues = cierre < 0 ? '' : (linea[cierre + 1] ?? '')
      const aislada = c !== '_' || (!ALFANUMERICO.test(antes) && !ALFANUMERICO.test(despues))
      if (cierre > 0 && (c === '`' ? dentro.length > 0 : sinBordes(dentro)) && aislada && !(c === '*' && !doble && dentro.startsWith('*'))) {
        soltar()
        const key = nodos.length
        if (c === '`') nodos.push(<code key={key}>{enLinea(dentro)}</code>)
        else if (doble) nodos.push(<strong key={key}>{conEnfasis(dentro, enLinea)}</strong>)
        else nodos.push(<em key={key}>{conEnfasis(dentro, enLinea)}</em>)
        i = cierre + marca.length
        continue
      }
      suelto += marca
      i += marca.length
      continue
    }
    suelto += c
    i++
  }
  soltar()
  return nodos
}

export function VistaMarkdown({ texto, enLinea: dibujar = (linea: string): ReactNode => linea }: { texto: string; enLinea?: (linea: string) => ReactNode }) {
  const enLinea = (linea: string): ReactNode => conEnfasis(linea, dibujar)
  const bloques: ReactNode[] = []
  let lista: string[] = []
  const cerrarLista = () => {
    if (lista.length)
      bloques.push(
        <ul key={`l${bloques.length}`} className="ml-5 list-disc">
          {lista.map((item, i) => (
            <li key={i}>{enLinea(item)}</li>
          ))}
        </ul>
      )
    lista = []
  }
  for (const linea of texto.split(/\r?\n/)) {
    const titulo = /^(#{1,3})\s+(.*)$/.exec(linea)
    const item = /^[-*]\s+(.*)$/.exec(linea)
    if (item) {
      lista.push(item[1])
      continue
    }
    cerrarLista()
    if (titulo) {
      const nivel = titulo[1].length
      bloques.push(
        nivel === 1 ? (
          <h2 key={bloques.length} className="text-sg-h2 font-semibold">
            {enLinea(titulo[2])}
          </h2>
        ) : nivel === 2 ? (
          <h3 key={bloques.length} className="text-sg-h3 font-semibold">
            {enLinea(titulo[2])}
          </h3>
        ) : (
          <h4 key={bloques.length} className="font-semibold">
            {enLinea(titulo[2])}
          </h4>
        )
      )
    } else if (linea.trim()) bloques.push(<p key={bloques.length}>{enLinea(linea)}</p>)
  }
  cerrarLista()
  return <div className="space-y-2 text-sm">{bloques}</div>
}
