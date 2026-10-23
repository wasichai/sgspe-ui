import { BotonDeVistaPrevia } from './VistaPrevia'
import { Link } from 'react-router'
import { useEnlaceConOrigen, useSiguientePaso } from '../contexto/Rastro'

// el enlace a un registro de la revisión de UX (etapa 0): el mismo en listas y paneles, con el código en monoespaciado gris y
// el título como enlace. la ruta llega ya armada y codificada (datos/fichas.ts, rutaDeFicha); sin ruta, el título sin enlace,
// nunca un enlace a «#». suma el paso al rastro (ux-architecture.md §8.1) con «desde» o, sin él, con el título de la página
// dentro del resultado de una lista, lleva también su origen (flujo F-C): la ficha ofrece «Volver a <lista>», «Anterior» y «Siguiente»
// con codigoEnElEnlace, el código va dentro del enlace (una QCS, que no tiene título: código y asunto son el mismo enlace)
export function EnlaceDeRegistro({
  codigo,
  titulo,
  ruta,
  desde,
  codigoEnElEnlace = false,
  previa
}: {
  codigo?: string | null
  titulo: string
  ruta: string | null
  desde?: string
  codigoEnElEnlace?: boolean
  // con el objeto y el id, el ojo de su vista previa junto al título (revisión de UX, etapa 6): se mira sin dejar la lista
  previa?: { objeto: string; id: string }
}) {
  const paso = useSiguientePaso()
  const estado = paso(desde, ruta ?? undefined)
  const conOrigen = useEnlaceConOrigen(ruta ?? undefined, estado, desde)
  const elCodigo = codigo ? <span className="font-sg-mono text-sg-caption text-sg-text-muted">{codigo}</span> : null
  const ojo = previa && ruta ? <BotonDeVistaPrevia objeto={previa.objeto} id={previa.id} nombre={[codigo, titulo].filter(Boolean).join(' ')} /> : null
  if (codigoEnElEnlace && ruta) {
    const enlace = (
      <Link to={ruta} state={estado} {...conOrigen} className="inline-flex min-w-0 flex-wrap items-baseline gap-x-2 text-sg-primary-text">
        {elCodigo}
        {/* el espacio separa el código del título en el nombre del enlace («Q-002 Agua turbia…»); el flex no lo dibuja */}
        {elCodigo && titulo ? ' ' : null}
        {titulo ? <span className="underline">{titulo}</span> : null}
      </Link>
    )
    return ojo ? (
      <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-2">
        {enlace}
        {ojo}
      </span>
    ) : (
      enlace
    )
  }
  return (
    <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-2">
      {elCodigo}
      {ruta ? (
        <Link to={ruta} state={estado} {...conOrigen} className="text-sg-primary-text underline">
          {titulo}
        </Link>
      ) : (
        <span>{titulo}</span>
      )}
      {ojo}
    </span>
  )
}
