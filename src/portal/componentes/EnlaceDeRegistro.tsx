import { Link } from 'react-router'
import { useSiguientePaso } from '../contexto/Rastro'

// el enlace a un registro de la revisión de UX (etapa 0): el mismo en listas y paneles, con el código en monoespaciado gris y
// el título como enlace. la ruta llega ya armada y codificada (datos/fichas.ts, rutaDeFicha); sin ruta, el título sin enlace,
// nunca un enlace a «#». con «desde» (el nombre de la vista que se deja), suma el paso al rastro (ux-architecture.md §8.1)
// con codigoEnElEnlace, el código va dentro del enlace (una QCS, que no tiene título: código y asunto son el mismo enlace)
export function EnlaceDeRegistro({
  codigo,
  titulo,
  ruta,
  desde,
  codigoEnElEnlace = false
}: {
  codigo?: string | null
  titulo: string
  ruta: string | null
  desde?: string
  codigoEnElEnlace?: boolean
}) {
  const paso = useSiguientePaso()
  const elCodigo = codigo ? <span className="font-sg-mono text-sg-caption text-sg-text-muted">{codigo}</span> : null
  if (codigoEnElEnlace && ruta)
    return (
      <Link to={ruta} state={desde ? paso(desde) : undefined} className="inline-flex min-w-0 flex-wrap items-baseline gap-x-2 text-sg-primary-text">
        {elCodigo}
        {/* el espacio separa el código del título en el nombre del enlace («Q-002 Agua turbia…»); el flex no lo dibuja */}
        {elCodigo && titulo ? ' ' : null}
        {titulo ? <span className="underline">{titulo}</span> : null}
      </Link>
    )
  return (
    <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-2">
      {elCodigo}
      {ruta ? (
        <Link to={ruta} state={desde ? paso(desde) : undefined} className="text-sg-primary-text underline">
          {titulo}
        </Link>
      ) : (
        <span>{titulo}</span>
      )}
    </span>
  )
}
