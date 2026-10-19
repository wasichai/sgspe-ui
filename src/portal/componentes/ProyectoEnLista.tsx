import { Link } from 'react-router'
import { atributo, type Registro } from '../datos/registros'

// el proyecto en la columna de una lista global (revisión de UX, etapa 3): «código · nombre», enlazado a su Resumen. el código
// no se parte y el nombre se recorta si no cabe, entero en el title; así la columna no le quita el ancho al título del registro.
// sin el proyecto todavía, «…»
export function ProyectoEnLista({ proyecto }: { proyecto: Registro | undefined }) {
  if (!proyecto) return <>…</>
  const codigo = String(atributo(proyecto, 'code') ?? '')
  const nombre = String(atributo(proyecto, 'name') ?? '')
  const completo = [codigo, nombre].filter(Boolean).join(' · ')
  return (
    <Link
      to={`/projects/${encodeURIComponent(proyecto.id)}/overview`}
      title={completo}
      aria-label={completo}
      className="inline-flex max-w-48 items-baseline text-sg-primary-text underline"
    >
      <span className="whitespace-nowrap font-sg-mono">{codigo}</span>
      {nombre ? <span className="truncate">&nbsp;·&nbsp;{nombre}</span> : null}
    </Link>
  )
}
