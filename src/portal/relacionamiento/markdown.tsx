import type { ReactNode } from 'react'

// la vista previa del acta: Markdown sin HTML (database-model.md §3.4) dibujado como elementos de React, nunca con
// innerHTML. cubre lo que usa un acta: títulos, listas y párrafos. desde F7 dibuja también las salidas de la IA, con sus
// marcadores resueltos por línea (enLinea)
export function VistaMarkdown({ texto, enLinea = (linea: string): ReactNode => linea }: { texto: string; enLinea?: (linea: string) => ReactNode }) {
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
