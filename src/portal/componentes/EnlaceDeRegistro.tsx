import { Link } from 'react-router'
import { useSiguientePaso } from '../contexto/Rastro'

// el enlace a un registro de la revisión de UX (etapa 0): el mismo en listas y paneles, con el código en monoespaciado gris y
// el título como enlace. la ruta llega ya armada y codificada (datos/fichas.ts, rutaDeFicha); sin ruta, el título sin enlace,
// nunca un enlace a «#». con «desde» (el nombre de la vista que se deja), suma el paso al rastro (ux-architecture.md §8.1)
export function EnlaceDeRegistro({ codigo, titulo, ruta, desde }: { codigo?: string | null; titulo: string; ruta: string | null; desde?: string }) {
  const paso = useSiguientePaso()
  return (
    <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-2">
      {codigo ? <span className="font-sg-mono text-sg-caption text-sg-text-muted">{codigo}</span> : null}
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
